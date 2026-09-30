import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { verifyToken } from "../_shared/dpo.ts";
import { getRequestStatus } from "../_shared/mtn.ts";
import { getPaymentStatus as getAirtelPaymentStatus } from "../_shared/airtel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);
    const { data: userData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !userData.user) return json({ error: "Invalid or expired session" }, 401);

    const { transToken, childId } = await req.json() as { transToken?: string; childId?: string | null };
    if (!transToken) return json({ error: "transToken is required" }, 400);
    let userId = userData.user.id;
    if (childId) {
      const { data: link } = await supabase.from("parent_child_links").select("child_id").eq("parent_id", userId).eq("child_id", childId).maybeSingle();
      if (!link) return json({ error: "You can only verify a linked child's payment" }, 403);
      userId = childId;
    }
    const { data: payment } = await supabase.from("payments").select("*").eq("provider_token", transToken).eq("user_id", userId).maybeSingle();
    if (!payment) return json({ error: "Payment not found" }, 404);
    if (!payment.subject_id) return json({ error: "This payment has no subject. Contact support before retrying." }, 409);
    if (payment.status === "completed") return json({ paid: true, alreadyProcessed: true });

    let paid = false;
    let providerRef: string | null = null;
    let reason = "Payment is still pending";
    let shouldFail = false;
    if (payment.provider === "mtn_momo") {
      const result = await getRequestStatus(transToken);
      paid = result.status === "SUCCESSFUL";
      providerRef = result.financialTransactionId || null;
      reason = result.status === "PENDING" ? "Approve the payment request on your MTN phone." : `MTN payment status: ${result.status}`;
      shouldFail = result.status !== "PENDING" && !paid;
    } else if (payment.provider === "airtel_money") {
      const result = await getAirtelPaymentStatus(transToken);
      const normalizedStatus = result.status.toUpperCase();
      paid = normalizedStatus === "SUCCESS" || normalizedStatus === "SUCCESSFUL";
      providerRef = result.reference || transToken;
      reason = paid ? "Airtel Money payment completed." : normalizedStatus === "PENDING" ? "Approve the payment request on your Airtel phone." : `Airtel Money status: ${result.status}`;
      shouldFail = normalizedStatus !== "PENDING" && normalizedStatus !== "IN_PROGRESS" && !paid;
    } else {
      const companyToken = Deno.env.get("DPO_COMPANY_TOKEN");
      if (!companyToken) return json({ error: "Card payments are not configured" }, 503);
      const result = await verifyToken(companyToken, transToken);
      if (!result.success) return json({ paid: false, error: result.resultExplanation || "Could not verify payment" });
      paid = result.paid;
      providerRef = result.transRef || null;
      reason = result.resultExplanation || "Payment was not completed";
      shouldFail = !paid;
    }
    if (!paid) {
      if (shouldFail) await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ paid: false, pending: !shouldFail, reason });
    }

    const { data: existingSub } = await supabase.from("subscriptions").select("*").eq("user_id", userId).eq("subject_id", payment.subject_id).eq("status", "active").maybeSingle();
    const baseDate = existingSub?.expires_at && new Date(existingSub.expires_at) > new Date() ? new Date(existingSub.expires_at) : new Date();
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    let subscriptionId = existingSub?.id;
    if (existingSub) {
      const { error } = await supabase.from("subscriptions").update({ expires_at: newExpiry, amount_paid: payment.amount, currency: payment.currency }).eq("id", existingSub.id);
      if (error) return json({ error: "Could not activate subscription" }, 500);
    } else {
      const { data: subscription, error } = await supabase.from("subscriptions").insert({
        user_id: userId, subject_id: payment.subject_id, status: "active", plan_type: "monthly", is_bonus_grant: false,
        amount_paid: payment.amount, currency: payment.currency, expires_at: newExpiry,
      }).select("id").single();
      if (error || !subscription) return json({ error: "Could not activate subscription" }, 500);
      subscriptionId = subscription.id;
    }

    const { error: paymentError } = await supabase.from("payments").update({
      status: "completed", completed_at: new Date().toISOString(), provider_ref: providerRef, subscription_id: subscriptionId,
    }).eq("id", payment.id);
    if (paymentError) return json({ error: "Subscription activated, but payment record update failed" }, 500);
    return json({ paid: true, expiresAt: newExpiry, subjectId: payment.subject_id });
  } catch (error) {
    console.error("verify-payment error:", error);
    return json({ error: "Could not verify payment" }, 500);
  }
});
