function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function getPaymentStatus(transactionId: string): Promise<{
  status: string;
  reference?: string;
}> {
  const baseUrl = required("AIRTEL_BASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/standard/v1/payments/${encodeURIComponent(transactionId)}`, {
    headers: {
      Accept: "*/*",
      "X-Country": "ZM",
      "X-Currency": "ZMW",
      Authorization: `Bearer ${required("AIRTEL_ACCESS_TOKEN")}`,
    },
  });
  if (!response.ok) throw new Error(`Airtel status request failed (${response.status})`);

  const data = await response.json();
  return {
    status: data?.data?.transaction?.status || data?.status?.message || "UNKNOWN",
    reference: data?.data?.transaction?.id,
  };
}