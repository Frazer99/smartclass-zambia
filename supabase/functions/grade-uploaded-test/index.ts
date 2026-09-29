import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: authError } = await admin.auth.getUser(authHeader?.replace("Bearer ", "") || "");
    if (authError || !userData.user) return json({ error: "Your session is invalid or expired." }, 401);
    const { topicId, topicName, questions, submittedText } = await req.json();
    if (!Array.isArray(questions) || !submittedText?.trim()) return json({ error: "Questions and submitted answers are required." }, 400);
    if (submittedText.length > 30000) return json({ error: "The uploaded answer sheet is too long to mark." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Uploaded-answer marking is not configured yet. Please answer the test online." }, 503);
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: `You mark a ${topicName || "school"} test. Match numbered answers in the pupil's work to the supplied questions. Award 1 mark only for a correct answer; accept equivalent mathematical wording or units. Return only JSON: {"marks":[{"question":"...","awarded":0,"maximum":1,"feedback":"brief feedback"}]}. Include one item per question, never invent answers.` }, { role: "user", content: JSON.stringify({ questions, submittedText }) }], max_tokens: 1800 }) });
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