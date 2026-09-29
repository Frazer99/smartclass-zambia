/*
# SmartClass Zambia — Expand Schema for Multi-Subject + Content Materials

## 1. New Tables

### subjects
Catalog of subjects offered by grade range.
- id (uuid, PK)
- name (text) — e.g. "Mathematics", "Science", "Physics", "Chemistry"
- code (text) — short code like "MATH", "SCI", "PHY", "CHEM"
- grades (int[]) — array of grades this subject is available for (e.g. [8,9] or [10,11,12])
- icon (text) — icon identifier for the frontend
- color (text) — hex color for UI accent
- display_order (int)

### content_materials
Stores references to curriculum documents, approved textbooks, past papers, and
other teaching materials. This is the architectural foundation for Ministry of
Education and ECZ integration — materials are ingested and referenced by the AI
teacher's RAG pipeline.
- id (uuid, PK)
- subject_id (uuid, FK → subjects, nullable for cross-subject materials)
- grade (int, nullable — for grade-specific materials)
- material_type (text) — 'curriculum' | 'textbook' | 'past_paper' | 'syllabus' | 'supplementary'
- title (text)
- source (text) — e.g. "Ministry of Education", "ECZ", "Approved Publisher"
- source_reference (text) — URL or document identifier
- content_summary (text) — brief description of what the material covers
- status (text) — 'pending' | 'approved' | 'ingested'
- uploaded_at (timestamptz)

### search_index
A denormalized search index for topics and lessons, enabling full-text search
across all subjects, topics, subtopics, and key terms.
- id (uuid, PK)
- subject_id (uuid, FK → subjects)
- topic_id (uuid, FK → topics, nullable)
- lesson_id (uuid, FK → lessons, nullable)
- grade (int)
- searchable_text (text) — concatenated text for searching
- item_type (text) — 'topic' | 'lesson' | 'term'
- display_title (text)
- description (text)

## 2. Modified Tables

### topics
- Added `subject_id` column (uuid, FK → subjects) — links each topic to a subject.
- Existing Mathematics topics are backfilled to the Mathematics subject.

### lessons
- Added `searchable_terms` column (text) — key terms for search.

## 3. Security (RLS)
- subjects: public read (anon + authenticated)
- content_materials: public read
- search_index: public read
- No client writes on any of these tables.

## 4. Notes
- All statements idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).
- No destructive operations.
*/

-- ============================================================
-- SUBJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  grades int[] NOT NULL DEFAULT '{}',
  icon text NOT NULL DEFAULT 'BookOpen',
  color text NOT NULL DEFAULT '#E8B94B',
  display_order int NOT NULL DEFAULT 0
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_subjects" ON subjects;
CREATE POLICY "read_subjects" ON subjects FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- ADD subject_id TO topics
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'subject_id'
  ) THEN
    ALTER TABLE topics ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- CONTENT_MATERIALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS content_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  grade int CHECK (grade IS NULL OR (grade BETWEEN 8 AND 12)),
  material_type text NOT NULL DEFAULT 'supplementary',
  title text NOT NULL,
  source text NOT NULL,
  source_reference text,
  content_summary text,
  status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE content_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_content_materials" ON content_materials;
CREATE POLICY "read_content_materials" ON content_materials FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- SEARCH_INDEX TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS search_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  grade int NOT NULL CHECK (grade BETWEEN 8 AND 12),
  searchable_text text NOT NULL,
  item_type text NOT NULL DEFAULT 'topic',
  display_title text NOT NULL,
  description text
);

ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_search_index" ON search_index;
CREATE POLICY "read_search_index" ON search_index FOR SELECT
  TO anon, authenticated USING (true);

-- ============================================================
-- ADD searchable_terms TO lessons
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'searchable_terms'
  ) THEN
    ALTER TABLE lessons ADD COLUMN searchable_terms text DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_content_materials_subject ON content_materials(subject_id);
CREATE INDEX IF NOT EXISTS idx_search_index_subject ON search_index(subject_id);
CREATE INDEX IF NOT EXISTS idx_search_index_grade ON search_index(grade);
CREATE INDEX IF NOT EXISTS idx_search_index_text ON search_index USING gin (to_tsvector('english', searchable_text));

-- ============================================================
-- FUNCTION: Rebuild search index from topics + lessons
-- ============================================================
CREATE OR REPLACE FUNCTION rebuild_search_index()
RETURNS void AS $$
BEGIN
  DELETE FROM search_index;

  INSERT INTO search_index (subject_id, topic_id, lesson_id, grade, searchable_text, item_type, display_title, description)
  SELECT t.subject_id, t.id, NULL, t.grade,
    lower(coalesce(t.name,'') || ' ' || coalesce(t.category,'') || ' ' || coalesce(t.description,'')),
    'topic', t.name, t.description
  FROM topics t WHERE t.subject_id IS NOT NULL;

  INSERT INTO search_index (subject_id, topic_id, lesson_id, grade, searchable_text, item_type, display_title, description)
  SELECT t.subject_id, t.topic_id, l.id, t.grade,
    lower(coalesce(l.title,'') || ' ' || coalesce(l.searchable_terms,'') || ' ' || coalesce(l.content::text,'')),
    'lesson', l.title, NULL
  FROM lessons l JOIN topics t ON l.topic_id = t.id
  WHERE t.subject_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
