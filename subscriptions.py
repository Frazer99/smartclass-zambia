from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Payment, Subject, Subscription, User
from app.schemas import InitiatePaymentRequest, PaymentOut, PaymentWebhookPayload, SubscriptionOut
from app.services.payment_provider import get_payment_provider

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/subscriptions", response_model=list[SubscriptionOut])
def my_subscriptions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Subscription).filter(Subscription.user_id == user.id).order_by(Subscription.created_at.desc()).all()


@router.post("/pay", response_model=PaymentOut)
def initiate_payment(payload: InitiatePaymentRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    if payload.method not in {"mtn_momo", "airtel_money", "visa"}:
        raise HTTPException(status_code=400, detail="method must be one of: mtn_momo, airtel_money, visa")
    if payload.method in {"mtn_momo", "airtel_money"} and not payload.msisdn:
        raise HTTPException(status_code=400, detail="msisdn (mobile money phone number) is required for this method")

    amount = settings.subscription_price_zmw

    subscription = Subscription(
        user_id=user.id, subject_id=payload.subject_id, status="pending", amount_zmw=amount
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    provider = get_payment_provider()
    result = provider.initiate(amount, payload.method, payload.msisdn, user.email)

    payment = Payment(
        user_id=user.id,
        subject_id=payload.subject_id,
        subscription_id=subscription.id,
        amount_zmw=amount,
        method=payload.method,
        msisdn=payload.msisdn,
        provider_reference=result.provider_reference,
        status=result.status,
    )
    db.add(payment)

    if result.status == "success":
        subscription.status = "active"
        subscription.start_date = datetime.now(timezone.utc)
        subscription.end_date = datetime.now(timezone.utc) + timedelta(days=settings.subscription_period_days)

    db.commit()
    db.refresh(payment)
    return payment


@router.post("/webhook")
def payment_webhook(payload: PaymentWebhookPayload, db: Session = Depends(get_db)):
    """Callback endpoint real MTN MoMo / Airtel Money / DPO integrations would
    POST to when a payment resolves asynchronously. The mock provider
    resolves synchronously in /pay, so this exists for forward-compatibility
    with real gateways."""
    payment = db.query(Payment).filter(Payment.provider_reference == payload.provider_reference).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Unknown payment reference")

    payment.status = payload.status
    if payload.status == "success" and payment.subscription_id:
        sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        if sub:
            sub.status = "active"
            sub.start_date = datetime.now(timezone.utc)
            sub.end_date = datetime.now(timezone.utc) + timedelta(days=settings.subscription_period_days)
    db.commit()
    return {"ok": True}
