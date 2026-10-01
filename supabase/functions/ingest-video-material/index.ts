import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let materialId = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase Edge Function secrets." }, 500);
    if (!apiKey) return json({ error: "Video transcription is not configured. Set OPENAI_API_KEY for this Edge Function." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authorization required." }, 401);
    const { data: userData, error: authError } = await admin.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Invalid token." }, 401);
    const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ error: "Admin access required." }, 403);

    const body = await req.json() as { material_id?: string; storage_path?: string };
    materialId = body.material_id || "";
    if (!materialId || !body.storage_path) return json({ error: "material_id and storage_path are required." }, 400);

    const { data: video, error: downloadError } = await admin.storage.from("content-materials").download(body.storage_path);
    if (downloadError || !video) throw new Error(downloadError?.message || "Could not download the uploaded video.");
    if (video.size > 25 * 1024 * 1024) throw new Error("Video files must be 25 MB or smaller for transcription.");

    const form = new FormData();
    const mimeType = video.type || "video/mp4";
    const extension = mimeType.includes("webm") ? "webm" : mimeType.includes("quicktime") ? "mov" : "mp4";
    form.append("file", new File([await video.arrayBuffer()], `lesson.${extension}`, { type: mimeType }));
    form.append("model", "whisper-1");
    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!transcriptionResponse.ok) {
      const details = await transcriptionResponse.text();
      console.error("Video transcription failed:", details);
      throw new Error(`Transcription service returned ${transcriptionResponse.status}.`);
    }
    const transcription = await transcriptionResponse.json();
    const text = typeof transcription.text === "string" ? transcription.text.trim() : "";
    if (!text) throw new Error("No speech was detected in the video.");

    const { error: updateError } = await admin.from("content_materials").update({
      storage_path: body.storage_path,
      extracted_text: text,
      content_summary: text.slice(0, 4000),
      material_type: "video",
      status: "ingested",
      ingestion_error: null,
    }).eq("id", materialId);
    if (updateError) throw updateError;

    const embedding = await generateEmbedding(text);
    if (embedding) {
      const { error: embeddingError } = await admin.from("content_materials").update({ embedding }).eq("id", materialId);
      if (embeddingError) throw embeddingError;
    }

    return json({ success: true, transcribed_characters: text.length, embedding_created: Boolean(embedding) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video ingestion failed.";
    console.error("Video material ingestion error:", error);
    if (materialId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceRoleKey) {
        await createClient(supabaseUrl, serviceRoleKey).from("content_materials").update({ status: "approved", ingestion_error: message }).eq("id", materialId);
      }
    }
    return json({ error: message }, 500);
  }
});