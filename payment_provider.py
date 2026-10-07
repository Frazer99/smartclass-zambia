"""Payment provider abstraction for subscription billing.

SmartClass Zambia charges K50 per subject per month through MTN Mobile Money,
Airtel Money, or a hosted Visa checkout. The mock provider remains available
for local demos, while the other providers use their gateway APIs when the
corresponding credentials are configured.
"""
import base64
import json
import secrets
import urllib.error
import urllib.parse
import urllib.request
from xml.etree import ElementTree
from abc import ABC, abstractmethod
from dataclasses import dataclass

from config import settings


@dataclass
class PaymentInitResult:
    provider_reference: str
    status: str  # "pending" | "success" | "failed"
    instructions: str


class PaymentProvider(ABC):
    @abstractmethod
    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        ...


def _request(url: str, method: str, headers: dict[str, str], body: bytes | None = None) -> bytes:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Payment provider rejected the request ({error.code}): {detail[:300]}') from error
    except urllib.error.URLError as error:
        raise RuntimeError(f'Payment provider connection failed: {error.reason}') from error


def _json_request(url: str, method: str, headers: dict[str, str], payload: dict) -> dict:
    response = _request(url, method, {**headers, 'Content-Type': 'application/json'}, json.dumps(payload).encode())
    return json.loads(response.decode('utf-8')) if response else {}


