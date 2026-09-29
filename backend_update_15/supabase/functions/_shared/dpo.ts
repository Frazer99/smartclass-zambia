/**
 * Shared DPO Group (Direct Pay Online) payment helper, imported by
 * create-payment and verify-payment. DPO's real underlying API is
 * legacy XML (confirmed via the "API3G" convention used across every
 * DPO integration found — python-dpo, laravel-dpo, the DPO Confluence
 * docs) — not JSON. Built directly against that XML wire protocol with
 * raw fetch() rather than depending on the only Node.js wrapper found
 * for it, an unofficial, 3-star community package with inconsistent
 * import names even in its own README — too fragile a foundation for a
 * real payments integration. Same "call the real API directly" approach
 * already used for OpenAI, LiveAvatar, and Resend elsewhere in this
 * project.
 *
 * DPO's hosted-checkout flow (confirmed real, not guessed):
 *   1. createToken() — server creates a payment token describing the
 *      transaction (amount, currency, customer details)
 *   2. Pupil is redirected to DPO's hosted payment page using that
 *      token — DPO collects card or mobile money details on THEIR page,
 *      never ours, so this project never touches raw card numbers or
 *      mobile money PINs at all
 *   3. DPO redirects back to redirectURL after payment
 *   4. verifyToken() — server re-checks the payment's real status
 *      directly with DPO. Never trust step 3's redirect alone: a
 *      redirect can be replayed or spoofed by anyone who knows the URL
 *      shape; a server-to-server status check with the payment provider
 *      itself cannot be.
 */

const DPO_API_URL = "https://secure.3gdirectpay.com/API/v6/";
const DPO_PAYMENT_PAGE_URL = "https://secure.3gdirectpay.com/payv3.php";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Pulls a single known-shape tag's text content out of DPO's XML
 *  response. A full XML parser is more than this needs — DPO's
 *  responses for the operations used here are flat, a handful of
 *  known tags, not nested/repeating structures. */
function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

export interface CreateTokenParams {
  companyToken: string;
  serviceType: string;
  amount: number;
  currency: string;
  companyRef: string;
  redirectUrl: string;
  backUrl: string;
  customerEmail: string;
  customerFirstName: string;
  customerLastName: string;
  serviceDescription: string;
}

export interface DpoTokenResult {
  success: boolean;
  transToken?: string;
  paymentUrl?: string;
  resultExplanation?: string;
}

export async function createToken(params: CreateTokenParams): Promise<DpoTokenResult> {
  const today = new Date().toISOString().slice(0, 10);
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(params.companyToken)}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${params.amount.toFixed(2)}</PaymentAmount>
    <PaymentCurrency>${xmlEscape(params.currency)}</PaymentCurrency>
    <CompanyRef>${xmlEscape(params.companyRef)}</CompanyRef>
    <RedirectURL>${xmlEscape(params.redirectUrl)}</RedirectURL>
    <BackURL>${xmlEscape(params.backUrl)}</BackURL>
    <CustomerEmail>${xmlEscape(params.customerEmail)}</CustomerEmail>
    <CustomerFirstName>${xmlEscape(params.customerFirstName)}</CustomerFirstName>
    <CustomerLastName>${xmlEscape(params.customerLastName)}</CustomerLastName>
    <PTL>4</PTL>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>${xmlEscape(params.serviceType)}</ServiceType>
      <ServiceDescription>${xmlEscape(params.serviceDescription)}</ServiceDescription>
      <ServiceDate>${today}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

  try {
    const res = await fetch(DPO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlBody,
    });
    const xml = await res.text();
    const result = extractXmlTag(xml, "Result");
    const transToken = extractXmlTag(xml, "TransToken");

    if (result === "000" && transToken) {
      return {
        success: true,
        transToken,
        paymentUrl: `${DPO_PAYMENT_PAGE_URL}?ID=${transToken}`,
      };
    }
    return { success: false, resultExplanation: extractXmlTag(xml, "ResultExplanation") || "Unknown DPO error" };
  } catch (e) {
    console.error("DPO createToken failed:", e);
    return { success: false, resultExplanation: "Network error contacting DPO" };
  }
}

export interface DpoVerifyResult {
  success: boolean;
  paid: boolean;
  transRef?: string;
  amount?: string;
  currency?: string;
  paymentMethod?: string;
  resultExplanation?: string;
}

export async function verifyToken(companyToken: string, transToken: string): Promise<DpoVerifyResult> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${xmlEscape(companyToken)}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${xmlEscape(transToken)}</TransactionToken>
</API3G>`;

  try {
    const res = await fetch(DPO_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlBody,
    });
    const xml = await res.text();
    const result = extractXmlTag(xml, "Result");

    // Result 000 from verifyToken specifically means "transaction was
    // completed and paid" — any other code (including a generic success
    // code from createToken) means not paid, cancelled, or still pending.
    const paid = result === "000";

    return {
      success: true,
      paid,
      transRef: extractXmlTag(xml, "TransactionApproval") || undefined,
      amount: extractXmlTag(xml, "TransactionAmount") || undefined,
      currency: extractXmlTag(xml, "TransactionCurrency") || undefined,
      paymentMethod: extractXmlTag(xml, "TransactionPaymentMethod") || undefined,
      resultExplanation: extractXmlTag(xml, "ResultExplanation") || undefined,
    };
  } catch (e) {
    console.error("DPO verifyToken failed:", e);
    return { success: false, paid: false, resultExplanation: "Network error contacting DPO" };
  }
}
