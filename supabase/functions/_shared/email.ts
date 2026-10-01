/**
 * Shared transactional email helper, imported by send-welcome-email and
 * send-weekly-digest. Uses Resend (resend.com) — a simple HTTP API, no
 * SMTP setup, generous free tier, commonly paired with Supabase.
 *
 * Requires two secrets set on the Edge Functions (Project Settings ->
 * Edge Functions -> Secrets):
 *   RESEND_API_KEY   — from your Resend account
 *   EMAIL_FROM       — e.g. "SmartClass Zambia <hello@yourdomain.com>".
 *                       Resend requires the sending domain to be verified
 *                       (DNS records) before you can send from it — until
 *                       you've done that, Resend's own onboarding@resend.dev
 *                       address works for testing.
 *
 * Never throws — returns false on any failure (missing keys, network
 * error, provider error) so callers can log and move on rather than
 * crashing whatever triggered the email attempt.
 */

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");

  if (!apiKey || !from) {
    console.error("Email not sent — RESEND_API_KEY or EMAIL_FROM not configured.");
    return false;
  }
  if (!to) {
    console.error("Email not sent — no recipient address.");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      console.error("Resend API error:", await response.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send failed (non-fatal):", e);
    return false;
  }
}

/** Shared HTML shell so every email looks like it's from the same
 *  product rather than each function inventing its own layout. Plain
 *  inline styles throughout — email clients strip <style> blocks and
 *  ignore most CSS outside inline attributes, so this isn't optional. */
export function emailShell(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#16332B;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#16332B;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding-bottom:20px;text-align:center;">
          <span style="font-size:22px;font-weight:bold;color:#E8B94B;">SmartClass</span>
          <span style="font-size:22px;color:#F6F3EA;"> Zambia</span>
        </td></tr>
        <tr><td style="background-color:#EDE3CE;border-radius:16px;padding:28px;color:#142019;">
          <h1 style="font-size:20px;margin:0 0 12px;color:#142019;">${title}</h1>
          ${bodyHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
