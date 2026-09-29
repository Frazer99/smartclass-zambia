import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData, error: authError } = await admin.auth.getUser(token || "");
    if (authError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

    const { audioPath } = await req.json();
    if (typeof audioPath !== "string" || !audioPath.startsWith(`${userData.user.id}/`)) {
      return json({ error: "Invalid recording path." }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Transcription is not configured." }, 503);
    const { data: audio, error: downloadError } = await admin.storage.from("feedback-recordings").download(audioPath);
    if (downloadError || !audio) return json({ error: "The recording could not be read." }, 400);

    const form = new FormData();
    const audioType = audio.type || "audio/webm";
    const extension = audioType.includes("mp4") || audioType.includes("m4a") ? "m4a" : audioType.includes("ogg") ? "ogg" : "webm";
    form.append("file", new File([await audio.arrayBuffer()], `feedback.${extension}`, { type: audioType }));
    form.append("model", "whisper-1");
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("OpenAI transcription failed:", response.status, details);
      return json({ error: `Transcription service returned ${response.status}.` }, 502);
    }
    const result = await response.json();
    return json({ text: typeof result.text === "string" ? result.text : "" });
  } catch (error) {
    console.error("transcribe-feedback error", error);
    return json({ error: "The recording could not be transcribed." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}