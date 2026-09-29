import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { verifyToken } from "../_shared/dpo.ts";
import { logError } from "../_shared/errorLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyPaymentRequest {
  transToken: string;
}

/**
 * Called after the pupil returns from DPO's hosted payment page
 * (redirectURL points to /subscribe/complete, which calls this function
 * with the transToken DPO included in the redirect). Never trusts that
 * redirect alone — a redirect URL can be replayed or spoofed by anyone
 * who knows its shape. This re-checks the real payment status directly
 * with DPO via a server-to-server call, which cannot be spoofed the same
 * way, before ever marking a payment completed or activating a
 * subscription.
 *
 * Idempotent: calling this twice for an already-completed payment just
 * returns the existing result rather than creating a second
 * subscription — a pupil refreshing the confirmation page shouldn't
 * double-extend their subscription.
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

    const { transToken }: VerifyPaymentRequest = await req.json();
    if (!transToken) {
      return new Response(JSON.stringify({ error: "transToken is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_token", transToken)
      .eq("user_id", userId) // ownership check — a pupil can only verify their own payment's token
      .maybeSingle();

    if (!payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already resolved — idempotent short-circuit, don't re-verify or
    // create a second subscription for a page refresh.
    if (payment.status === "completed") {
      return new Response(JSON.stringify({ paid: true, alreadyProcessed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dpoCompanyToken = Deno.env.get("DPO_COMPANY_TOKEN");
    if (!dpoCompanyToken) {
      return new Response(JSON.stringify({ error: "Payments are not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await verifyToken(dpoCompanyToken, transToken);

    if (!result.success) {
      return new Response(JSON.stringify({ paid: false, error: result.resultExplanation || "Could not verify payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!result.paid) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return new Response(JSON.stringify({ paid: false, reason: result.resultExplanation || "Payment not completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment genuinely confirmed by DPO — create or extend the
    // subscription. A new subscription starts from now; an existing
    // active one gets 30 days added to its current expiry rather than
    // reset from today, so paying early never costs a pupil days they
    // already had.
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const baseDate = existingSub?.expires_at && new Date(existingSub.expires_at) > new Date()
      ? new Date(existingSub.expires_at)
      : new Date();
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    let subscriptionId: string;
    if (existingSub) {
      await supabase.from("subscriptions").update({ expires_at: newExpiry.toISOString() }).eq("id", existingSub.id);
      subscriptionId = existingSub.id;
    } else {
      const { data: newSub } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId, status: "active", plan_type: "monthly",
          is_bonus_grant: false, amount_paid: payment.amount, currency: payment.currency,
          expires_at: newExpiry.toISOString(),
        })
        .select()
        .single();
      subscriptionId = newSub!.id;
    }

    await supabase
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        provider_ref: result.transRef || null,
        subscription_id: subscriptionId,
      })
      .eq("id", payment.id);

    return new Response(JSON.stringify({ paid: true, expiresAt: newExpiry.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-payment error:", err);
    try {
      const errSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logError(errSupabase, "edge_function:verify-payment", err);
    } catch (logErr) {
      console.error("Failed to log error (non-fatal):", logErr);
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
