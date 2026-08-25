"""Lightweight Retrieval-Augmented Generation (RAG) substrate.

Uses TF-IDF over admin-approved materials (books, pamphlets, notes) and
syllabus text linked to a topic, so the AI teacher's explanations are
grounded in the uploaded curriculum content rather than invented. This is
the retrieval layer described in SRS section 5.2 / 12.6; swapping in a real
vector DB (pgvector) + embeddings model later does not change the interface
used by the SmartTeach engine (`retrieve_context`).
"""
from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class RetrievedChunk:
    source_title: str
    text: str
    score: float


def _chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    text = text.strip()
    if not text:
        return []
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i : i + chunk_size]))
    return chunks


def retrieve_context(query: str, documents: list[tuple[str, str]], top_k: int = 3) -> list[RetrievedChunk]:
    """documents: list of (source_title, text). Returns top_k most relevant chunks."""
    corpus_titles: list[str] = []
    corpus_chunks: list[str] = []
    for title, text in documents:
        for chunk in _chunk_text(text):
            corpus_titles.append(title)
            corpus_chunks.append(chunk)

    if not corpus_chunks:
        return []

    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=4096)
        matrix = vectorizer.fit_transform(corpus_chunks + [query])
        query_vec = matrix[-1]
        doc_matrix = matrix[:-1]
        sims = cosine_similarity(query_vec, doc_matrix).flatten()
    except ValueError:
        # e.g. empty vocabulary after stop-word removal
        return [RetrievedChunk(corpus_titles[i], corpus_chunks[i], 0.0) for i in range(min(top_k, len(corpus_chunks)))]

    ranked = sorted(range(len(corpus_chunks)), key=lambda i: sims[i], reverse=True)[:top_k]
    return [RetrievedChunk(corpus_titles[i], corpus_chunks[i], float(sims[i])) for i in ranked if sims[i] > 0] or [
        RetrievedChunk(corpus_titles[0], corpus_chunks[0], 0.0)
    ]
