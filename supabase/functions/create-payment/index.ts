import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createToken } from "../_shared/dpo.ts";
import { requestToPay } from "../_shared/mtn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PaymentMethod = "mobile_money" | "card";

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

    const { paymentMethod, phoneNumber, childId, subjectId } = await req.json() as { paymentMethod: PaymentMethod; phoneNumber?: string; childId?: string | null; subjectId?: string };
    if (paymentMethod !== "mobile_money" && paymentMethod !== "card") return json({ error: "Invalid payment method" }, 400);
    if (!subjectId) return json({ error: "Select a subject before paying" }, 400);
    const normalizedPhoneNumber = phoneNumber?.startsWith("0") ? `260${phoneNumber.slice(1)}` : phoneNumber;
    if (paymentMethod === "mobile_money" && !/^260\d{9}$/.test(normalizedPhoneNumber || "")) {
      return json({ error: "Enter a valid MTN Zambia number in international format, for example 260971234567" }, 400);
    }

    const payerId = userData.user.id;
    let userId = payerId;
    if (childId) {
      const { data: link } = await supabase.from("parent_child_links").select("child_id").eq("parent_id", payerId).eq("child_id", childId).maybeSingle();
      if (!link) return json({ error: "You can only pay for a linked child." }, 403);
      userId = childId;
    }
    const { data: profile } = await supabase.from("profiles").select("full_name, grade").eq("id", userId).maybeSingle();
    const { data: subject } = await supabase.from("subjects").select("id, name, grades").eq("id", subjectId).maybeSingle();
    if (!subject || !profile?.grade || !subject.grades.includes(profile.grade)) {
      return json({ error: "That subject is not available for this pupil." }, 400);
    }
    const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "subscription_price_zmw").maybeSingle();
    const amount = Number(setting?.value ?? 50);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "Invalid subscription price" }, 500);

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const [firstName, ...rest] = (profile?.full_name || "Pupil").trim().split(/\s+/);
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:3000";
    const companyRef = `SCZ-${userId.slice(0, 8)}-${Date.now()}`;

    if (paymentMethod === "mobile_money") {
      const referenceId = crypto.randomUUID();
      await requestToPay({
        referenceId,
        amount,
        currency: "ZMW",
        phoneNumber: normalizedPhoneNumber!,
        externalId: companyRef,
        payerMessage: `SmartClass Zambia ${subject.name} subscription`,
      });
      const { error: insertError } = await supabase.from("payments").insert({
        user_id: userId, subject_id: subjectId, amount, currency: "ZMW", payment_method: paymentMethod,
        provider: "mtn_momo", provider_token: referenceId, company_ref: companyRef, status: "pending",
      });
      if (insertError) return json({ error: "Could not record payment" }, 500);
      return json({ paymentReference: referenceId });
    }

    const dpoCompanyToken = Deno.env.get("DPO_COMPANY_TOKEN");
    const dpoServiceType = Deno.env.get("DPO_SERVICE_TYPE");
    if (!dpoCompanyToken || !dpoServiceType) return json({ error: "Card payments are not configured yet." }, 503);
    const result = await createToken({
      companyToken: dpoCompanyToken, serviceType: dpoServiceType, amount, currency: "ZMW", companyRef,
      redirectUrl: `${siteUrl}/subscribe/complete${childId ? `?child=${encodeURIComponent(childId)}` : ""}`, backUrl: `${siteUrl}/subscribe`,
      customerEmail: childId ? (userData.user.email || "no-reply@smartclasszambia.com") : (authUser.user?.email || "no-reply@smartclasszambia.com"),
      customerFirstName: firstName || "Pupil", customerLastName: rest.join(" ") || "Pupil",
      serviceDescription: `SmartClass Zambia - ${subject.name} Monthly Subscription`,
    });
    if (!result.success || !result.transToken || !result.paymentUrl) return json({ error: result.resultExplanation || "Could not start payment" }, 502);

    const { error: insertError } = await supabase.from("payments").insert({
      user_id: userId, subject_id: subjectId, amount, currency: "ZMW", payment_method: paymentMethod,
      provider: "dpo", provider_token: result.transToken, company_ref: companyRef, status: "pending",
    });
    if (insertError) return json({ error: "Could not record payment" }, 500);
    return json({ paymentUrl: result.paymentUrl });
  } catch (error) {
    console.error("create-payment error:", error);
    const message = error instanceof Error ? error.message : "Could not start payment";
    return json({ error: message }, 500);
  }
});
