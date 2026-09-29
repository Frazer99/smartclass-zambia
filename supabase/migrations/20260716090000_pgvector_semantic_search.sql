/*
# SmartClass Zambia — Real Vector Search (pgvector)

## Purpose
Replaces the keyword/ILIKE-based retrieval in ai-teacher-chat (SRS 12.6)
with real semantic vector search, using OpenAI's text-embedding-3-small
(1536 dimensions) and Postgres's pgvector extension — exactly the stack
SRS 13.3/13.6 originally specified ("PostgreSQL + pgvector") and which the
first RAG implementation approximated with ILIKE because no embeddings
existed yet. Keyword matching was a reasonable MVP stand-in; this migration
is the real thing it was standing in for.

Semantic search finds conceptually related content even when the pupil's
wording shares no keywords with the source material — e.g. a pupil asking
"why does the sign flip when I divide by a negative number" should match
curriculum content about inequality properties even though it shares no
significant words with a title like "Zambian Curriculum Mathematics
Syllabus Form 1-6."

## 1. Extension
Enables the `vector` extension (pgvector), available on all Supabase
projects without additional setup.

## 2. Embedding columns
Adds a nullable `embedding vector(1536)` column to the three tables
ai-teacher-chat searches: `content_materials`, `search_index`, and
`past_paper_questions`. Nullable because embeddings are generated
asynchronously (by the content-materials Edge Function on write, or via
the new generate-embeddings Edge Function for backfilling existing rows)
rather than computed in SQL — Postgres has no built-in way to call the
OpenAI API. Rows without an embedding yet simply don't participate in
vector search; ai-teacher-chat still falls back to keyword search for
anything not yet embedded (or if OPENAI_API_KEY isn't configured at all,
since generating a query embedding needs that same API).

## 3. Indexes
IVFFlat cosine-distance indexes for approximate nearest-neighbor search at
scale. `lists = 100` is a reasonable default for a table in the thousands-
to-low-tens-of-thousands of rows range (Supabase/pgvector's own guidance:
roughly rows/1000, with a floor around 10-100 for small tables) — fine to
increase later via `REINDEX` as content volume grows; doesn't need to be
exact from day one.

## 4. Similarity search functions
Three `match_*` RPC functions (SQL, not PL/pgSQL — simple enough not to
need it), each taking a query embedding plus optional grade/subject
filters, returning the top N matches ranked by cosine similarity
(`1 - (embedding <=> query_embedding)`, pgvector's `<=>` operator).
Grade/subject filtering happens in SQL rather than after the fact in the
Edge Function, so the vector index does less wasted work.

All statements are idempotent. No destructive operations.
*/

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. Embedding columns
-- ============================================================

ALTER TABLE content_materials ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE search_index ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE past_paper_questions ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ============================================================
-- 2. Indexes (IVFFlat, cosine distance)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_materials_embedding') THEN
    CREATE INDEX idx_content_materials_embedding ON content_materials
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_search_index_embedding') THEN
    CREATE INDEX idx_search_index_embedding ON search_index
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_past_paper_questions_embedding') THEN
    CREATE INDEX idx_past_paper_questions_embedding ON past_paper_questions
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  END IF;
END $$;

-- ============================================================
-- 3. Similarity search functions
-- ============================================================

CREATE OR REPLACE FUNCTION match_content_materials(
  query_embedding vector(1536),
  match_grade int DEFAULT NULL,
  match_subject_id uuid DEFAULT NULL,
  match_count int DEFAULT 4
)
RETURNS TABLE (
  id uuid,
  title text,
  source text,
  material_type text,
  content_summary text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cm.id, cm.title, cm.source, cm.material_type, cm.content_summary,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM content_materials cm
  WHERE cm.embedding IS NOT NULL
    AND (match_grade IS NULL OR cm.grade IS NULL OR cm.grade = match_grade)
    AND (match_subject_id IS NULL OR cm.subject_id IS NULL OR cm.subject_id = match_subject_id)
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_search_index(
  query_embedding vector(1536),
  match_grade int DEFAULT NULL,
  match_count int DEFAULT 4
)
RETURNS TABLE (
  id uuid,
  display_title text,
  description text,
  item_type text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    si.id, si.display_title, si.description, si.item_type,
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM search_index si
  WHERE si.embedding IS NOT NULL
    AND (match_grade IS NULL OR si.grade = match_grade)
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_past_paper_questions(
  query_embedding vector(1536),
  match_count int DEFAULT 2
)
RETURNS TABLE (
  id uuid,
  question_text text,
  explanation text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ppq.id, ppq.question_text, ppq.explanation,
    1 - (ppq.embedding <=> query_embedding) AS similarity
  FROM past_paper_questions ppq
  WHERE ppq.embedding IS NOT NULL
    AND ppq.explanation IS NOT NULL
  ORDER BY ppq.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Callable by the service role (Edge Functions) and authenticated users
-- (RLS on the underlying tables still applies to what the function can see).
GRANT EXECUTE ON FUNCTION match_content_materials TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_search_index TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_past_paper_questions TO anon, authenticated, service_role;

-- ============================================================
-- 4. Continuous learning pipeline: track which retrieval method
--    was used per AI interaction (SRS 12.17 / 12.6)
-- ============================================================

ALTER TABLE ai_interaction_logs ADD COLUMN IF NOT EXISTS retrieval_method text;
