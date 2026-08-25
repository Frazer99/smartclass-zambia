from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import ProgressRecord, Topic, User
from app.schemas import ProgressOut

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=list[ProgressOut])
def my_progress(subject_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ProgressRecord, Topic).join(Topic, Topic.id == ProgressRecord.topic_id).filter(ProgressRecord.user_id == user.id)
    if subject_id:
        q = q.filter(ProgressRecord.subject_id == subject_id)
    results = []
    for record, topic in q.all():
        results.append(
            ProgressOut(
                subject_id=record.subject_id,
                topic_id=record.topic_id,
                topic_title=topic.title,
                mastery_score=record.mastery_score,
                lessons_completed=record.lessons_completed,
                questions_attempted=record.questions_attempted,
                questions_correct=record.questions_correct,
            )
        )
    return results
