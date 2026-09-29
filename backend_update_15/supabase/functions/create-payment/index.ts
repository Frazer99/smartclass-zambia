import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createToken } from "../_shared/dpo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreatePaymentRequest {
  paymentMethod: "mobile_money" | "card";
}

/**
 * Starts a real DPO Group payment: creates a token describing the
 * transaction, records a pending row in `payments`, and returns DPO's
 * hosted payment page URL for the frontend to redirect the pupil to.
 * DPO collects the actual card number or mobile money PIN on their own
 * page — this project never sees or stores that.
 *
 * Requires auth (a pupil pays for their own subscription). The actual
 * payment isn't confirmed here — see verify-payment, called after the
 * pupil returns from DPO's redirect. A payment token existing doesn't
 * mean money changed hands; only a successful verifyToken call does.
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

    const { paymentMethod }: CreatePaymentRequest = await req.json();
    if (paymentMethod !== "mobile_money" && paymentMethod !== "card") {
      return new Response(JSON.stringify({ error: "paymentMethod must be mobile_money or card" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dpoCompanyToken = Deno.env.get("DPO_COMPANY_TOKEN");
    const dpoServiceType = Deno.env.get("DPO_SERVICE_TYPE");
    if (!dpoCompanyToken || !dpoServiceType) {
      return new Response(JSON.stringify({ error: "Payments are not configured yet. Contact support." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const { data: priceSetting } = await supabase.from("platform_settings").select("value").eq("key", "subscription_price_zmw").maybeSingle();
    const amount = Number(priceSetting?.value ?? 50);

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const customerEmail = authUser.user?.email || "no-reply@smartclasszambia.com";
    const [firstName, ...rest] = (profile?.full_name || "Pupil").split(" ");
    const lastName = rest.join(" ") || "Pupil";

    const companyRef = `SCZ-${userId.slice(0, 8)}-${Date.now()}`;
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:3000";

    const result = await createToken({
      companyToken: dpoCompanyToken,
      serviceType: dpoServiceType,
      amount,
      currency: "ZMW",
      companyRef,
      redirectUrl: `${siteUrl}/subscribe/complete`,
      backUrl: `${siteUrl}/subscribe`,
      customerEmail,
      customerFirstName: firstName,
      customerLastName: lastName,
      serviceDescription: "SmartClass Zambia — Monthly Subscription",
    });

    if (!result.success || !result.transToken || !result.paymentUrl) {
      return new Response(JSON.stringify({ error: result.resultExplanation || "Could not start payment" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("payments").insert({
      user_id: userId,
      amount,
      currency: "ZMW",
      payment_method: paymentMethod,
      provider: "dpo",
      provider_token: result.transToken,
      company_ref: companyRef,
      status: "pending",
    });

    return new Response(JSON.stringify({ paymentUrl: result.paymentUrl, transToken: result.transToken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
