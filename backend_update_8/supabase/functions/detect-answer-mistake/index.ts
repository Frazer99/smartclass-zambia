import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DetectMistakeRequest {
  questionText: string;
  correctAnswer: string;
  submittedAnswer: string;
  topicName?: string;
  subjectName?: string;
}

/**
 * Structured-answer counterpart to the mistake detection already inline
 * in ai-teacher-chat (its detectMistake() infers a misconception from
 * open conversation, with no ground truth to check against). Here we
 * actually know the correct answer, which makes for a more reliable
 * classification than inference alone — e.g. distinguishing "added
 * instead of subtracting" from "arithmetic slip" from "misread the
 * question" is much easier to call with both answers in hand.
 *
 * Called by the practice page and past-paper runner only when an answer
 * is wrong (a correct answer has no misconception to classify) — kept as
 * its own Edge Function rather than folded into ai-teacher-chat because
 * the frontend can't safely call OpenAI directly (the API key is a
 * server-side secret), and this input shape (question + correct answer +
 * submitted answer) is genuinely different from ai-teacher-chat's
 * conversational one, not just the same logic moved.
 *
 * Requires a valid Supabase session, same baseline as every other
 * function in this project — no separate rate limit, since this is only
 * ever called on wrong answers, which are already naturally bounded by
 * how many practice/past-paper questions a pupil can submit.
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

    const { questionText, correctAnswer, submittedAnswer, topicName, subjectName }: DetectMistakeRequest = await req.json();
    if (!questionText || !correctAnswer || !submittedAnswer) {
      return new Response(JSON.stringify({ error: "questionText, correctAnswer, and submittedAnswer are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      // No key configured — same graceful-degradation posture as
      // everywhere else OPENAI_API_KEY is optional: return null rather
      // than an error, so callers can just skip the field.
      return new Response(JSON.stringify({ mistake: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mistake = await classifyMistake(openaiKey, questionText, correctAnswer, submittedAnswer, topicName, subjectName);

    return new Response(JSON.stringify({ mistake }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("detect-answer-mistake error:", err);
    // A pupil's wrong answer is already saved by the time this runs
    // (practice_attempts / past_paper_attempts happen first in both
    // callers) — a failure here should never look like a bigger problem
    // than "we couldn't classify this one," so 200 with mistake: null
    // rather than a 500 the frontend has to specially handle.
    return new Response(JSON.stringify({ mistake: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function classifyMistake(
  openaiKey: string,
  questionText: string,
  correctAnswer: string,
  submittedAnswer: string,
  topicName?: string,
  subjectName?: string
): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You classify a pupil's incorrect answer to identify the specific misconception, for a ${subjectName || "Mathematics"} question on ${topicName || "this topic"}. Compare the submitted answer to the correct answer and infer the likely reasoning error (e.g. "added instead of subtracting the constant term", "sign error when dividing by a negative", "used the wrong formula"). Reply with ONLY a JSON object: {"mistake": "<short phrase, under 12 words>"}. If no clear pattern is evident (e.g. the answer looks like a random guess or is blank), reply {"mistake": null}. No markdown, no other text.`,
          },
          {
            role: "user",
            content: `Question: ${questionText}\nCorrect answer: ${correctAnswer}\nPupil's answer: ${submittedAnswer}`,
          },
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
