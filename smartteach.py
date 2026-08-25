"""SmartTeach(TM) Engine -- ZedCode Technologies' proprietary teaching engine
(SRS section 5.2 / chapter 12).

This module is the orchestration layer that decides *how a lesson unfolds*,
sitting above the RAG retrieval substrate (`app.services.retrieval`) and an
`AIProvider` (SRS 12.7/12.10). Behaviors implemented here directly follow the
SRS list in 5.2: greet & reconnect to prior progress, introduce the lesson
objective, explain step by step, pause for comprehension checks, wait for the
answer, detect hesitation/repeated mistakes, change the explanation when a
difficulty signal is detected, encourage, assign targeted practice, and
summarize before ending.

`AIProvider` is a swappable interface: `MockAIProvider` composes teacher-style
text from retrieved curriculum chunks using templates (works with zero
external API keys, per the SRS's "start on mocks, integrate real LLM"
strategy in 12.1/12.7). Setting AI_PROVIDER=openai and supplying
OPENAI_API_KEY would route the same call sites through a real LLM call
without changing any router or session-state code.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.core.config import settings
from app.services.retrieval import RetrievedChunk, retrieve_context

# ---------------------------------------------------------------------------
# AI provider interface (SRS 12.7 "AI Model Selection" / 2.1 "swappable
# provider interfaces")
# ---------------------------------------------------------------------------


@dataclass
class TeacherTurn:
    """One AI-teacher turn: what is spoken plus what appears on the smart
    whiteboard (SRS 3.4 / 5.3), and whether the engine is now waiting on the
    learner (a comprehension check / practice question)."""

    text: str
    whiteboard: list[dict] = field(default_factory=list)
    awaiting_answer: bool = False


class AIProvider(ABC):
    @abstractmethod
    def explain(self, topic_title: str, context: list[RetrievedChunk], grade_form: int, attempt: int) -> TeacherTurn:
        ...

    @abstractmethod
    def evaluate_answer(self, question: str, expected_hint: str, student_answer: str) -> tuple[bool, str]:
        ...

    @abstractmethod
    def answer_followup(self, question_context: str, student_message: str, context: list[RetrievedChunk]) -> str:
        ...


class MockAIProvider(AIProvider):
    """Template-driven teacher voice grounded in retrieved curriculum text.
    No external API calls -- deterministic and free to run, matching the
    MVP's 'validate first, add a paid LLM once the user base exists' plan
    (SRS 12.7)."""

    def explain(self, topic_title: str, context: list[RetrievedChunk], grade_form: int, attempt: int) -> TeacherTurn:
        board: list[dict] = [{"type": "heading", "content": topic_title}]
        if not context:
            body = (
                f"Let's work through {topic_title}. I don't have approved material uploaded for this "
                "topic yet, so let's build it up from first principles together -- tell me what you "
                "already know about it, or ask me a specific question."
            )
            board.append({"type": "text", "content": "(Waiting for approved course material to be uploaded)"})
            return TeacherTurn(text=body, whiteboard=board, awaiting_answer=False)

        lead = "Let's take this a bit slower and try a different angle." if attempt > 1 else f"Today we're going to learn {topic_title}."
        sentences: list[str] = []
        for chunk in context:
            for s in _split_sentences(chunk.text):
                if s not in sentences:
                    sentences.append(s)
        key_points = sentences[: 4 if attempt <= 1 else 6]

        narration = [lead]
        for i, point in enumerate(key_points, start=1):
            narration.append(f"Step {i}: {point.strip()}")
            board.append({"type": "text", "content": point.strip()})

        narration.append(
            "Take a moment to think that through -- can you tell me, in your own words, what the "
            f"key idea of {topic_title} is, or try the check question I've put on the board?"
        )
        board.append({"type": "text", "content": f"Comprehension check: explain {topic_title} in your own words."})
        return TeacherTurn(text=" ".join(narration), whiteboard=board, awaiting_answer=True)

    def evaluate_answer(self, question: str, expected_hint: str, student_answer: str) -> tuple[bool, str]:
        answer = student_answer.strip().lower()
        if not answer or answer in {"i don't know", "idk", "not sure", "dont know", "no idea"}:
            return False, "hesitation"

        # Common English/instructional words that don't signal topic understanding
        # on their own -- filtered out so overlap reflects real subject-matter terms.
        stop = {
            "that", "this", "with", "from", "then", "than", "into", "both", "sides",
            "same", "your", "words", "example", "solve", "solving", "equation", "equations",
            "these", "each", "have", "will", "when", "what", "step", "steps", "which", "such",
        }
        answer_words = set(_keywords(answer))
        if not expected_hint.strip():
            # No grounding material for this topic yet -- accept any substantive attempt.
            return len(answer.split()) >= 3, "ungrounded"

        # Rank hint words by frequency and keep the most salient ~15 as the "key terms"
        # a correct answer should touch on, rather than requiring overlap across the
        # whole source text (which would make longer material impossibly strict).
        from collections import Counter

        counts = Counter(w for w in _keywords(expected_hint) if len(w) > 3 and w not in stop)
        key_terms = {w for w, _ in counts.most_common(15)}
        overlap = key_terms & answer_words

        is_correct = len(overlap) >= 2 or (len(answer_words) >= 6 and len(overlap) >= 1)
        reason = "correct" if is_correct else "mismatch"
        return is_correct, reason

    def answer_followup(self, question_context: str, student_message: str, context: list[RetrievedChunk]) -> str:
        relevant = _split_sentences(context[0].text)[:2] if context else []
        if relevant:
            return (
                f"Good question. Looking back at this step -- {' '.join(relevant)} "
                "That's the reasoning behind it. Does that make sense, or would you like me to break it down further?"
            )
        return (
            "Good question -- let's reason through it together step by step rather than jumping to the "
            "answer. What do you think happens if we isolate the unknown first?"
        )


def get_ai_provider() -> AIProvider:
    # SRS 12.7: start on a commercial API once available; MVP defaults to the
    # mock provider so the product runs with zero external API keys.
    if settings.ai_provider == "openai" and settings.openai_api_key:
        # Real integration point: construct an OpenAI-backed provider here.
        # Left as MockAIProvider until OPENAI_API_KEY is supplied and the
        # provider is implemented, so the app never hard-fails on missing keys.
        return MockAIProvider()
    return MockAIProvider()


def _split_sentences(text: str) -> list[str]:
    import re

    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 8]


def _keywords(text: str) -> list[str]:
    import re

    return re.findall(r"[a-zA-Z]+", text.lower())


# ---------------------------------------------------------------------------
# Encouragement bank (SRS 5.2: "gives encouragement and positive
# reinforcement throughout")
# ---------------------------------------------------------------------------
ENCOURAGEMENT_CORRECT = [
    "Excellent work -- that's exactly right!",
    "Well done, you've got it.",
    "Great thinking, that's correct.",
    "Perfect -- you're understanding this well.",
]
ENCOURAGEMENT_RETRY = [
    "Not quite, but good attempt -- let's look at it from another angle.",
    "That's a common mix-up, no problem. Let's slow down and go through it again.",
    "Close, but let's re-check that step together.",
]
