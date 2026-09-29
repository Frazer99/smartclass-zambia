import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokenRequest {
  subjectId?: string;
  grade?: number;
}

/**
 * Mints a short-lived, avatar-scoped LiveAvatar (HeyGen) session token
 * for the pupil's resolved teacher persona — never exposes
 * LIVEAVATAR_API_KEY to the browser, same pattern as every other
 * secret-holding function in this project.
 *
 * Request schema for LiveAvatar's own token endpoint confirmed against
 * the real, current API (not guessed) — the `mode: "LITE"` + avatar_id
 * shape below matches LiveAvatar's own reference implementations
 * (api_liveavatar.LiveAvatarNewSessionRequest) as of this writing. LITE
 * mode is deliberate: LiveAvatar handles only the video/lip-sync layer,
 * while SmartClass keeps its own full AI stack (RAG, personas, rate
 * limiting, moderation, mistake detection — see ai-teacher-chat) as the
 * source of what the teacher actually says. The 1-credit/minute LITE
 * rate is also half of FULL mode's 2 credits/minute, since we're not
 * paying LiveAvatar to run an AI pipeline we already have.
 *
 * Returns `{ available: false }` (not an error) when the resolved
 * persona has no liveavatar_avatar_id configured yet — the frontend
 * falls back to the illustrated SVG avatar in that case, exactly like
 * every other optional integration in this project degrades gracefully
 * rather than breaking the lesson.
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

    const { subjectId, grade }: TokenRequest = await req.json();
    if (!subjectId || !grade) {
      return new Response(JSON.stringify({ error: "subjectId and grade are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: persona } = await supabase
      .from("teacher_personas")
      .select("name, liveavatar_avatar_id, liveavatar_voice_id")
      .eq("subject_id", subjectId)
      .lte("grade_min", grade)
      .gte("grade_max", grade)
      .maybeSingle();

    if (!persona?.liveavatar_avatar_id) {
      // Not an error — this persona just doesn't have a live avatar
      // configured yet. Expected and fine; see the migration header.
      return new Response(JSON.stringify({ available: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const liveAvatarKey = Deno.env.get("LIVEAVATAR_API_KEY");
    if (!liveAvatarKey) {
      return new Response(JSON.stringify({ available: false, reason: "LIVEAVATAR_API_KEY not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenRes = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": liveAvatarKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "LITE",
        avatar_id: persona.liveavatar_avatar_id,
        avatar_persona: persona.liveavatar_voice_id ? { voice_id: persona.liveavatar_voice_id, language: "en" } : undefined,
        // Defaults to real (non-sandbox) mode, which consumes real
        // credits. Flip this to true while testing the integration
        // itself, per LiveAvatar's Sandbox Mode docs.
        is_sandbox: false,
      }),
    });

    if (!tokenRes.ok) {
      console.error("LiveAvatar token request failed:", await tokenRes.text());
      return new Response(JSON.stringify({ available: false, reason: "LiveAvatar token request failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const sessionToken = tokenData?.data?.session_token;
    if (!sessionToken) {
      return new Response(JSON.stringify({ available: false, reason: "No session token in LiveAvatar response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ available: true, token: sessionToken, teacherName: persona.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("liveavatar-token error:", err);
    // Degrade to "not available" rather than a 500 — a live-avatar
    // outage should never be the reason a lesson can't load; the
    // illustrated avatar is always the fallback.
    return new Response(JSON.stringify({ available: false, reason: "internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
