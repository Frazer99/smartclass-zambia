import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { generateChatCompletion } from "../_shared/llm.ts";
import { logError } from "../_shared/errorLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  sessionId: string;
  message: string;
  lessonTitle?: string;
  topicId?: string;
  topicName?: string;
  topicDescription?: string;
  subjectId?: string;
  grade?: number;
  subjectName?: string;
  lessonContent?: {
    intro?: string;
    steps?: { title: string; body: string; board: string }[];
    examples?: { problem: string; solution: string }[];
    summary?: string;
  };
  history?: { role: string; content: string }[];
  /** Optional reason string from the adaptive learning engine (SRS 12.9/12.10),
   *  e.g. "Missed the last 3 practice questions in a row". When present,
   *  Mr. Chomba is told to teach this pupil more gently on this topic. */
  weakAreaReason?: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "what", "why", "how", "when",
  "where", "who", "do", "does", "did", "can", "could", "would", "should",
  "i", "you", "we", "it", "this", "that", "and", "or", "but", "to", "of",
  "in", "on", "for", "with", "not", "don't", "dont", "understand", "please",
  "explain", "again", "me", "my", "your",
]);

/** Pulls the meaningful words out of a pupil's message for keyword search,
 *  since a single ILIKE against the full raw sentence almost never matches
 *  curriculum material written in a completely different phrasing. */
function extractKeywords(text: string, max = 5): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const unique = Array.from(new Set(words)).sort((a, b) => b.length - a.length);
  return unique.slice(0, max);
}

const CONFUSION_SIGNALS = [
  "don't understand", "dont understand", "confused", "still don't get",
  "still dont get", "not sure", "makes no sense", "lost", "hard", "difficult",
];

function detectConfusion(message: string): boolean {
  const lower = message.toLowerCase();
  return CONFUSION_SIGNALS.some((s) => lower.includes(s));
}

/**
 * Content moderation via OpenAI's Moderation API (free, no separate
 * billing beyond the standard API key already required for chat) —
 * deliberately not a custom keyword list. A purpose-built classifier
 * handles the many phrasings and languages a keyword list would miss,
 * and doesn't require enumerating harmful terms in this codebase to
 * detect them.
 *
 * Returns { flagged: false } (never blocks the pupil) if
 * OPENAI_API_KEY isn't configured or the moderation call itself fails —
 * moderation is a safety layer on top of the teaching flow, not a
 * replacement for it; a moderation outage should degrade to "unscreened"
 * rather than "nothing works." severity is 'self_harm' when any of
 * OpenAI's self-harm categories are flagged (that case gets a different,
 * caring response — see the caller), 'other' for every other flagged
 * category.
 */
