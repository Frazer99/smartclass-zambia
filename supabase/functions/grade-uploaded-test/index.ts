import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: authError } = await admin.auth.getUser(authHeader?.replace(/^Bearer\s+/i, "") || "");
    if (authError || !userData.user) return json({ error: "Your session is invalid or expired." }, 401);
    const { topicId, questionIds, submittedText } = await req.json();
    if (!topicId || !Array.isArray(questionIds) || questionIds.length === 0 || questionIds.length > 20 || !submittedText?.trim()) {
      return json({ error: "A topic, questions, and submitted answers are required." }, 400);
    }
    if (submittedText.length > 30000) return json({ error: "The uploaded answer sheet is too long to mark." }, 400);
    const { data: topic } = await admin.from("topics").select("id, name, subject_id, grade").eq("id", topicId).maybeSingle();
    if (!topic) return json({ error: "Topic not found." }, 404);
    const { data: profile } = await admin.from("profiles").select("grade").eq("id", userData.user.id).maybeSingle();
    if (!profile || Number(profile.grade) !== Number(topic.grade)) return json({ error: "This test is not available for your Form." }, 403);
    const { data: hasSubscription, error: subscriptionError } = await admin.rpc("has_active_subscription", { p_user_id: userData.user.id, p_subject_id: topic.subject_id });
    if (subscriptionError) throw subscriptionError;
    if (!hasSubscription) return json({ error: "Subscribe to this subject to continue." }, 402);
    const { data: allowed, error: rateLimitError } = await admin.rpc("consume_uploaded_test_rate_limit", { p_user_id: userData.user.id, p_limit: 5 });
    if (rateLimitError) throw rateLimitError;
    if (!allowed) return json({ error: "Too many uploaded tests. Please try again later." }, 429);
    const { data: questions, error: questionsError } = await admin.from("practice_questions").select("id, question_text, answer_key").in("id", questionIds).eq("topic_id", topicId);
    if (questionsError) throw questionsError;
    if (!questions || questions.length !== questionIds.length) return json({ error: "Invalid questions for this topic." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Uploaded-answer marking is not configured yet. Please answer the test online." }, 503);
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: `You mark a ${topic.name} test. Match numbered answers in the pupil's work to the supplied questions. Award 1 mark only for a correct answer; accept equivalent mathematical wording or units. Return only JSON: {"marks":[{"question":"...","awarded":0,"maximum":1,"feedback":"brief feedback"}]}. Include one item per question, never invent answers.` }, { role: "user", content: JSON.stringify({ questions, submittedText }) }], max_tokens: 1800 }) });
    if (!response.ok) return json({ error: "The marking service is temporarily unavailable." }, 502);
    const payload = await response.json();
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || "{}");
    const marks = Array.isArray(parsed.marks) ? parsed.marks : [];
    if (topicId) {
      await admin.from("test_submissions").insert({
        user_id: userData.user.id,
        topic_id: topicId,
        source: "upload",
        submitted_text: submittedText,
        marks,
        score: marks.reduce((sum: number, mark: { awarded?: number }) => sum + Number(mark.awarded || 0), 0),
        maximum_score: marks.reduce((sum: number, mark: { maximum?: number }) => sum + Number(mark.maximum || 0), 0),
      });
    }
    return json({ marks });
  } catch (error) { console.error("grade-uploaded-test error", error); return json({ error: "The uploaded answers could not be marked." }, 500); }
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }