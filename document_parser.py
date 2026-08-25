"""Extracts plain text from uploaded documents (syllabus, textbooks, pamphlets,
past papers) and heuristically splits a syllabus into an ordered topic list.

Supports .docx and .pdf and falls back to plain-text reading for anything else
(.txt, .md). This keeps the "upload approved materials" flow usable without
requiring a specific file format from admins.
"""
import re
from pathlib import Path


def extract_text(path: str) -> str:
    suffix = Path(path).suffix.lower()
    try:
        if suffix == ".docx":
            import docx

            doc = docx.Document(path)
            parts = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    parts.append(" | ".join(c.text.strip() for c in row.cells))
            return "\n".join(parts)
        elif suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(path)
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            return Path(path).read_text(errors="ignore")
    except Exception as exc:  # pragma: no cover - defensive
        return f"[Could not extract text from {Path(path).name}: {exc}]"


# Lines that look like a syllabus topic/unit heading, e.g.:
#   "1. Algebra", "Topic 3: Linear Equations", "Unit 2 - Fractions", "2.1 Quadratic Equations"
_HEADING_PATTERNS = [
    re.compile(r"^\s*(?:Topic|Unit|Chapter|Theme)\s*\d+[:.\-]\s*(.+)$", re.IGNORECASE),
    re.compile(r"^\s*\d+(?:\.\d+)?[.):\-]\s*([A-Z][A-Za-z0-9 ,&'/()\-]{2,80})\s*$"),
]


def split_into_topics(text: str, max_topics: int = 40) -> list[str]:
    """Heuristically extract an ordered, de-duplicated list of topic titles
    from raw syllabus text. Falls back to short-line heuristics if no
    numbered/labelled headings are found."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    topics: list[str] = []
    seen: set[str] = set()

    for line in lines:
        for pattern in _HEADING_PATTERNS:
            m = pattern.match(line)
            if m:
                title = m.group(1).strip().rstrip(".")
                key = title.lower()
                if title and key not in seen and len(title) <= 90:
                    topics.append(title)
                    seen.add(key)
                break

    if len(topics) < 2:
        # Fallback: treat short, title-like lines (no ending punctuation, <= 8 words)
        # as candidate topics - useful for loosely-formatted pamphlets.
        for line in lines:
            words = line.split()
            if 1 <= len(words) <= 8 and not line.endswith((".", ":", ";")) and line[0].isupper():
                key = line.lower()
                if key not in seen:
                    topics.append(line)
                    seen.add(key)
            if len(topics) >= max_topics:
                break

    return topics[:max_topics]
