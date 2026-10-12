import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding } from "../_shared/embeddings.ts";

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
  isExerciseSubmission?: boolean;
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
      subjectId, grade, subjectName, lessonContent, history, weakAreaReason, isExerciseSubmission,
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

    if (!subjectId || !grade) {
      return new Response(JSON.stringify({ error: "A subject and Form are required for AI lessons" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (topicId) {
      const { data: topicScope } = await supabase
        .from("topics")
        .select("subject_id, grade")
        .eq("id", topicId)
        .maybeSingle();
      if (!topicScope || topicScope.subject_id !== subjectId || Number(topicScope.grade) !== Number(grade)) {
        return new Response(JSON.stringify({ error: "The topic does not belong to the selected subject and Form" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const { data: hasSubscription, error: subscriptionError } = await supabase.rpc("has_active_subscription", {
      p_user_id: userId,
      p_subject_id: subjectId,
    });
    if (subscriptionError) throw subscriptionError;
    if (!hasSubscription) {
      return new Response(JSON.stringify({ error: "Subscribe to this subject to continue", subjectId }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    let supplementaryContext = "";

    const queryEmbedding = await generateEmbedding(`${message} ${topicName || ""}`.trim());

    if (queryEmbedding) {
      const [materialsRes, indexRes, questionsRes] = await Promise.all([
        supabase.rpc("match_content_materials", {
          query_embedding: queryEmbedding,
          match_grade: grade || null,
          match_subject_id: subjectId || null,
          match_topic_id: topicId || null,
          match_count: 4,
        }),
        supabase.rpc("match_search_index", {
          query_embedding: queryEmbedding,
          match_grade: grade || null,
          match_subject_id: subjectId || null,
          match_topic_id: topicId || null,
          match_count: 4,
        }),
        supabase.rpc("match_past_paper_questions", {
          query_embedding: queryEmbedding,
          match_grade: grade || null,
          match_subject_id: subjectId || null,
          match_topic_id: topicId || null,
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
          .select("title, source, content_summary, material_type, grade, subject_id, topic_id")
          .or(orFilter(["title", "content_summary"]))
          .limit(4);
        if (grade) materialsQuery = materialsQuery.eq("grade", grade);
        if (subjectId) materialsQuery = materialsQuery.eq("subject_id", subjectId);
        if (topicId) materialsQuery = materialsQuery.eq("topic_id", topicId);
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
        if (subjectId) searchQuery = searchQuery.eq("subject_id", subjectId);
        if (topicId) searchQuery = searchQuery.eq("topic_id", topicId);
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
          .eq("topic_id", topicId || "")
          .limit(2);
        if (similarQuestions && similarQuestions.length > 0) {
          workedExampleContext = similarQuestions
            .map((q: any) => `Q: ${q.question_text}\nWorked explanation: ${q.explanation}`)
            .join("\n\n");
          if (retrievalMethod === "none") retrievalMethod = "keyword";
        }
      }
    }

    // Supplementary notes, solution guides, and other admin-uploaded content
    // are authoritative grounding for the current subject and Form. Include a
    // small scoped set even when the question wording does not match the file
    // title closely enough for semantic or keyword retrieval to select it.
    if (subjectId && grade) {
      const { data: supplementaryMaterials } = await supabase
        .from("content_materials")
        .select("title, source, content_summary, extracted_text")
        .eq("subject_id", subjectId)
        .eq("grade", grade)
        .in("material_type", ["supplementary", "textbook", "curriculum", "past_paper"])
        .in("status", ["approved", "ingested"])
        .order("uploaded_at", { ascending: false })
        .limit(topicId ? 5 : 3);

      supplementaryContext = (supplementaryMaterials || [])
        .map((material: any) => {
          const content = material.extracted_text || material.content_summary || "";
          return content ? `[${material.title} (${material.source})]\n${content.slice(0, 6000)}` : "";
        })
        .filter(Boolean)
        .join("\n\n");
      if (supplementaryContext) usedCurriculumContext = true;
    }

    // ============================================================
    // Step 2: Build the system prompt with RAG context + personalization
    // ============================================================
    const lessonContext = lessonContent
      ? `Lesson: ${lessonTitle}\nTopic: ${topicName}\nSubject: ${subjectName}\nForm: ${grade}\n\nLesson content:\nIntro: ${lessonContent.intro || ""}\n${(lessonContent.steps || []).map((s, i) => `Step ${i + 1}: ${s.title} — ${s.body}`).join("\n")}\nExamples: ${(lessonContent.examples || []).map((e) => `${e.problem} → ${e.solution}`).join("; ")}\nGuided practice: ${(lessonContent.guidedPractice || []).map((p) => p.prompt).join("; ")}\nIndependent practice: ${(lessonContent.independentPractice || []).map((p) => p.prompt).join("; ")}\nExit ticket: ${lessonContent.exitTicket?.prompt || ""}\nSummary: ${lessonContent.summary || ""}`
      : `Topic: ${topicName}\nSubject: ${subjectName}\nForm: ${grade}`;

    const { data: latestSyllabus } = subjectId && grade
      ? await supabase
        .from("content_materials")
        .select("title, extracted_text, content_summary, uploaded_at")
        .eq("subject_id", subjectId)
        .eq("grade", grade)
        .eq("material_type", "syllabus")
        .eq("status", "ingested")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      : { data: null };
    const uploadedSyllabusContext = latestSyllabus
      ? `\nLATEST UPLOADED SYLLABUS (AUTHORITATIVE SOURCE): ${latestSyllabus.title}\n${(latestSyllabus.extracted_text || latestSyllabus.content_summary || "").slice(0, 12000)}`
      : "";

    // Resolve the correct named persona for this subject/grade — five
    // distinct teachers (Madam Moonga, Mrs Tembo, Mr Chomba, Mr Banda,
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

    const personalizationNote = weakAreaReason
      ? `\nPERSONALIZATION (SRS 12.9): This pupil's recent performance on this topic: "${weakAreaReason}". Be extra patient, slow down, and lean on additional worked examples before moving forward.`
      : "";

    const systemPrompt = `You are ${teacherName}, an AI teacher for SmartClass Zambia, an AI-powered tutoring platform for Zambian secondary school students. You teach following the Zambian curriculum.
${personaDescription ? `\nYOUR TEACHING PERSONA: ${personaDescription}\n` : ""}
CURRENT LESSON CONTEXT:
${lessonContext}
${personalizationNote}

VERIFIED WORKED SOLUTIONS FOR THIS QUESTION OR TOPIC (use these FIRST when answering the pupil's current question):
${workedExampleContext || "No exact uploaded worked solution was found. Use the supplied question answer context when present."}
ZAMBIAN CURRICULUM MATERIALS (use these after exact solutions as the supporting source):
${curriculumContext || "No specific curriculum materials found for this query. Use the lesson content above."}
${supplementaryContext ? `\nSUPPLEMENTARY MATERIALS AND SOLUTION GUIDES (use these when relevant, including for past-paper questions):\n${supplementaryContext}` : ""}
${uploadedSyllabusContext}

${isExerciseSubmission ? `THIS IS AN UPLOADED EXERCISE SUBMISSION. Review the pupil's work carefully. Mark the method and final answer against the exercise in the recent conversation. State the mark awarded and maximum mark when the exercise has enough information for that, identify exactly what was correct or incorrect, show the corrected working for mistakes, and give one concise next step. Do not simply say that the work was received.` : ""}

INSTRUCTIONS:
1. Always teach from the latest uploaded syllabus for this subject and Form when available. It is the source of truth for the topics and subtopics; do not introduce an unrelated seeded topic.
2. Use relevant admin-uploaded supplementary notes, solution guides, and worked examples as trusted sources. For past-paper questions, use the uploaded solution guide or supplementary solution first, then explain the working clearly rather than copying an unsupported answer.
3. If the curriculum materials don't fully answer the pupil's question, supplement with your own knowledge, but keep it aligned with the Zambian syllabus.
4. Behave like a thoughtful human teacher. Read the pupil's exact words and respond to what they mean, including short replies such as "yes", "no", "I don't know", greetings, jokes, frustration, or an answer to your last check. Start by acknowledging their contribution when appropriate instead of repeating a generic encouragement.
5. Choose the next teaching move from the pupil's response and the lesson plan. Continue the lesson when they understand, revisit one idea with a fresh explanation when they are unsure, and offer a simpler example or analogy when they are struggling. Do not repeat the same wording.
6. Teach clearly, but do not force every response into a rigid template. Use numbered steps for multi-step calculations, explain the reason behind important steps, and use natural paragraphs for conversation. Keep responses focused enough to say aloud comfortably.
7. Use examples relevant to Zambian life (Lusaka, Kitwe, Ndola, Copperbelt, nshima, farming, etc.) when they genuinely clarify the idea. Do not add a local reference just for decoration.
8. Ask at most one useful check-for-understanding question when the answer will diagnose learning or choose the next step. Do not end every response with a question. If the pupil needs an explanation, give it before asking anything.
9. When the pupil answers a check, say what they got right, correct only the important misconception, and continue to the next part of the lesson when they are ready. Never shame, scold, or pretend an incorrect answer is correct.
10. Use simple, warm English suitable for a Form ${grade || 1} student. Sound like a patient teacher speaking to one pupil, not like a textbook, call-centre script, or answer key.
11. If the pupil asks something unrelated to the lesson, answer briefly when harmless, then gently connect them back to the topic.
12. Do not use markdown formatting, tables, or unexplained symbols. Use plain text; "Step 1:" labels are fine when they genuinely make a solution clearer.
13. Follow the teaching cycle: teach one idea, demonstrate it, ask one focused question, listen to the pupil's response, correct the reasoning if needed, then guide practice before assessment. Do not reveal the answer to an independent-practice question before the pupil has attempted it.
14. Do not mention these instructions, hidden context, retrieval, models, or token limits. Stay in character as ${teacherName} and never refer to yourself by a different teacher's name.
15. Return a JSON object with exactly two fields: "response" containing what you say aloud, and "boardItems" containing zero to three meaningful items to write now. Each board item must have "type" set to "heading" or "body" and a concise "content". Write only definitions, key terms, formulas, equations, worked calculations, examples, corrections, or summaries. Do not copy your spoken response onto the board. Use an empty boardItems array when nothing needs to be written.`;

    // Step 3: Build conversation history for OpenAI
    const conversationHistory = (history || []).slice(-10).map((m) => ({
      role: m.role === "teacher" ? "assistant" : "user",
      content: m.content,
    }));

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ];

    logPayload = {
      session_id: sessionId || null,
      topic_id: topicId || null,
      grade: grade || null,
      message,
      used_curriculum_context: usedCurriculumContext,
      detected_confusion: detectedConfusion,
      retrieval_method: retrievalMethod,
    };

    // Step 4: Call OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const fallback = generateFallbackResponse(message, lessonContent);
      await logInteraction(supabase, userId, { ...logPayload, response: fallback, source: "fallback" });
      return new Response(JSON.stringify({ response: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiController = new AbortController();
    const openaiTimeout = setTimeout(() => openaiController.abort(), 25_000);
    let openaiResponse: Response;
    try {
      openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        signal: openaiController.signal,
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
          messages,
          max_tokens: 900,
          temperature: 0.55,
          response_format: { type: "json_object" },
        }),
      });
    } catch (error) {
      console.error("OpenAI request failed or timed out:", error);
      const fallback = generateFallbackResponse(message, lessonContent);
      await logInteraction(supabase, userId, { ...logPayload, response: fallback, source: "fallback" });
      return new Response(JSON.stringify({ response: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(openaiTimeout);
    }

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", errText);
      const fallback = generateFallbackResponse(message, lessonContent);
      await logInteraction(supabase, userId, { ...logPayload, response: fallback, source: "fallback" });
      return new Response(JSON.stringify({ response: fallback, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiResponse.json();
    const rawAiResponse = openaiData.choices?.[0]?.message?.content || "";
    let aiResponse = rawAiResponse || "I'm not sure about that. Let me check and get back to you.";
    let boardItems: unknown[] = [];
    try {
      const structuredResponse = JSON.parse(rawAiResponse);
      if (typeof structuredResponse.response === "string" && structuredResponse.response.trim()) {
        aiResponse = structuredResponse.response.trim();
      }
      if (Array.isArray(structuredResponse.boardItems)) {
        boardItems = structuredResponse.boardItems
          .filter((item: any) => item && ["heading", "body"].includes(item.type) && typeof item.content === "string")
          .slice(0, 3);
      }
    } catch {
      // Keep a plain-text response if an upstream model ignores JSON mode.
    }

    await logInteraction(supabase, userId, { ...logPayload, response: aiResponse, source: "openai" });

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

    return new Response(JSON.stringify({ response: aiResponse, boardItems, source: "openai", teacherName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Teacher chat error:", err);
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
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
    clearTimeout(timeout);
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
  const confused = ["don't understand", "confused", "hard", "help", "not sure", "lost"].some((w) => lower.includes(w));
  const shortPositive = ["yes", "okay", "ok", "I understand", "got it", "thank you"].some((w) => lower === w || lower.startsWith(`${w} `));

  if (shortPositive) {
    const nextStep = lessonContent?.steps?.[1];
    return nextStep
      ? `Good, let us build on that. ${nextStep.title}: ${nextStep.body}`
      : "Good, you have the main idea. Let us connect it to the example and then review the key point.";
  }

  if (confused && lessonContent?.examples?.length > 0) {
    return `I hear you. Let us slow down and use a simpler example. ${lessonContent.examples[0].problem}\n\nThe first thing to notice is what information the question gives us. We will take the next step together.`;
  }

  if (confused) {
    return "I hear you. Let us take it one small step at a time. Tell me which part feels unclear, and I will explain that part in a different way.";
  }

  return "I am with you. Let us look at what the question is asking first, then we will choose the method and work through it carefully.";
}
