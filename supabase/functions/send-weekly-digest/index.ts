import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { sendEmail, emailShell } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Called weekly by pg_cron (see migration 20260720080000) — one scheduled
 * trigger, fans out to one email per opted-in pupil with any activity in
 * the last 7 days. Pupils with zero activity that week are skipped
 * entirely rather than sent an empty "you did nothing" email — a weekly
 * nag with nothing to show for it trains people to ignore or unsubscribe
 * from every future digest, including the ones that would have been worth
 * reading.
 *
 * Goes to profiles.parent_email when set, otherwise the pupil's own login
 * email — the realistic version of "parents get updates" without a
 * separate parent account system (see SRS's future Parent Dashboard).
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, grade, parent_email")
      .eq("email_notifications_enabled", true);

    if (profilesError) throw profilesError;

    let sent = 0;
    let skippedNoActivity = 0;
    let skippedNoEmail = 0;
    let failed = 0;

    for (const profile of profiles || []) {
      const [lessonsRes, attemptsRes, progressRes] = await Promise.all([
        supabase.from("lesson_sessions").select("id", { count: "exact", head: true })
          .eq("user_id", profile.id).eq("status", "completed").gte("completed_at", weekAgo),
        supabase.from("practice_attempts").select("is_correct")
          .eq("user_id", profile.id).gte("created_at", weekAgo),
        supabase.from("progress_records").select("mastery_percentage").eq("user_id", profile.id),
      ]);

      const lessonsCompleted = lessonsRes.count ?? 0;
      const attempts = attemptsRes.data || [];
      const practiceCount = attempts.length;
      const practiceCorrect = attempts.filter((a: any) => a.is_correct).length;

      if (lessonsCompleted === 0 && practiceCount === 0) {
        skippedNoActivity++;
        continue;
      }

      const masteryValues = (progressRes.data || []).map((p: any) => Number(p.mastery_percentage));
      const overallMastery = masteryValues.length > 0
        ? Math.round(masteryValues.reduce((a: number, b: number) => a + b, 0) / masteryValues.length)
        : 0;
      const accuracy = practiceCount > 0 ? Math.round((practiceCorrect / practiceCount) * 100) : null;

      let recipientEmail = profile.parent_email;
      if (!recipientEmail) {
        const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
        recipientEmail = userData.user?.email || null;
      }
      if (!recipientEmail) {
        skippedNoEmail++;
        continue;
      }

      const isParent = !!profile.parent_email;
      const firstName = (profile.full_name || "your child").split(" ")[0];
      const greeting = isParent ? `${firstName}'s week` : `Your week, ${firstName}`;

      const html = emailShell(
        greeting,
        `
          <p style="font-size:15px;line-height:1.5;">
            ${isParent ? `Here's how ${firstName} did on SmartClass Zambia this week (Form ${profile.grade}):` : `Here's how your week went on SmartClass Zambia:`}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #D8C9A3;font-size:14px;">Lessons completed</td>
              <td style="padding:10px 0;border-bottom:1px solid #D8C9A3;font-size:14px;text-align:right;font-weight:bold;">${lessonsCompleted}</td>
            </tr>
            ${practiceCount > 0 ? `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #D8C9A3;font-size:14px;">Practice questions answered</td>
              <td style="padding:10px 0;border-bottom:1px solid #D8C9A3;font-size:14px;text-align:right;font-weight:bold;">${practiceCount} (${accuracy}% correct)</td>
            </tr>` : ''}
            <tr>
              <td style="padding:10px 0;font-size:14px;">Overall mastery</td>
              <td style="padding:10px 0;font-size:14px;text-align:right;font-weight:bold;">${overallMastery}%</td>
            </tr>
          </table>
          <p style="font-size:14px;line-height:1.5;color:#5b5644;margin-bottom:0;">
            ${isParent ? 'Keep encouraging them to keep it up!' : 'Keep it up — Mr. Chomba is ready whenever you are.'}
          </p>
        `
      );

      const ok = await sendEmail(recipientEmail, isParent ? `${firstName}'s weekly progress` : 'Your weekly progress on SmartClass Zambia', html);
      if (ok) sent++;
      else failed++;
    }

    return new Response(
      JSON.stringify({ sent, skippedNoActivity, skippedNoEmail, failed, totalProfiles: (profiles || []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-weekly-digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
