from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import LessonMessage, LessonSession, Material, PastPaper, PastPaperQuestion, User
from app.schemas import LessonSessionOut, SendMessageRequest, StartPastPaperRequest
from app.services import access_control
from app.services.retrieval import retrieve_context
from app.services.smartteach import get_ai_provider

router = APIRouter(prefix="/api/past-papers", tags=["past-papers"])

NEXT_WORDS = {"next", "next question", "continue", "move on", "skip"}


def _question_context(db: Session, question: PastPaperQuestion) -> list:
    docs = []
    if question.answer_guide:
        docs.append(("Marking scheme / model answer", question.answer_guide))
    if question.topic_id:
        materials = db.query(Material).filter(Material.topic_id == question.topic_id).all()
        docs.extend((m.title, m.extracted_text or "") for m in materials if m.extracted_text)
    return retrieve_context(question.question_text, docs, top_k=3) if docs else []


def _walkthrough(question: PastPaperQuestion, context) -> dict:
    board = [
        {"type": "heading", "content": f"Question {question.question_number}"},
        {"type": "text", "content": question.question_text},
    ]
    steps: list[str] = []
    if question.answer_guide:
        for s in question.answer_guide.split(". "):
            s = s.strip()
            if s:
                steps.append(s)
    elif context:
        for chunk in context:
            for s in chunk.text.split(". "):
                s = s.strip()
                if s and s not in steps:
                    steps.append(s)

    if not steps:
        text = (
            f"Question {question.question_number} ({question.marks or '?'} marks): {question.question_text}\n"
            "I don't have a marking scheme uploaded for this one yet, so let's reason through it together -- "
            "what's the first step you'd take?"
        )
    else:
        narrated = " ".join(f"Step {i+1}: {s}." for i, s in enumerate(steps[:6]))
        text = (
            f"Question {question.question_number} ({question.marks or '?'} marks): {question.question_text}\n"
            f"Here's how we answer it: {narrated}"
        )
        for s in steps[:6]:
            board.append({"type": "text", "content": s})

    text += " Ask me 'why' about any step, or type 'next' when you're ready for the next question."
    return {"text": text, "board": board}


@router.post("/start", response_model=LessonSessionOut)
def start_past_paper(payload: StartPastPaperRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    paper = db.query(PastPaper).filter(PastPaper.id == payload.past_paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Past paper not found")

    access_control.enforce_and_consume(db, user, paper.subject_id, elapsed_seconds=0)

    all_questions = sorted(paper.questions, key=lambda q: q.question_number)
    if payload.question_ids:
        selected = [q for q in all_questions if q.id in payload.question_ids]
        # Preserve the learner's selection order.
        order = {qid: i for i, qid in enumerate(payload.question_ids)}
        selected.sort(key=lambda q: order.get(q.id, 0))
    else:
        selected = all_questions
    if not selected:
        raise HTTPException(status_code=400, detail="This past paper has no questions loaded yet")

    session = LessonSession(
        user_id=user.id,
        mode="past_paper",
        subject_id=paper.subject_id,
        past_paper_id=paper.id,
        state={"question_ids": [q.id for q in selected], "index": 0},
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    first_q = selected[0]
    context = _question_context(db, first_q)
    walk = _walkthrough(first_q, context)
    db.add(LessonMessage(session_id=session.id, role="teacher", content=walk["text"], whiteboard=walk["board"]))
    db.commit()
    db.refresh(session)
    return session


@router.post("/message", response_model=LessonSessionOut)
def send_past_paper_message(payload: SendMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LessonSession).filter(LessonSession.id == payload.session_id, LessonSession.user_id == user.id).first()
    if not session or session.mode != "past_paper":
        raise HTTPException(status_code=404, detail="Past paper session not found")
    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="This session has already ended")

    access_control.enforce_and_consume(db, user, session.subject_id, elapsed_seconds=payload.elapsed_seconds)
    session.duration_seconds += payload.elapsed_seconds

    db.add(LessonMessage(session_id=session.id, role="student", content=payload.content))
    db.commit()

    state = dict(session.state or {})
    question_ids: list[int] = state.get("question_ids", [])
    index: int = state.get("index", 0)

    if payload.content.strip().lower() in NEXT_WORDS:
        index += 1
        if index >= len(question_ids):
            db.add(
                LessonMessage(
                    session_id=session.id,
                    role="teacher",
                    content="That's the last question in this set -- well done working through it. Check your progress "
                    "dashboard, or start another past paper whenever you're ready.",
                )
            )
            session.ended_at = datetime.now(timezone.utc)
        else:
            question = db.query(PastPaperQuestion).filter(PastPaperQuestion.id == question_ids[index]).first()
            context = _question_context(db, question)
            walk = _walkthrough(question, context)
            db.add(LessonMessage(session_id=session.id, role="teacher", content=walk["text"], whiteboard=walk["board"]))
        state["index"] = index
    else:
        if index >= len(question_ids):
            db.add(LessonMessage(session_id=session.id, role="teacher", content="This paper is complete -- start a new session to continue."))
        else:
            question = db.query(PastPaperQuestion).filter(PastPaperQuestion.id == question_ids[index]).first()
            context = _question_context(db, question)
            ai = get_ai_provider()
            reply = ai.answer_followup(question.question_text, payload.content, context)
            db.add(LessonMessage(session_id=session.id, role="teacher", content=reply))

    session.state = state
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=LessonSessionOut)
def get_session(session_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = db.query(LessonSession).filter(LessonSession.id == session_id, LessonSession.user_id == user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
