import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GreetingRequest {
  lessonTitle: string;
  topicName?: string;
  subjectId?: string;
  grade?: number;
}

/**
 * A real, AI-generated opening greeting for a lesson — replacing what
 * was previously a fixed template. The teaching conversation that
 * follows (ai-teacher-chat) was always a genuine live conversation; this
 * function closes the one place that wasn't — the very first thing a
 * pupil saw before saying anything at all felt scripted, which is
 * exactly the wrong first impression for something meant to feel like a
 * real teacher.
 *
 * Resolves the same named persona as ai-teacher-chat (by subject+grade)
 * and looks up the pupil's most recent genuinely-past struggle (a
 * different calendar day, not the same sitting) from
 * student_interactions, so the greeting can reference it naturally in
 * the teacher's own words rather than a fixed sentence shape every time.
 *
 * Deliberately NOT counted against the daily free-message quota and NOT
 * run through content moderation — this isn't a pupil message being
 * screened, it's the system introducing the lesson before the pupil has
 * said anything to screen.
 *
 * Falls back to a plain templated greeting (no API call) whenever
 * OPENAI_API_KEY isn't set or the OpenAI call itself fails — the same
 * graceful-degradation posture as everywhere else in this project. A
 * pupil should never see a broken or missing greeting because of an API
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

    const { lessonTitle, topicName, subjectId, grade }: GreetingRequest = await req.json();
    if (!lessonTitle) {
      return new Response(JSON.stringify({ error: "lessonTitle is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const firstName = (profile?.full_name || "there").split(" ")[0];

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

    // A genuinely past struggle — a different calendar day, not the same
    // sitting — the same "returns the next day" framing from the
    // original SmartTeach design, not just "the last thing that happened".
    let pastStruggleNote = "";
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

    const templateFallback = pastStruggleNote
      ? `Welcome back, ${firstName}! Let's keep building on what we covered last time as we look at ${lessonTitle} today.`
      : `Hello ${firstName}! Welcome to today's lesson on ${lessonTitle}. Let us get started!`;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ greeting: templateFallback, teacherName, source: "fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const prompt = `You are ${teacherName}, an AI teacher for SmartClass Zambia. ${personaDescription}

Write a warm, natural, SHORT (2-3 sentences) opening greeting for ${firstName}, who is starting today's lesson on "${lessonTitle}"${topicName ? ` (topic: ${topicName})` : ""}.${pastStruggleNote}

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
