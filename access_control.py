"""Free-trial + subscription gating (SRS: 10 minutes free, then subscribe
K50/subject/month via mobile money or card).

Every interactive AI-teacher turn (lesson or past-paper) reports how many
seconds elapsed since the previous turn; this service adds that to the
user's per-subject trial usage and blocks further access once the 10-minute
allowance is used up and there's no active paid subscription for that
subject.
"""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Subscription, TrialUsage, User
from app.schemas import TrialStatusOut


def get_active_subscription(db: Session, user_id: int, subject_id: int) -> Subscription | None:
    sub = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.subject_id == subject_id, Subscription.status == "active")
        .order_by(Subscription.end_date.desc())
        .first()
    )
    if sub and sub.end_date and sub.end_date < datetime.now(timezone.utc).replace(tzinfo=sub.end_date.tzinfo):
        sub.status = "expired"
        db.commit()
        return None
    return sub


def get_or_create_trial(db: Session, user_id: int, subject_id: int) -> TrialUsage:
    trial = db.query(TrialUsage).filter(TrialUsage.user_id == user_id, TrialUsage.subject_id == subject_id).first()
    if not trial:
        trial = TrialUsage(user_id=user_id, subject_id=subject_id, seconds_used=0)
        db.add(trial)
        db.commit()
        db.refresh(trial)
    return trial


def trial_status(db: Session, user: User, subject_id: int) -> TrialStatusOut:
    trial = get_or_create_trial(db, user.id, subject_id)
    active_sub = get_active_subscription(db, user.id, subject_id)
    remaining = max(0, settings.trial_seconds_per_subject - trial.seconds_used)
    return TrialStatusOut(
        subject_id=subject_id,
        seconds_used=trial.seconds_used,
        seconds_allowed=settings.trial_seconds_per_subject,
        seconds_remaining=remaining,
        has_active_subscription=active_sub is not None,
    )


def enforce_and_consume(db: Session, user: User, subject_id: int, elapsed_seconds: int) -> TrialStatusOut:
    """Raises 402 Payment Required if the user has no active subscription and
    has exhausted the free trial for this subject. Otherwise records elapsed
    trial time (for trial users) and returns the current status."""
    active_sub = get_active_subscription(db, user.id, subject_id)
    trial = get_or_create_trial(db, user.id, subject_id)

    if active_sub is None:
        if trial.seconds_used >= settings.trial_seconds_per_subject:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": (
                        "Your 10-minute free trial for this subject has ended. "
                        f"Subscribe for K{settings.subscription_price_zmw:.0f}/month to keep learning."
                    ),
                    "code": "TRIAL_EXPIRED",
                    "subject_id": subject_id,
                },
            )
        trial.seconds_used = min(settings.trial_seconds_per_subject, trial.seconds_used + max(0, elapsed_seconds))
        db.commit()
        db.refresh(trial)

    return trial_status(db, user, subject_id)
