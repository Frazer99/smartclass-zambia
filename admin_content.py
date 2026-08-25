import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_admin
from app.models import Material, PastPaper, PastPaperQuestion, Subject, SubjectFormOffering, SyllabusDocument, Topic, User
from app.schemas import MaterialOut, PastPaperCreate, PastPaperOut, SubjectOut, SyllabusUploadOut, TopicOut
from app.services.document_parser import extract_text, split_into_topics

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _save_upload(file: UploadFile, subdir: str) -> str:
    directory = Path(settings.upload_dir) / subdir
    directory.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "upload").suffix
    dest = directory / f"{uuid.uuid4().hex}{ext}"
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return str(dest)


# ---------------------------------------------------------------------------
# Subjects & form offerings
# ---------------------------------------------------------------------------
@router.post("/subjects", response_model=SubjectOut)
def create_subject(name: str = Form(...), description: str = Form(""), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    existing = db.query(Subject).filter(Subject.name == name).first()
    if existing:
        return existing
    subject = Subject(name=name, description=description)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.post("/subjects/{subject_id}/offerings")
def set_form_offering(subject_id: int, form_level: int = Form(..., ge=2, le=6), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    exists = (
        db.query(SubjectFormOffering)
        .filter(SubjectFormOffering.subject_id == subject_id, SubjectFormOffering.form_level == form_level)
        .first()
    )
    if not exists:
        db.add(SubjectFormOffering(subject_id=subject_id, form_level=form_level))
        db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Syllabus upload -> auto-generate topics
# ---------------------------------------------------------------------------
@router.post("/syllabus", response_model=SyllabusUploadOut)
def upload_syllabus(
    subject_id: int = Form(...),
    form_level: int = Form(..., ge=2, le=6),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    path = _save_upload(file, "syllabus")
    text = extract_text(path)
    doc = SyllabusDocument(
        subject_id=subject_id,
        form_level=form_level,
        filename=file.filename or "syllabus",
        storage_path=path,
        uploaded_by=admin.id,
        parsed=True,
        raw_text_excerpt=text[:2000],
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    topic_titles = split_into_topics(text)
    existing_titles = {
        t.title.lower()
        for t in db.query(Topic).filter(Topic.subject_id == subject_id, Topic.form_level == form_level).all()
    }
    created = 0
    max_order = (
        db.query(Topic).filter(Topic.subject_id == subject_id, Topic.form_level == form_level).count()
    )
    for i, title in enumerate(topic_titles):
        if title.lower() in existing_titles:
            continue
        db.add(
            Topic(
                subject_id=subject_id,
                form_level=form_level,
                title=title,
                order_index=max_order + i,
                source_syllabus_id=doc.id,
            )
        )
        created += 1
    db.commit()

    return SyllabusUploadOut(
        id=doc.id, subject_id=subject_id, form_level=form_level, filename=doc.filename, parsed=True, topics_created=created
    )


@router.post("/topics", response_model=TopicOut)
def add_topic_manually(
    subject_id: int = Form(...),
    form_level: int = Form(..., ge=2, le=6),
    title: str = Form(...),
    description: str = Form(""),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(Topic).filter(Topic.subject_id == subject_id, Topic.form_level == form_level).count()
    topic = Topic(subject_id=subject_id, form_level=form_level, title=title, description=description, order_index=order)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


# ---------------------------------------------------------------------------
# Approved materials: books, pamphlets, notes -> feed the RAG knowledge base
# ---------------------------------------------------------------------------
@router.post("/materials", response_model=MaterialOut)
def upload_material(
    subject_id: int = Form(...),
    form_level: int = Form(..., ge=2, le=6),
    title: str = Form(...),
    material_type: str = Form("note"),
    topic_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    path = _save_upload(file, "materials")
    text = extract_text(path)
    material = Material(
        subject_id=subject_id,
        form_level=form_level,
        topic_id=topic_id,
        title=title,
        material_type=material_type,
        filename=file.filename or "material",
        storage_path=path,
        extracted_text=text,
        uploaded_by=admin.id,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(subject_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    q = db.query(Material)
    if subject_id:
        q = q.filter(Material.subject_id == subject_id)
    return q.order_by(Material.uploaded_at.desc()).all()


# ---------------------------------------------------------------------------
# Past papers (with question-level breakdown so learners can pick a
# specific question, per SRS section 8 UI note)
# ---------------------------------------------------------------------------
@router.post("/past-papers", response_model=PastPaperOut)
def create_past_paper(payload: PastPaperCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    paper = PastPaper(
        subject_id=payload.subject_id,
        form_level=payload.form_level,
        year=payload.year,
        term=payload.term,
        title=payload.title,
        uploaded_by=admin.id,
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)

    for q in payload.questions:
        db.add(
            PastPaperQuestion(
                past_paper_id=paper.id,
                question_number=q.question_number,
                question_text=q.question_text,
                marks=q.marks,
                topic_id=q.topic_id,
                answer_guide=q.answer_guide,
            )
        )
    db.commit()
    db.refresh(paper)
    return paper


@router.post("/past-papers/{paper_id}/file")
def attach_past_paper_file(paper_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Optional: attach the original scanned/PDF past paper file for reference/download."""
    paper = db.query(PastPaper).filter(PastPaper.id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Past paper not found")
    path = _save_upload(file, "past_papers")
    paper.filename = file.filename or "past_paper"
    paper.storage_path = path
    db.commit()
    return {"ok": True}
