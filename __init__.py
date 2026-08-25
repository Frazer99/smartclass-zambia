from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def now_utc():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="student")  # student | admin
    form_level = Column(Integer, nullable=True)  # 2-6, applies to students
    created_at = Column(DateTime, default=now_utc)

    subscriptions = relationship("Subscription", back_populates="user")
    sessions = relationship("LessonSession", back_populates="user")


# ---------------------------------------------------------------------------
# Curriculum structure: Subject -> Form availability, Topics (from syllabus)
# ---------------------------------------------------------------------------
class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # Mathematics | Physics | Chemistry | Science
    description = Column(Text, nullable=True)

    topics = relationship("Topic", back_populates="subject")


class SubjectFormOffering(Base):
    """Which subjects are offered at which Form level, e.g. Form 2-3: Math+Science,
    Form 4-6: Math+Physics+Chemistry. Kept in DB (not hardcoded) so admins can adjust."""

    __tablename__ = "subject_form_offerings"
    __table_args__ = (UniqueConstraint("subject_id", "form_level", name="uq_subject_form"),)

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    form_level = Column(Integer, nullable=False)  # 2,3,4,5,6

    subject = relationship("Subject")


class SyllabusDocument(Base):
    """An uploaded syllabus document. Parsed to auto-generate Topics for a subject/form."""

    __tablename__ = "syllabus_documents"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    form_level = Column(Integer, nullable=False)
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=now_utc)
    parsed = Column(Boolean, default=False)
    raw_text_excerpt = Column(Text, nullable=True)

    subject = relationship("Subject")


class Topic(Base):
    """A syllabus topic, either auto-extracted from an uploaded syllabus or added by an admin."""

    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    form_level = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    source_syllabus_id = Column(Integer, ForeignKey("syllabus_documents.id"), nullable=True)

    subject = relationship("Subject", back_populates="topics")
    materials = relationship("Material", back_populates="topic")


# ---------------------------------------------------------------------------
# Approved materials: textbooks, pamphlets, notes -> feed the RAG knowledge base
# ---------------------------------------------------------------------------
class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    form_level = Column(Integer, nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    title = Column(String, nullable=False)
    material_type = Column(String, default="note")  # book | pamphlet | note | marking_scheme
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    extracted_text = Column(Text, nullable=True)  # used for retrieval (RAG)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=now_utc)

    topic = relationship("Topic", back_populates="materials")
    subject = relationship("Subject")


# ---------------------------------------------------------------------------
# Past papers
# ---------------------------------------------------------------------------
class PastPaper(Base):
    __tablename__ = "past_papers"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    form_level = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    term = Column(String, nullable=True)
    title = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    storage_path = Column(String, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=now_utc)

    subject = relationship("Subject")
    questions = relationship("PastPaperQuestion", back_populates="past_paper", order_by="PastPaperQuestion.question_number")


class PastPaperQuestion(Base):
    __tablename__ = "past_paper_questions"

    id = Column(Integer, primary_key=True, index=True)
    past_paper_id = Column(Integer, ForeignKey("past_papers.id"), nullable=False)
    question_number = Column(String, nullable=False)  # "1", "2a", "2b", etc.
    question_text = Column(Text, nullable=False)
    marks = Column(Integer, nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    answer_guide = Column(Text, nullable=True)  # model answer / marking scheme, used to ground the AI walkthrough

    past_paper = relationship("PastPaper", back_populates="questions")
    topic = relationship("Topic")


# ---------------------------------------------------------------------------
# Lesson / Past-paper interactive sessions (AI teacher)
# ---------------------------------------------------------------------------
class LessonSession(Base):
    __tablename__ = "lesson_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mode = Column(String, nullable=False)  # "lesson" | "past_paper"
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    past_paper_id = Column(Integer, ForeignKey("past_papers.id"), nullable=True)
    started_at = Column(DateTime, default=now_utc)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    state = Column(JSON, default=dict)  # SmartTeach engine state machine snapshot

    user = relationship("User", back_populates="sessions")
    messages = relationship("LessonMessage", back_populates="session", order_by="LessonMessage.id")


class LessonMessage(Base):
    __tablename__ = "lesson_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("lesson_sessions.id"), nullable=False)
    role = Column(String, nullable=False)  # teacher | student | system
    content = Column(Text, nullable=False)
    whiteboard = Column(JSON, nullable=True)  # list of board line objects
    created_at = Column(DateTime, default=now_utc)

    session = relationship("LessonSession", back_populates="messages")


# ---------------------------------------------------------------------------
# Practice / quiz attempts & progress
# ---------------------------------------------------------------------------
class PracticeAttempt(Base):
    __tablename__ = "practice_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("lesson_sessions.id"), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    past_paper_question_id = Column(Integer, ForeignKey("past_paper_questions.id"), nullable=True)
    answer_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=True)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc)


class ProgressRecord(Base):
    __tablename__ = "progress_records"
    __table_args__ = (UniqueConstraint("user_id", "topic_id", name="uq_user_topic"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    mastery_score = Column(Float, default=0.0)  # 0-100
    lessons_completed = Column(Integer, default=0)
    questions_attempted = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)


# ---------------------------------------------------------------------------
# Free trial usage + Subscriptions + Payments
# ---------------------------------------------------------------------------
class TrialUsage(Base):
    """Tracks the free 10-minutes-per-subject trial allowance for a user."""

    __tablename__ = "trial_usage"
    __table_args__ = (UniqueConstraint("user_id", "subject_id", name="uq_user_subject_trial"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    seconds_used = Column(Integer, default=0)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    status = Column(String, default="pending")  # pending | active | expired | cancelled
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    amount_zmw = Column(Float, default=50.0)
    created_at = Column(DateTime, default=now_utc)

    user = relationship("User", back_populates="subscriptions")
    subject = relationship("Subject")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    amount_zmw = Column(Float, nullable=False)
    method = Column(String, nullable=False)  # mtn_momo | airtel_money | visa
    msisdn = Column(String, nullable=True)  # mobile money phone number
    provider_reference = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending | success | failed
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)