async function moderateMessage(message: string): Promise<{ flagged: boolean; severity: "self_harm" | "other"; categories: Record<string, boolean> }> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey || !message?.trim()) {
    return { flagged: false, severity: "other", categories: {} };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ input: message }),
    });
    if (!res.ok) return { flagged: false, severity: "other", categories: {} };

    const data = await res.json();
    const result = data.results?.[0];
    if (!result?.flagged) return { flagged: false, severity: "other", categories: {} };

    const categories: Record<string, boolean> = result.categories || {};
    const isSelfHarm = Object.keys(categories).some((k) => k.startsWith("self-harm") && categories[k]);

    return { flagged: true, severity: isSelfHarm ? "self_harm" : "other", categories };
  } catch (e) {
    console.error("Moderation check failed (treating as unflagged, non-fatal):", e);
    return { flagged: false, severity: "other", categories: {} };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let logPayload: Record<string, unknown> | null = null;
  let userId: string | null = null;

  try {
    const body: ChatRequest = await req.json();
    const {
      sessionId, message, lessonTitle, topicId, topicName, topicDescription,
      subjectId, grade, subjectName, lessonContent, history, weakAreaReason,
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // Auth + rate limiting. Previously this function accepted requests
    // from anyone with its URL — the Authorization header was only used
    // optionally, inside logging, to attribute a user_id if one happened
    // to be present. That meant no accountability and no way to rate-limit
    // abuse (every message here costs a real OpenAI API call, now two —
    // chat completion plus an embedding call for vector search). Both
    // gaps are closed together: a valid session is required, and the
    // resolved user is who gets rate-limited.
    // ============================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = userData.user.id;

    // Two windows: a tight per-minute burst limit (catches automated
    // hammering — no real pupil sends 8+ messages inside 60 seconds) and a
    // looser per-hour limit (bounds the worst-case OpenAI cost from a
    // single compromised or misused account even if it stays under the
    // burst threshold). Both counts come from ai_interaction_logs, which
    // this function already writes to after every response — no separate
    // rate-limit table needed.
    const MINUTE_LIMIT = 8;
    const HOUR_LIMIT = 60;
    const now = Date.now();
    const [minuteCountRes, hourCountRes] = await Promise.all([
      supabase.from("ai_interaction_logs").select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("created_at", new Date(now - 60_000).toISOString()),
      supabase.from("ai_interaction_logs").select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("created_at", new Date(now - 3_600_000).toISOString()),
    ]);
    const minuteCount = minuteCountRes.count ?? 0;
    const hourCount = hourCountRes.count ?? 0;

    if (minuteCount >= MINUTE_LIMIT || hourCount >= HOUR_LIMIT) {
      const rateLimitedResponse = minuteCount >= MINUTE_LIMIT
        ? "You're sending messages a little fast — take a short breath and try again in a moment."
        : "You've reached the chat limit for now. Try again a bit later, or keep working through the lesson on the smart board in the meantime.";
      // Logged so the admin AI Insights panel can surface repeated rate
      // limiting as an abuse signal — fire-and-forget, never blocks the response.
      logInteraction(supabase, userId, {
        session_id: sessionId || null, topic_id: topicId || null, grade: grade || null,
        message, response: rateLimitedResponse, source: "rate_limited",
        used_curriculum_context: false, detected_confusion: false, retrieval_method: "none",
      });
      return new Response(JSON.stringify({ response: rateLimitedResponse, source: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // Free-tier daily quota — subscribed pupils (or anyone during
    // platform-wide free mode) skip this entirely via
    // has_active_subscription(), which also checks the global
    // is_platform_free setting internally. Free-tier pupils get
    // free_daily_message_limit (default 15, admin-configurable in
    // platform_settings) messages per calendar day before being asked
    // to subscribe — counted from ai_interaction_logs, the same table
    // already used for rate limiting, so no separate usage-tracking
    // table is needed. This check runs before the (much more expensive)
    // moderation/RAG/OpenAI calls below, so an exhausted quota fails
    // fast rather than doing all that work only to withhold the answer.
    // ============================================================
    const { data: hasSubscription } = await supabase.rpc("has_active_subscription", { p_user_id: userId });

    if (!hasSubscription) {
      const { data: limitSetting } = await supabase
        .from("platform_settings").select("value").eq("key", "free_daily_message_limit").maybeSingle();
      const dailyLimit = Number(limitSetting?.value ?? 15);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from("ai_interaction_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString());

      if ((todayCount ?? 0) >= dailyLimit) {
        const subscribeResponse = "You've used today's free messages with Mr. Chomba and the team — subscribe to keep chatting without limits, or come back tomorrow for more free messages.";
        logInteraction(supabase, userId, {
          session_id: sessionId || null, topic_id: topicId || null, grade: grade || null,
          message, response: subscribeResponse, source: "subscription_required",
          used_curriculum_context: false, detected_confusion: false, retrieval_method: "none",
        });
        return new Response(JSON.stringify({ response: subscribeResponse, source: "subscription_required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================
    // Content moderation — every pupil message is screened before any
    // RAG retrieval or teaching response is generated. Uses OpenAI's
    // Moderation API (free, purpose-built) rather than a custom keyword
    // list, which would be both less effective and the kind of
    // enumeration better left to a model actually trained for this.
    // Flagged messages never reach the teaching LLM or RAG pipeline —
    // they get a fixed, calm response instead, and are logged to
    // moderation_flags for admin review. Self-harm signals specifically
    // get their own response pointing to Lifeline/Childline Zambia's 116
    // Child Helpline rather than the generic redirect, since that's a
    // different situation than an off-topic or inappropriate message —
    // it calls for care, not just a boundary.
    // ============================================================
    const moderation = await moderateMessage(message);
    if (moderation.flagged) {
      const moderatedResponse = moderation.severity === "self_harm"
        ? "I'm really glad you told me something, and I want you to know you don't have to go through hard feelings alone. Please talk to someone you trust — a parent, guardian, or teacher — as soon as you can. You can also call Lifeline/Childline Zambia any time, day or night, free from any network: dial 116. I'm here for lessons whenever you're ready, but a caring adult is the right person for this."
        : "Let's keep our conversation focused on your lesson — I'm here to help you learn. What would you like to go over?";

      logInteraction(supabase, userId, {
        session_id: sessionId || null, topic_id: topicId || null, grade: grade || null,
        message, response: moderatedResponse, source: "moderated",
        used_curriculum_context: false, detected_confusion: false, retrieval_method: "none",
      });
      supabase.from("moderation_flags").insert({
        user_id: userId, session_id: sessionId || null, message,
        categories: moderation.categories, severity: moderation.severity,
      }).then(({ error }: any) => {
        if (error) console.error("Failed to log moderation flag (non-fatal):", error);
      });

      return new Response(JSON.stringify({ response: moderatedResponse, source: "moderated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detectedConfusion = detectConfusion(message);

    // Shared vocabulary between reactive escalation (below) and proactive
    // learning-style preference — a pupil's preference and the escalation
    // sequence are the same underlying concept (which kind of explanation
    // works for this person), just applied reactively vs. proactively.
    const STRATEGY_ORDER = ["direct", "visual", "local_example", "step_by_step"];
    const STRATEGY_DESCRIPTIONS: Record<string, string> = {
      direct: "a direct, step-by-step mathematical explanation",
      visual: "a visual explanation — describe a diagram, number line, or picture on the smart board that shows the concept, rather than more equations",
      local_example: "an everyday, local Zambian example — connect the concept to something familiar (kwacha and money, farming, market trading, distances between towns) instead of abstract numbers",
      step_by_step: "the smallest possible steps — break just the very first part of the problem down further than before, and check understanding after that one step before continuing",
    };

    // ============================================================
    // SmartTeach escalating explanation strategies — per the original
    // design: repeating the same kind of explanation to a still-confused
    // pupil doesn't help. If confusion is detected, escalate to a
    // genuinely different teaching approach next time; if not, reset the
    // escalation for this topic, so a later, unrelated struggle on the
    // same topic starts fresh rather than jumping straight to "break it
    // into smaller steps" for a completely different question.
    //
    // Resolution also feeds SmartTeach's *proactive* side (see below):
    // when confusion clears and a strategy had just been used, that
    // transition is logged as a signal that the strategy worked for this
    // pupil — the raw material get_preferred_learning_style() aggregates
    // to decide what to lean on from the START of a future explanation,
    // not just reactively once confusion shows up again.
    // ============================================================
    let explanationStrategyInstruction = "";
    if (topicId) {
      if (detectedConfusion) {
        const { data: existingAttempt } = await supabase
          .from("topic_explanation_attempts")
          .select("attempt_count")
          .eq("student_id", userId)
          .eq("topic_id", topicId)
          .maybeSingle();
        const newCount = (existingAttempt?.attempt_count ?? 0) + 1;
        const strategyKey = STRATEGY_ORDER[Math.min(newCount, 4) - 1];
        const strategy = STRATEGY_DESCRIPTIONS[strategyKey];
        explanationStrategyInstruction = `\nSMARTTEACH ESCALATION: This pupil has shown confusion on this topic ${newCount} time(s) recently. Do not repeat the same kind of explanation as before — use ${strategy} this time.`;

        await supabase.from("topic_explanation_attempts").upsert(
          { student_id: userId, topic_id: topicId, attempt_count: newCount, last_strategy: strategyKey, updated_at: new Date().toISOString() },
          { onConflict: "student_id,topic_id" }
        );
      } else {
        // Check whether this "no longer confused" moment follows a
        // recorded strategy — if so, log it as a resolution signal
        // before resetting, then reset as before. Awaited (not
        // fire-and-forget) because this is a multi-step sequence
        // (read, then conditionally insert, then update) — cutting it
        // off partway through would be worse than the small added
        // latency of waiting for a few quick DB calls to finish.
        try {
          const { data: existingAttempt } = await supabase
            .from("topic_explanation_attempts")
            .select("attempt_count, last_strategy")
            .eq("student_id", userId).eq("topic_id", topicId)
            .maybeSingle();

          if (existingAttempt?.attempt_count > 0 && existingAttempt?.last_strategy) {
            await supabase.from("student_learning_style_signals").insert({
              student_id: userId, topic_id: topicId, strategy: existingAttempt.last_strategy,
            });
          }

          await supabase.from("topic_explanation_attempts")
            .update({ attempt_count: 0, updated_at: new Date().toISOString() })
            .eq("student_id", userId).eq("topic_id", topicId);
        } catch (e) {
          console.error("Failed to process explanation-attempt resolution (non-fatal):", e);
        }
      }
    }

    // ============================================================
    // SmartTeach proactive learning-style preference — distinct from the
    // reactive escalation above. Only applied when the pupil ISN'T
    // currently confused (the escalation instruction already covers that,
    // more urgently and specifically) — this is about setting the tone of
    // an explanation from the start, before any confusion has shown up
    // yet, once there's enough signal to trust a real preference exists.
    // ============================================================
    let learningStyleInstruction = "";
    if (topicId && !detectedConfusion) {
      const { data: preferred } = await supabase.rpc("get_preferred_learning_style", { p_student_id: userId });
      const preferredStrategy = preferred?.[0]?.strategy;
      if (preferredStrategy && STRATEGY_DESCRIPTIONS[preferredStrategy]) {
        learningStyleInstruction = `\nSMARTTEACH LEARNING STYLE: Over time, this pupil has tended to understand best with ${STRATEGY_DESCRIPTIONS[preferredStrategy]}. Lean toward this style in how you explain things today, even before they show any confusion — but don't force it if it doesn't fit the question naturally.`;
      }
    }

    // ============================================================
    // Step 1: RAG — retrieve grounding context from three sources,
    // scoped to the pupil's grade/subject/topic where we have it.
    //
    // Vector search (pgvector) is tried first: it finds conceptually
    // related content even when the pupil's wording shares no keywords
    // with the source material. It needs an embedding of the pupil's
    // message, which itself needs OPENAI_API_KEY — when that's unset, or
    // when a table simply has no embedded rows yet (before an admin runs
    // the backfill), this transparently falls back to the original
    // keyword/ILIKE search rather than returning nothing.
    // ============================================================
    let curriculumContext = "";
    let workedExampleContext = "";
    let usedCurriculumContext = false;
    let retrievalMethod: "vector" | "keyword" | "none" = "none";

    const queryEmbedding = await generateEmbedding(`${message} ${topicName || ""}`.trim());

    if (queryEmbedding) {
      const [materialsRes, indexRes, questionsRes] = await Promise.all([
        supabase.rpc("match_content_materials", {
          query_embedding: queryEmbedding,
          match_grade: grade || null,
          match_subject_id: subjectId || null,
          match_count: 4,
        }),
        supabase.rpc("match_search_index", {
          query_embedding: queryEmbedding,
          match_grade: grade || null,
          match_count: 4,
        }),
        supabase.rpc("match_past_paper_questions", {
          query_embedding: queryEmbedding,
          match_count: 2,
        }),
      ]);

      const materials = materialsRes.data || [];
      const indexHits = indexRes.data || [];
      const similarQuestions = questionsRes.data || [];

      if (materials.length > 0 || indexHits.length > 0 || similarQuestions.length > 0) {
        const contextLines: string[] = [];
        materials.forEach((m: any) =>
          contextLines.push(`[${m.material_type}] ${m.title} (${m.source}): ${m.content_summary || ""}`)
        );
        indexHits.forEach((r: any) =>
          contextLines.push(`[${r.item_type}] ${r.display_title}: ${r.description || ""}`)
        );
        curriculumContext = contextLines.join("\n");
        usedCurriculumContext = contextLines.length > 0;
        if (similarQuestions.length > 0) {
          workedExampleContext = similarQuestions
            .map((q: any) => `Q: ${q.question_text}\nWorked explanation: ${q.explanation}`)
            .join("\n\n");
        }
        retrievalMethod = "vector";
      }
    }

    // Fallback: no embedding could be generated, or vector search found
    // nothing (e.g. no rows embedded yet for this grade/subject).
    if (retrievalMethod === "none") {
      const keywords = extractKeywords(`${message} ${topicName || ""}`);
      const orFilter = (fields: string[]) =>
        keywords
          .flatMap((kw) => fields.map((f) => `${f}.ilike.%${kw}%`))
          .join(",");

      if (keywords.length > 0) {
        // 1a. content_materials — curriculum docs/textbooks/past-paper references
        let materialsQuery = supabase
          .from("content_materials")
          .select("title, source, content_summary, material_type, grade, subject_id")
          .or(orFilter(["title", "content_summary"]))
          .limit(4);
        if (grade) materialsQuery = materialsQuery.eq("grade", grade);
        if (subjectId) materialsQuery = materialsQuery.eq("subject_id", subjectId);
        const { data: materials } = await materialsQuery;

        // 1b. search_index — topic/lesson/term descriptions already indexed
        // for the dashboard search bar; scoped to grade so results stay
        // curriculum-relevant instead of pulling in other grades' content.
        let searchQuery = supabase
          .from("search_index")
          .select("display_title, description, item_type")
          .or(orFilter(["display_title", "description", "searchable_text"]))
          .limit(4);
        if (grade) searchQuery = searchQuery.eq("grade", grade);
        const { data: indexHits } = await searchQuery;

        const contextLines: string[] = [];
        (materials || []).forEach((m: any) =>
          contextLines.push(`[${m.material_type}] ${m.title} (${m.source}): ${m.content_summary || ""}`)
        );
        (indexHits || []).forEach((r: any) =>
          contextLines.push(`[${r.item_type}] ${r.display_title}: ${r.description || ""}`)
        );
        curriculumContext = contextLines.join("\n");
        usedCurriculumContext = contextLines.length > 0;
        if (usedCurriculumContext) retrievalMethod = "keyword";

        // 1c. past_paper_questions — a similar, already-explained question
        // makes excellent grounding for "why" questions in particular.
        const { data: similarQuestions } = await supabase
          .from("past_paper_questions")
          .select("question_text, explanation")
          .or(orFilter(["question_text"]))
          .not("explanation", "is", null)
          .limit(2);
        if (similarQuestions && similarQuestions.length > 0) {
          workedExampleContext = similarQuestions
            .map((q: any) => `Q: ${q.question_text}\nWorked explanation: ${q.explanation}`)
            .join("\n\n");
          if (retrievalMethod === "none") retrievalMethod = "keyword";
        }
      }
    }

    // ============================================================
    // Step 2: Build the system prompt with RAG context + personalization
    // ============================================================
    const lessonContext = lessonContent
      ? `Lesson: ${lessonTitle}\nTopic: ${topicName}\nSubject: ${subjectName}\nForm: ${grade}\n\nLesson content:\nIntro: ${lessonContent.intro || ""}\n${(lessonContent.steps || []).map((s, i) => `Step ${i + 1}: ${s.title} — ${s.body}`).join("\n")}\nExamples: ${(lessonContent.examples || []).map((e) => `${e.problem} → ${e.solution}`).join("; ")}\nSummary: ${lessonContent.summary || ""}`
      : `Topic: ${topicName}\nSubject: ${subjectName}\nForm: ${grade}`;

    // Resolve the correct named persona for this subject/grade — five
    // distinct teachers (Linda, Mrs Tembo, Mr Chomba, Mr Banda,
    // Chipo), not one "Mr. Chomba" hardcoded for every subject and grade.
    // Falls back to "Mr. Chomba" generically if no persona row matches
    // (e.g. subjectId wasn't passed, or a subject/grade combination has no
    // seeded persona yet) so the chat still works rather than erroring.
    let teacherName = "Mr. Chomba";
    let personaDescription = "";
    if (subjectId && grade) {
      const { data: persona } = await supabase
        .from("teacher_personas")
        .select("name, persona_description")
        .eq("subject_id", subjectId)
        .lte("grade_min", grade)
        .gte("grade_max", grade)
        .maybeSingle();
      if (persona) {
        teacherName = persona.name;
        personaDescription = persona.persona_description;
      }
    }

    // Local language support — a pupil can ask to be taught primarily in
    // Bemba, Nyanja, Tonga, or Lozi instead of English (see profiles.
    // preferred_language). Whether the model actually produces fluent
    // output in these specific languages is genuinely uncertain — they're
    // far less represented in typical LLM training data than English —
    // so this instructs the model to try, use its best judgment about
    // mixing in English for technical/mathematical terms (completely
    // normal code-switching in a real Zambian classroom), and fall back
    // to English for anything it can't express clearly, rather than
    // forcing broken output. The account page's language selector also
    // carries an explicit "quality may vary" note — this isn't presented
    // as a finished, guaranteed capability anywhere in the product.
    const LANGUAGE_NAMES: Record<string, string> = {
      bem: "Bemba", nya: "Nyanja", toi: "Tonga", loz: "Lozi",
    };
    let languageInstruction = "";
    const { data: profileRow } = await supabase.from("profiles").select("preferred_language").eq("id", userId).maybeSingle();
    const preferredLanguage = profileRow?.preferred_language;
    if (preferredLanguage && preferredLanguage !== "en" && LANGUAGE_NAMES[preferredLanguage]) {
      languageInstruction = `\nLANGUAGE: This pupil prefers ${LANGUAGE_NAMES[preferredLanguage]}. Respond primarily in ${LANGUAGE_NAMES[preferredLanguage]}, mixing in English for technical or mathematical terms where that's natural — the way a real Zambian classroom often does. If you're not confident you can express something clearly in ${LANGUAGE_NAMES[preferredLanguage]}, it's better to use English for that part than to guess at a wrong translation. If the pupil writes to you in English, you may reply in English.`;
    }

    const personalizationNote = weakAreaReason
      ? `\nPERSONALIZATION (SRS 12.9): This pupil's recent performance on this topic: "${weakAreaReason}". Be extra patient, slow down, and lean on additional worked examples before moving forward.`
      : "";

    const systemPrompt = `You are ${teacherName}, an AI teacher for SmartClass Zambia, an AI-powered tutoring platform for Zambian secondary school students. You teach following the Zambian curriculum.
${personaDescription ? `\nYOUR TEACHING PERSONA: ${personaDescription}\n` : ""}
CURRENT LESSON CONTEXT:
${lessonContext}
${personalizationNote}
${explanationStrategyInstruction}
${learningStyleInstruction}
${languageInstruction}

ZAMBIAN CURRICULUM MATERIALS (use these FIRST as your primary source):
${curriculumContext || "No specific curriculum materials found for this query. Use the lesson content above."}
${workedExampleContext ? `\nSIMILAR WORKED EXAMPLE FROM A PAST PAPER (use if relevant to the pupil's question):\n${workedExampleContext}` : ""}

INSTRUCTIONS:
1. Always teach from the Zambian curriculum materials first when available.
2. If the curriculum materials don't fully answer the pupil's question, supplement with your own knowledge, but keep it aligned with the Zambian syllabus.
3. Use examples relevant to Zambian life (Lusaka, Kitwe, Ndola, Copperbelt, nshima, farming, etc.) when possible.
4. Keep responses concise (2-4 sentences) since this is a chat interface.
5. Be encouraging and patient. If the pupil is confused, try a different explanation.
6. Use simple, clear English suitable for a Form ${grade || 1} student.
7. If the pupil asks something unrelated to the lesson, gently guide them back to the topic.
8. Do not use markdown formatting. Write in plain text.
9. Stay in character as ${teacherName} — never refer to yourself by a different teacher's name.`;

    // Step 3: Build conversation history — just the turns, not the system
    // prompt (generateChatCompletion takes that separately, matching
    // Anthropic's API shape, which is stricter about this than OpenAI's;
    // callOpenAI internally re-attaches it as a system message for that
    // provider's own request format).
    const conversationHistory: { role: "user" | "assistant"; content: string }[] = (history || []).slice(-10).map((m) => ({
      role: m.role === "teacher" ? "assistant" : "user",
      content: m.content,
    }));

    const conversationMessages = [...conversationHistory, { role: "user" as const, content: message }];

    logPayload = {
      session_id: sessionId || null,
      topic_id: topicId || null,
      grade: grade || null,
      message,
      used_curriculum_context: usedCurriculumContext,
      detected_confusion: detectedConfusion,
      retrieval_method: retrievalMethod,
    };

    // Step 4: Generate the teaching response — tries the admin-configured
    // preferred provider (platform_settings.primary_ai_provider, default
    // OpenAI) first, automatically falling back to the other provider if
    // it fails or isn't configured. Real resilience: if OpenAI has an
    // outage and ANTHROPIC_API_KEY is set, Claude picks up the very same
    // request without the pupil ever seeing a failure.
    const { data: providerSetting } = await supabase
      .from("platform_settings").select("value").eq("key", "primary_ai_provider").maybeSingle();
    const preferredProvider = providerSetting?.value === "anthropic" ? "anthropic" : "openai";

    const completion = await generateChatCompletion(systemPrompt, conversationMessages, {
      maxTokens: 300,
      temperature: 0.7,
      preferredProvider,
    });

    if (!completion.text) {
      const fallback = generateFallbackResponse(message, lessonContent);
      await logInteraction(supabase, userId, { ...logPayload, response: fallback, source: "fallback" });
      return new Response(JSON.stringify({ response: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = completion.text;
    const responseSource = completion.provider || "openai";

    await logInteraction(supabase, userId, { ...logPayload, response: aiResponse, source: responseSource });

    // Student Learning Profile (adaptive learning engine v2): detect
    // whether this exchange revealed a specific misconception, not just
    // "the pupil seemed confused." Only attempted for substantive
    // messages (skips greetings/one-word replies) to avoid a second
    // OpenAI call on every single chat turn. Never blocks the response —
    // runs after aiResponse is already being returned to the pupil.
    if (message.trim().length > 15 && topicId) {
      const mistake = await detectMistake(message, aiResponse, topicName);
      await logStudentInteraction(supabase, userId, {
        lesson_id: null, subject_id: subjectId || null, topic_id: topicId,
        interaction_type: "chat", question: null, student_response: message,
        ai_response: aiResponse, correct: null, difficulty: null,
        detected_mistake: mistake,
      });
    }

    return new Response(JSON.stringify({ response: aiResponse, source: responseSource, teacherName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Teacher chat error:", err);
    await logError(supabase, "edge_function:ai-teacher-chat", err, {}, userId);
    if (logPayload) {
      await logInteraction(supabase, userId, {
        ...logPayload,
        response: "I'm having trouble right now. Please try again in a moment.",
        source: "error",
      });
    }
    return new Response(
      JSON.stringify({ error: err.message, response: "I'm having trouble right now. Please try again in a moment.", source: "error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Continuous learning pipeline, step 1 (SRS 12.17): capture every
 * interaction. Never throws — logging failures must not break the pupil's
 * chat experience. Takes the already-resolved user id directly now that
 * auth is required for every request, rather than re-parsing the
 * Authorization header (and re-calling supabase.auth.getUser) on every
 * single log write.
 */
async function logInteraction(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  payload: Record<string, unknown>
) {
  try {
    await supabase.from("ai_interaction_logs").insert({ ...payload, user_id: userId });
  } catch (e) {
    console.error("Failed to log AI interaction (non-fatal):", e);
  }
}

/**
 * Student Learning Profile, "detect the learner's mistakes" (design doc
 * section 3): a lightweight second OpenAI call asking specifically
 * "did this exchange reveal a misconception, and what is it" — a plainer
 * classification task than teaching, so a short response and low token
 * budget are appropriate. Returns null (not an error) whenever nothing
 * useful can be said: no OPENAI_API_KEY, a request failure, or the model
 * genuinely finding no clear misconception in this exchange. Never
 * throws — this is a nice-to-have signal, not something that should ever
 * break the pupil's actual lesson.
 */
async function detectMistake(pupilMessage: string, teacherResponse: string, topicName?: string): Promise<string | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You analyze a tutoring exchange for a specific misconception (topic: ${topicName || "unknown"}). Reply with ONLY a JSON object: {"mistake": "<short phrase describing the specific misconception, or null if none is evident>"}. No markdown, no other text. Only report a mistake if one is clearly evident from the pupil's message — do not guess.`,
          },
          { role: "user", content: `Pupil said: ${pupilMessage}\n\nTeacher replied: ${teacherResponse}` },
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return typeof parsed.mistake === "string" && parsed.mistake.toLowerCase() !== "null" ? parsed.mistake : null;
  } catch {
    return null;
  }
}

/**
 * Student Learning Profile — writes the richer per-interaction record
 * (student_interactions) and, for assessable interactions, recomputes the
 * pupil's blended mastery score via the shared recompute_topic_mastery
 * SQL function (migration 20260722080000) — the same function the
 * practice page and past-paper runner call after marking an answer, so
 * mastery is computed identically everywhere rather than three slightly
 * different ways. Both student_interactions/student_topic_mastery are
 * additive: progress_records and ai_interaction_logs keep working exactly
 * as before for everything that already reads them (dashboard,
 * adaptiveLearning.ts, admin Analytics) — see the migration header
 * comment for why this isn't a replacement yet.
 */
async function logStudentInteraction(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  interaction: {
    lesson_id: string | null; subject_id: string | null; topic_id: string;
    interaction_type: string; question: string | null; student_response: string | null;
    ai_response: string | null; correct: boolean | null; difficulty: string | null;
    detected_mistake: string | null;
  }
) {
  if (!userId) return;
  try {
    await supabase.from("student_interactions").insert({ ...interaction, student_id: userId });

    // Recompute mastery only when this interaction actually carries a
    // right/wrong signal — most chat turns don't (open-ended dialogue),
    // so most calls to this function correctly leave student_topic_mastery
    // untouched rather than diluting it with non-assessable data.
    if (interaction.correct === null) return;

    // Shared with the practice page and past-paper runner (SQL migration
    // 20260722080000) rather than duplicating this math in three places.
    await supabase.rpc("recompute_topic_mastery", {
      p_student_id: userId,
      p_topic_id: interaction.topic_id,
    });
  } catch (e) {
    console.error("Failed to log student interaction (non-fatal):", e);
  }
}

function generateFallbackResponse(
  message: string,
  lessonContent?: any
): string {
  const lower = message.toLowerCase();
  const confused = ["don't understand", "confused", "hard", "help", "not sure", "what", "how", "why"].some((w) =>
    lower.includes(w)
  );

  if (lower.includes("thank") || lower.includes("great") || lower.includes("ok")) {
    return "You are doing great! Keep going. Do not hesitate to ask if anything is unclear.";
  }

  if (confused && lessonContent?.examples?.length > 0) {
    return `No worries at all! Let me try a different approach. Think about it like this: ${lessonContent.examples[0].problem}`;
  }

  if (confused) {
    return "No worries! Take it one step at a time and we will get there together. What specific part is confusing?";
  }

  return "Good effort! The key is to work through it step by step. Follow the method shown on the whiteboard.";
}
