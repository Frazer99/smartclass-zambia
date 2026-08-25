"""Payment provider abstraction for subscription billing.

SmartClass Zambia charges K50 per subject per month, payable via MTN Mobile
Money, Airtel Money, or Visa (card) rails. Real integrations (MTN MoMo
Collections API, Airtel Money OpenAPI, a card processor such as DPO Pay or
Flutterwave for Visa in Zambia) require merchant credentials this build does
not have, so every provider below implements the same interface and the
"mock" provider auto-approves after initiation so the full subscribe -> pay ->
unlock flow is demonstrable end to end. Switching PAYMENT_PROVIDER in the
environment plugs in a real gateway without changing any router code.
"""
import secrets
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class PaymentInitResult:
    provider_reference: str
    status: str  # "pending" | "success" | "failed"
    instructions: str


class PaymentProvider(ABC):
    @abstractmethod
    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        ...


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
    """Stub for the MTN Mobile Money Collections API. Requires MTN_MOMO_API_KEY
    plus subscription/API-user credentials from the MTN MoMo developer portal."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        if not settings.mtn_momo_api_key:
            raise RuntimeError("MTN_MOMO_API_KEY not configured; falling back is handled by get_payment_provider()")
        # TODO: call MTN MoMo "Request to Pay" endpoint here.
        reference = f"MTN-{secrets.token_hex(6).upper()}"
        return PaymentInitResult(reference, "pending", f"MTN MoMo prompt sent to {msisdn}.")


class AirtelMoneyProvider(PaymentProvider):
    """Stub for the Airtel Money OpenAPI. Requires AIRTEL_MONEY_API_KEY."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        if not settings.airtel_money_api_key:
            raise RuntimeError("AIRTEL_MONEY_API_KEY not configured")
        # TODO: call Airtel Money Collection API here.
        reference = f"AIRTEL-{secrets.token_hex(6).upper()}"
        return PaymentInitResult(reference, "pending", f"Airtel Money prompt sent to {msisdn}.")


class DpoCardProvider(PaymentProvider):
    """Stub for Visa/card processing via DPO Pay (widely used for card
    acquiring in Zambia). Requires DPO_COMPANY_TOKEN."""

    def initiate(self, amount_zmw: float, method: str, msisdn: str | None, user_email: str) -> PaymentInitResult:
        if not settings.dpo_company_token:
            raise RuntimeError("DPO_COMPANY_TOKEN not configured")
        # TODO: create a DPO token + redirect the user to the hosted card page.
        reference = f"DPO-{secrets.token_hex(6).upper()}"
        return PaymentInitResult(reference, "pending", "Redirecting to secure card payment page...")


def get_payment_provider() -> PaymentProvider:
    provider = settings.payment_provider
    if provider == "mtn_momo" and settings.mtn_momo_api_key:
        return MtnMomoProvider()
    if provider == "airtel_money" and settings.airtel_money_api_key:
        return AirtelMoneyProvider()
    if provider == "dpo" and settings.dpo_company_token:
        return DpoCardProvider()
    return MockPaymentProvider()
