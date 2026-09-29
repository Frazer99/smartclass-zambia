const MTN_API_URL = "https://sandbox.momodeveloper.mtn.com";

function required(name: string): string {
  const aliases: Record<string, string> = {
    MTN_MOMO_API_USER: "MTN_API_USER",
    MTN_MOMO_API_KEY: "MTN_API_KEY",
    MTN_MOMO_SUBSCRIPTION_KEY: "MTN_SUBSCRIPTION_KEY",
    MTN_MOMO_TARGET_ENV: "MTN_TARGET_ENVIRONMENT",
  };
  const value = Deno.env.get(name) || (aliases[name] ? Deno.env.get(aliases[name]) : undefined);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function apiUrl(path: string): string {
  const baseUrl = Deno.env.get("MTN_MOMO_BASE_URL") || MTN_API_URL;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function targetEnvironment(): string {
  return Deno.env.get("MTN_MOMO_TARGET_ENV") || Deno.env.get("MTN_TARGET_ENVIRONMENT") || "sandbox";
}

function headers(subscriptionKey: string, accessToken?: string, referenceId?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "X-Target-Environment": targetEnvironment(),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(referenceId ? { "X-Reference-Id": referenceId } : {}),
  };
}

async function getAccessToken(): Promise<string> {
  const subscriptionKey = required("MTN_MOMO_SUBSCRIPTION_KEY");
  const credentials = btoa(`${required("MTN_MOMO_API_USER")}:${required("MTN_MOMO_API_KEY")}`);
  const response = await fetch(apiUrl("/collection/token/"), {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "X-Target-Environment": targetEnvironment(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`MTN token request failed (${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error("MTN token response did not include an access token");
  return data.access_token;
}

export async function requestToPay(params: {
  referenceId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  externalId: string;
  payerMessage: string;
}): Promise<void> {
  const subscriptionKey = required("MTN_MOMO_SUBSCRIPTION_KEY");
  const accessToken = await getAccessToken();
  const response = await fetch(apiUrl("/collection/v1_0/requesttopay"), {
    method: "POST",
    headers: headers(subscriptionKey, accessToken, params.referenceId),
    body: JSON.stringify({
      amount: params.amount.toFixed(2),
      currency: params.currency,
      externalId: params.externalId,
      payer: { partyIdType: "MSISDN", partyId: params.phoneNumber },
      payerMessage: params.payerMessage,
      payeeNote: "SmartClass Zambia subscription",
    }),
  });
  if (!response.ok) throw new Error(`MTN payment request failed (${response.status})`);
}

export async function getRequestStatus(referenceId: string): Promise<{ status: string; financialTransactionId?: string }> {
  const subscriptionKey = required("MTN_MOMO_SUBSCRIPTION_KEY");
  const accessToken = await getAccessToken();
  const response = await fetch(apiUrl(`/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`), {
    headers: headers(subscriptionKey, accessToken),
  });
  if (!response.ok) throw new Error(`MTN status request failed (${response.status})`);
  return await response.json();
}
