from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import LessonMessage, LessonSession, Material, ProgressRecord, Topic, User
from app.schemas import LessonSessionOut, SendMessageRequest, StartLessonRequest, TrialStatusOut
from app.services import access_control
from app.services.retrieval import retrieve_context
from app.services.smartteach import ENCOURAGEMENT_CORRECT, ENCOURAGEMENT_RETRY, get_ai_provider

router = APIRouter(prefix="/api/lessons", tags=["lessons"])
MAX_ATTEMPTS = 3


def _gather_documents(db: Session, subject_id: int, topic_id: int) -> list[tuple[str, str]]:
    materials = db.query(Material).filter(Material.topic_id == topic_id).all()
    if not materials:
        # Fall back to subject-wide approved materials if none are linked to this topic yet.
        materials = db.query(Material).filter(Material.subject_id == subject_id).all()
    docs = [(m.title, m.extracted_text or "") for m in materials if m.extracted_text]
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic and topic.description:
        docs.append((topic.title, topic.description))
    return docs


@router.post("/start", response_model=LessonSessionOut)
def start_lesson(payload: StartLessonRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == payload.topic_id, Topic.subject_id == payload.subject_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found for this subject")

    access_control.enforce_and_consume(db, user, payload.subject_id, elapsed_seconds=0)

    session = LessonSession(
        user_id=user.id,
        mode="lesson",
        subject_id=payload.subject_id,
        topic_id=topic.id,
        state={"attempt": 1, "stage": "explaining"},
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    docs = _gather_documents(db, payload.subject_id, topic.id)
    context = retrieve_context(topic.title, docs, top_k=3)
    ai = get_ai_provider()
    turn = ai.explain(topic.title, context, user.form_level or 0, attempt=1)

    msg = LessonMessage(session_id=session.id, role="teacher", content=turn.text, whiteboard=turn.whiteboard)
    db.add(msg)
    db.commit()
    db.refresh(session)
    return session


@router.post("/message", response_model=LessonSessionOut)
def send_lesson_message(payload: SendMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LessonSession).filter(LessonSession.id == payload.session_id, LessonSession.user_id == user.id).first()
    if not session or session.mode != "lesson":
        raise HTTPException(status_code=404, detail="Lesson session not found")
    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="This lesson session has already ended")

    access_control.enforce_and_consume(db, user, session.subject_id, elapsed_seconds=payload.elapsed_seconds)
    session.duration_seconds += payload.elapsed_seconds

    db.add(LessonMessage(session_id=session.id, role="student", content=payload.content))
    db.commit()

    topic = db.query(Topic).filter(Topic.id == session.topic_id).first()
    docs = _gather_documents(db, session.subject_id, session.topic_id)
    context = retrieve_context(topic.title, docs, top_k=3)
    ai = get_ai_provider()
    state = dict(session.state or {})
    stage = state.get("stage", "explaining")

    if stage == "explaining":
        expected_hint = " ".join(c.text for c in context) if context else ""
        is_correct, reason = ai.evaluate_answer(topic.title, expected_hint, payload.content)
        attempt = state.get("attempt", 1)

        if is_correct:
            import random

            praise = random.choice(ENCOURAGEMENT_CORRECT)
            practice_prompt = (
                f"{praise} Now, for practice: try applying {topic.title} to a problem of your own, or ask me for "
                "a practice question. When you're ready, tell me 'done' and I'll summarize today's lesson."
            )
            db.add(
                LessonMessage(
                    session_id=session.id,
                    role="teacher",
                    content=practice_prompt,
                    whiteboard=[{"type": "text", "content": f"Practice: apply {topic.title}"}],
                )
            )
            state["stage"] = "practice"
            _bump_progress(db, user.id, session.subject_id, topic.id, correct=True)
        elif attempt >= MAX_ATTEMPTS:
            summary = _summarize(topic.title, context)
            db.add(LessonMessage(session_id=session.id, role="teacher", content=summary["text"], whiteboard=summary["board"]))
            state["stage"] = "summary"
            _bump_progress(db, user.id, session.subject_id, topic.id, correct=False)
        else:
            import random

            retry_lead = random.choice(ENCOURAGEMENT_RETRY)
            turn = ai.explain(topic.title, context, user.form_level or 0, attempt=attempt + 1)
            db.add(
                LessonMessage(
                    session_id=session.id, role="teacher", content=f"{retry_lead} {turn.text}", whiteboard=turn.whiteboard
                )
            )
            state["attempt"] = attempt + 1

    elif stage == "practice":
        if payload.content.strip().lower() in {"done", "finished", "complete", "summarize"}:
            summary = _summarize(topic.title, context)
            db.add(LessonMessage(session_id=session.id, role="teacher", content=summary["text"], whiteboard=summary["board"]))
            state["stage"] = "summary"
            session.ended_at = datetime.now(timezone.utc)
        else:
            reply = ai.answer_followup(topic.title, payload.content, context)
            db.add(LessonMessage(session_id=session.id, role="teacher", content=reply))

    else:  # summary / ended
        db.add(
            LessonMessage(
                session_id=session.id,
                role="teacher",
                content="Today's lesson has ended. Head back to your dashboard to pick the next topic, or start a new lesson.",
            )
        )

    session.state = state
    db.commit()
    db.refresh(session)
    return session


@router.get("/trial-status/{subject_id}", response_model=TrialStatusOut)
def get_trial_status(subject_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return access_control.trial_status(db, user, subject_id)


@router.get("/{session_id}", response_model=LessonSessionOut)
def get_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LessonSession).filter(LessonSession.id == session_id, LessonSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _summarize(topic_title: str, context) -> dict:
    points = []
    for chunk in context[:3]:
        for s in chunk.text.split(". "):
            s = s.strip()
            if s and s not in points:
                points.append(s)
            if len(points) >= 3:
                break
    text = (
        f"Great session! Today we covered {topic_title}. Key takeaways: "
        + (" ".join(f"({i+1}) {p}." for i, p in enumerate(points)) if points else "we built the core idea up step by step.")
        + " Keep practicing and I'll see you in the next lesson."
    )
    board = [{"type": "heading", "content": f"Summary: {topic_title}"}] + [{"type": "text", "content": p} for p in points]
    return {"text": text, "board": board}


def _bump_progress(db: Session, user_id: int, subject_id: int, topic_id: int, correct: bool) -> None:
    record = (
        db.query(ProgressRecord).filter(ProgressRecord.user_id == user_id, ProgressRecord.topic_id == topic_id).first()
    )
    if not record:
        record = ProgressRecord(
            user_id=user_id,
            subject_id=subject_id,
            topic_id=topic_id,
            mastery_score=0.0,
            lessons_completed=0,
            questions_attempted=0,
            questions_correct=0,
        )
        db.add(record)
    record.questions_attempted += 1
    if correct:
        record.questions_correct += 1
        record.lessons_completed += 1
    total = max(1, record.questions_attempted)
    record.mastery_score = round(100 * record.questions_correct / total, 1)
    db.commit()
