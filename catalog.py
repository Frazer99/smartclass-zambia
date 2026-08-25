from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import PastPaper, Subject, SubjectFormOffering, Topic, User
from app.schemas import PastPaperOut, SubjectOut, TopicOut

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(form_level: int | None = Query(default=None, ge=2, le=6), db: Session = Depends(get_db)):
    """Returns subjects, optionally filtered to those offered at a given Form
    level (Form 2-3: Math+Science; Form 4-6: Math+Physics+Chemistry, as
    configured via SubjectFormOffering rows -- editable by an admin rather
    than hardcoded)."""
    if form_level is None:
        return db.query(Subject).order_by(Subject.name).all()
    subject_ids = [row.subject_id for row in db.query(SubjectFormOffering).filter(SubjectFormOffering.form_level == form_level)]
    return db.query(Subject).filter(Subject.id.in_(subject_ids)).order_by(Subject.name).all()


@router.get("/topics", response_model=list[TopicOut])
def list_topics(subject_id: int, form_level: int, db: Session = Depends(get_db)):
    return (
        db.query(Topic)
        .filter(Topic.subject_id == subject_id, Topic.form_level == form_level)
        .order_by(Topic.order_index, Topic.id)
        .all()
    )


@router.get("/past-papers", response_model=list[PastPaperOut])
def list_past_papers(subject_id: int, form_level: int, db: Session = Depends(get_db)):
    return (
        db.query(PastPaper)
        .filter(PastPaper.subject_id == subject_id, PastPaper.form_level == form_level)
        .order_by(PastPaper.year.desc())
        .all()
    )


@router.get("/past-papers/{paper_id}", response_model=PastPaperOut)
def get_past_paper(paper_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException

    paper = db.query(PastPaper).filter(PastPaper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Past paper not found")
    return paper