def _xml_escape(value: str) -> str:
    return (value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;').replace("'", '&apos;'))


class MockPaymentProvider(PaymentProvider):
    """Simulates instant approval so the product can be demoed without live
    mobile money / card merchant accounts. Replace with a real provider by
    setting PAYMENT_PROVIDER and the relevant API credentials."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        reference = f"MOCK-{secrets.token_hex(6).upper()}"
        if method in ("mtn_momo", "airtel_money"):
            instructions = (
                f"A payment prompt for K{amount_zmw:.2f} has been sent to {msisdn or 'your phone'}. "
                "Approve it on your phone to activate your subscription. (Demo mode: auto-approved.)"
            )
        elif method == "visa":
            instructions = (
                f"Card payment of K{amount_zmw:.2f} authorized. (Demo mode: auto-approved; a real deployment "
                "redirects to a PCI-DSS compliant hosted card page, e.g. DPO Pay.)"
            )
        else:
            instructions = "Unsupported payment method."
        return PaymentInitResult(provider_reference=reference, status="success", instructions=instructions)


class MtnMomoProvider(PaymentProvider):
    """MTN Mobile Money Collections API integration."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        required = (settings.mtn_momo_api_user, settings.mtn_momo_api_key, settings.mtn_momo_subscription_key, msisdn)
        if not all(required):
            raise RuntimeError('MTN MoMo credentials and a phone number are required')
        base_url = settings.mtn_momo_base_url.rstrip('/')
        basic = base64.b64encode(f'{settings.mtn_momo_api_user}:{settings.mtn_momo_api_key}'.encode()).decode()
        token_response = json.loads(_request(
            f'{base_url}/collection/token/', 'POST', {
                'Authorization': f'Basic {basic}',
                'Ocp-Apim-Subscription-Key': settings.mtn_momo_subscription_key,
                'X-Target-Environment': settings.mtn_momo_target_env,
                'Content-Type': 'application/x-www-form-urlencoded',
            }, b'grant_type=client_credentials').decode('utf-8'))
        access_token = token_response.get('access_token')
        if not access_token:
            raise RuntimeError('MTN MoMo did not return an access token')
        reference = secrets.token_hex(16)
        _request(
            f'{base_url}/collection/v1_0/requesttopay', 'POST', {
                'Authorization': f'Bearer {access_token}',
                'Ocp-Apim-Subscription-Key': settings.mtn_momo_subscription_key,
                'X-Target-Environment': settings.mtn_momo_target_env,
                'X-Reference-Id': reference,
                'Content-Type': 'application/json',
            }, json.dumps({
                'amount': f'{amount_zmw:.2f}', 'currency': 'ZMW', 'externalId': reference,
                'payer': {'partyIdType': 'MSISDN', 'partyId': msisdn},
                'payerMessage': 'SmartClass Zambia subscription', 'payeeNote': 'SmartClass Zambia subscription',
            }).encode(),
        )
        return PaymentInitResult(reference, 'pending', f'MTN MoMo prompt sent to {msisdn}.')


class AirtelMoneyProvider(PaymentProvider):
    """Airtel Money merchant payments integration."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        if not settings.airtel_base_url or not settings.airtel_access_token or not msisdn:
            raise RuntimeError('Airtel credentials and a phone number are required')
        reference = f'SMARTCLASS-{secrets.token_hex(8).upper()}'
        response = _json_request(
            f'{settings.airtel_base_url.rstrip("/")}/merchant/v1/payments/', 'POST', {
                'Accept': '*/*', 'X-Country': 'ZM', 'X-Currency': 'ZMW',
                'Authorization': f'Bearer {settings.airtel_access_token}',
            }, {
                'reference': reference,
                'subscriber': {'country': 'ZM', 'currency': 'ZMW', 'msisdn': msisdn},
                'transaction': {'amount': amount_zmw, 'country': 'ZM', 'currency': 'ZMW', 'id': reference},
            },
        )
        provider_reference = (response.get('data', {}).get('transaction', {}).get('id')
                              or response.get('transaction', {}).get('id') or reference)
        return PaymentInitResult(provider_reference, 'pending', f'Airtel Money prompt sent to {msisdn}.')


class DpoCardProvider(PaymentProvider):
    """DPO Pay hosted card checkout integration."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        if not settings.dpo_company_token or not settings.dpo_service_type:
            raise RuntimeError('DPO company token and service type are required')
        reference = f'SCZ-{secrets.token_hex(8).upper()}'
        first_name, _, last_name = user_email.partition('@')
        xml = f'''<?xml version="1.0" encoding="utf-8"?>
    <API3G><CompanyToken>{_xml_escape(settings.dpo_company_token)}</CompanyToken><Request>createToken</Request>
<Transaction><PaymentAmount>{amount_zmw:.2f}</PaymentAmount><PaymentCurrency>ZMW</PaymentCurrency>
    <CompanyRef>{_xml_escape(reference)}</CompanyRef><RedirectURL>{_xml_escape(settings.site_url)}/subscribe/complete</RedirectURL>
    <BackURL>{_xml_escape(settings.site_url)}/subscribe</BackURL><CustomerEmail>{_xml_escape(user_email)}</CustomerEmail>
    <CustomerFirstName>{_xml_escape(first_name)}</CustomerFirstName><CustomerLastName>{_xml_escape(last_name or first_name)}</CustomerLastName><PTL>4</PTL></Transaction>
    <Services><Service><ServiceType>{_xml_escape(settings.dpo_service_type)}</ServiceType><ServiceDescription>SmartClass Zambia subscription</ServiceDescription></Service></Services></API3G>'''
        response = _request(settings.dpo_base_url, 'POST', {'Content-Type': 'application/xml'}, xml.encode())
        root = ElementTree.fromstring(response)
        result = root.findtext('Result')
        token = root.findtext('TransToken')
        if result != '000' or not token:
            raise RuntimeError(root.findtext('ResultExplanation') or 'DPO could not create a payment token')
        return PaymentInitResult(token, 'pending', f'Redirect to {settings.dpo_checkout_url}?ID={urllib.parse.quote(token)}')


def get_payment_provider() -> PaymentProvider:
    provider = settings.payment_provider
    if provider == "mtn_momo" and settings.mtn_momo_api_key:
        return MtnMomoProvider()
    if provider == "airtel_money" and settings.airtel_access_token:
        return AirtelMoneyProvider()
    if provider == "dpo" and settings.dpo_company_token:
        return DpoCardProvider()
    return MockPaymentProvider()
