const DPO_API_URL = "https://secure.3gdirectpay.com/API/v6/";
const DPO_PAYMENT_PAGE_URL = "https://secure.3gdirectpay.com/payv3.php";

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

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
    const response = await fetch(DPO_API_URL, { method: "POST", headers: { "Content-Type": "application/xml" }, body: xmlBody });
    const xml = await response.text();
    const result = extractXmlTag(xml, "Result");
    const transToken = extractXmlTag(xml, "TransToken");
    if (result === "000" && transToken) {
      return { success: true, transToken, paymentUrl: `${DPO_PAYMENT_PAGE_URL}?ID=${transToken}` };
    }
    return { success: false, resultExplanation: extractXmlTag(xml, "ResultExplanation") || "Unknown DPO error" };
  } catch (error) {
    console.error("DPO createToken failed:", error);
    return { success: false, resultExplanation: "Network error contacting DPO" };
  }
}

export interface DpoVerifyResult {
  success: boolean;
  paid: boolean;
  transRef?: string;
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
    const response = await fetch(DPO_API_URL, { method: "POST", headers: { "Content-Type": "application/xml" }, body: xmlBody });
    const xml = await response.text();
    return {
      success: true,
      paid: extractXmlTag(xml, "Result") === "000",
      transRef: extractXmlTag(xml, "TransactionApproval") || undefined,
      resultExplanation: extractXmlTag(xml, "ResultExplanation") || undefined,
    };
  } catch (error) {
    console.error("DPO verifyToken failed:", error);
    return { success: false, paid: false, resultExplanation: "Network error contacting DPO" };
  }
}
