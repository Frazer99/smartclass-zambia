import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GreetingRequest {
  mode?: "opening" | "checkin";
  lessonTitle: string;
  topicName?: string;
  subjectId?: string;
  grade?: number;
  /** Only used for checkin mode — what the pupil last said before going
   *  quiet, so the check-in can reference it naturally instead of being
   *  a generic "are you there?" with no context. */
  lastPupilMessage?: string;
}

/**
 * A real, AI-generated message from the teacher persona — either the
 * opening greeting for a lesson, or a proactive mid-lesson check-in when
 * the pupil has gone quiet for a while. Both replace what would
 * otherwise be silence or a fixed template with something that actually
 * sounds like a real teacher: greeting a pupil by name and referencing
 * their history at the start, or noticing when they've gone quiet and
 * checking in rather than just waiting — the same "engage like a human
 * being, not statically" principle applied to two different moments in
 * a lesson.
 *
 * Resolves the same named persona as ai-teacher-chat (by subject+grade).
 * Opening mode also looks up the pupil's most recent genuinely-past
 * struggle (a different calendar day, not the same sitting) from
 * student_interactions, so the greeting can reference it naturally.
 *
 * Deliberately NOT counted against the daily free-message quota and NOT
 * run through content moderation for either mode — neither is a pupil
 * message being screened; both are the system speaking, not the pupil.
 *
 * Falls back to a plain template (no API call) whenever
 * OPENAI_API_KEY isn't set or the OpenAI call itself fails — the same
 * graceful-degradation posture as everywhere else in this project. A
 * pupil should never see a broken or missing message because of an API
 * hiccup.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const userId = userData.user.id;

    const { mode = "opening", lessonTitle, topicName, subjectId, grade, lastPupilMessage }: GreetingRequest = await req.json();
    if (!lessonTitle) {
      return new Response(JSON.stringify({ error: "lessonTitle is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("full_name, preferred_language").eq("id", userId).maybeSingle();
    const firstName = (profile?.full_name || "there").split(" ")[0];
    const LANGUAGE_NAMES: Record<string, string> = { bem: "Bemba", nya: "Nyanja", toi: "Tonga", loz: "Lozi" };
    const preferredLanguage = profile?.preferred_language;
    const languageNote = preferredLanguage && LANGUAGE_NAMES[preferredLanguage]
      ? ` Respond primarily in ${LANGUAGE_NAMES[preferredLanguage]}, mixing in English for technical terms where natural; if you're not confident of a clear translation, use English for that part instead of guessing.`
      : "";

    // Resolve the correct named persona — same lookup as ai-teacher-chat.
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

    let pastStruggleNote = "";
    if (mode === "opening") {
      // A genuinely past struggle — a different calendar day, not the
      // same sitting — the same "returns the next day" framing from the
      // original SmartTeach design, not just "the last thing that happened".
      const { data: pastStruggle } = await supabase
        .from("student_interactions")
        .select("detected_mistake, created_at, topic:topics(name)")
        .eq("student_id", userId)
        .not("detected_mistake", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pastStruggle?.detected_mistake) {
        const struggleDay = new Date(pastStruggle.created_at).toDateString();
        const today = new Date().toDateString();
        if (struggleDay !== today) {
          const pastTopicName = (pastStruggle.topic as any)?.name;
          pastStruggleNote = pastTopicName
            ? ` The pupil last struggled with "${pastStruggle.detected_mistake}" while working on ${pastTopicName} in a previous session — naturally reference this and connect it to today's lesson if it fits, without making it feel like a checklist item.`
            : ` The pupil last struggled with "${pastStruggle.detected_mistake}" in a previous session — naturally reference this if it fits.`;
        }
      }
    }

    const templateFallback = mode === "checkin"
      ? `Are you still there, ${firstName}? Let's keep going with ${lessonTitle} whenever you're ready.`
      : pastStruggleNote
        ? `Welcome back, ${firstName}! Let's keep building on what we covered last time as we look at ${lessonTitle} today.`
        : `Hello ${firstName}! Welcome to today's lesson on ${lessonTitle}. Let us get started!`;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ greeting: templateFallback, teacherName, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const prompt = mode === "checkin"
        ? `You are ${teacherName}, an AI teacher for SmartClass Zambia. ${personaDescription}

The pupil ${firstName} has gone quiet for a little while during today's lesson on "${lessonTitle}"${topicName ? ` (topic: ${topicName})` : ""}.${lastPupilMessage ? ` The last thing they said was: "${lastPupilMessage}"` : ""}

Write a warm, brief (1-2 sentences) check-in message — notice they've been quiet and gently re-engage them, the way a real teacher would when a pupil goes quiet in the room. Don't be pushy or repeat the same question word-for-word. If you know what they were last working on, you can reference it naturally.${languageNote}

Do not use markdown formatting. Do not use placeholder brackets.`
        : `You are ${teacherName}, an AI teacher for SmartClass Zambia. ${personaDescription}

Write a warm, natural, SHORT (2-3 sentences) opening greeting for ${firstName}, who is starting today's lesson on "${lessonTitle}"${topicName ? ` (topic: ${topicName})` : ""}.${pastStruggleNote}${languageNote}

Sound like a real teacher greeting a real pupil, not a template. Do not use markdown formatting. Do not use placeholder brackets.`;

      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: prompt }],
          max_tokens: 150,
          temperature: 0.8,
        }),
      });

      if (!openaiResponse.ok) {
        return new Response(JSON.stringify({ greeting: templateFallback, teacherName, source: "fallback" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiData = await openaiResponse.json();
      const greeting = openaiData.choices?.[0]?.message?.content?.trim();

      return new Response(JSON.stringify({ greeting: greeting || templateFallback, teacherName, source: greeting ? "openai" : "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("generate-greeting OpenAI call failed (falling back to template):", e);
      return new Response(JSON.stringify({ greeting: templateFallback, teacherName, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("generate-greeting error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
