import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const accessToken = authorization?.replace(/^Bearer\s+/i, "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!accessToken || !supabaseUrl || !serviceRoleKey) {
      return errorResponse("Authentication is required.", 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !userData.user) return errorResponse("Invalid or expired session.", 401);

    const body = await request.json();
    const { msisdn, reference, childId, subjectId } = body;

    if (!/^260\d{9}$/.test(msisdn || "")) return errorResponse("Enter a valid Airtel Zambia number in international format.", 400);
    if (!reference || typeof reference !== "string") return errorResponse("A payment reference is required.", 400);
    if (!subjectId || typeof subjectId !== "string") return errorResponse("Select a subject before paying.", 400);

    let userId = userData.user.id;
    if (childId) {
      const { data: link } = await supabase.from("parent_child_links").select("child_id").eq("parent_id", userId).eq("child_id", childId).maybeSingle();
      if (!link) return errorResponse("You can only pay for a linked child.", 403);
      userId = childId;
    }
    const { data: profile } = await supabase.from("profiles").select("grade").eq("id", userId).maybeSingle();
    const { data: subject } = await supabase.from("subjects").select("id, grades").eq("id", subjectId).maybeSingle();
    if (!subject || !profile?.grade || !subject.grades.includes(profile.grade)) return errorResponse("That subject is not available for this pupil.", 400);
    const { data: setting } = await supabase.from("platform_settings").select("value").eq("key", "subscription_price_zmw").maybeSingle();
    const amount = Number(setting?.value ?? 50);
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse("Invalid subscription price.", 500);
    if (!process.env.AIRTEL_BASE_URL || !process.env.AIRTEL_ACCESS_TOKEN) {
      return errorResponse("Airtel payments are not configured yet.", 503);
    }

    const transactionId = `SMARTCLASS-${Date.now()}`;
    const airtelPayload = {
      reference,
      subscriber: {
        country: "ZM",
        currency: "ZMW",
        msisdn,
      },
      transaction: {
        amount,
        country: "ZM",
        currency: "ZMW",
        id: transactionId,
      },
    };

    const response = await fetch(
      `${process.env.AIRTEL_BASE_URL.replace(/\/$/, "")}/merchant/v1/payments/`,
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          "X-Country": "ZM",
          "X-Currency": "ZMW",
          Authorization: `Bearer ${process.env.AIRTEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(airtelPayload),
      }
    );

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const providerToken = data?.data?.transaction?.id;
    if (!providerToken) return errorResponse("Airtel did not return a transaction ID.", 502);
    const { error: insertError } = await supabase.from("payments").insert({
      user_id: userId,
      subject_id: subjectId,
      amount,
      currency: "ZMW",
      payment_method: "mobile_money",
      provider: "airtel_money",
      provider_token: providerToken,
      company_ref: reference,
      status: "pending",
    });
    if (insertError) {
      console.error("Airtel payment record failed:", insertError);
      return errorResponse("The Airtel payment started, but could not be recorded. Contact support before retrying.", 500);
    }

    return NextResponse.json({ ...data, paymentReference: providerToken }, {
      status: response.status,
    });
  } catch (error) {
    console.error("Airtel payment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to process Airtel payment",
      },
      { status: 500 }
    );
  }
}