import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendEmail, emailShell } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WelcomeEmailRequest {
  userId: string;
  fullName: string;
}

/**
 * Called by the trg_welcome_email database trigger (see migration
 * 20260720080000) right after a new profiles row is inserted — not by the
 * frontend. This function trusts that call (it comes from Postgres with
 * the service role key, the same authority that can bypass RLS entirely)
 * rather than re-deriving the user's email from a request the pupil's
 * browser could forge; it looks up the real address itself via
 * auth.admin.getUserById using the service role client.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, fullName }: WelcomeEmailRequest = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) {
      console.error("Could not resolve email for welcome email:", userError);
      return new Response(JSON.stringify({ sent: false, reason: "user email not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (fullName || "there").split(" ")[0];
    const html = emailShell(
      `Welcome, ${firstName}!`,
      `
        <p style="font-size:15px;line-height:1.5;">
          Your account is ready. Mr. Chomba, your AI teacher, is waiting whenever you want to start —
          pick a subject, work through a lesson at your own pace, or jump into practice questions.
        </p>
        <p style="font-size:15px;line-height:1.5;">
          If you ever have questions about a topic, just ask right there in the lesson chat — Mr. Chomba
          teaches from the Zambian Curriculum and will explain things a different way if the first one
          doesn't click.
        </p>
        <p style="font-size:15px;line-height:1.5;margin-bottom:0;">
          Good luck with your studies!<br/>— SmartClass Zambia
        </p>
      `
    );

    const sent = await sendEmail(userData.user.email, "Welcome to SmartClass Zambia", html);

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-welcome-email error:", err);
    // Never a hard failure from this function's perspective — it's called
    // fire-and-forget from a database trigger with nothing waiting on the
    // response, so there's no one for a 500 to usefully report to.
    return new Response(JSON.stringify({ sent: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
