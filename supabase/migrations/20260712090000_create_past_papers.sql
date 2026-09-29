/*
# SmartClass Zambia — Past Papers

## 1. New Tables

### past_papers
One row per ECZ-style past paper (a specific subject + grade + year + term).
- id (uuid, PK)
- subject_id (uuid, FK -> subjects)
- grade (int)
- year (int)
- term (text, nullable) — e.g. "Term 1", nullable when the paper isn't term-specific
- title (text) — e.g. "Grade 12 Mathematics Paper 1"
- total_marks (int, nullable)
- duration_minutes (int, nullable)
- source (text) — e.g. "ECZ"

### past_paper_questions
Individual questions within a past paper, structured the same way as
practice_questions so the same answer-checking and AI-explanation UI can be
reused.
- id (uuid, PK)
- past_paper_id (uuid, FK -> past_papers)
- question_number (int)
- question_text (text)
- question_type (text) — 'multiple_choice' | 'short_answer'
- options (jsonb, nullable)
- answer_key (text)
- explanation (text, nullable)
- marks (int)

## 2. Security (RLS)
- past_papers: public read (anon + authenticated), same policy shape as
  the existing curriculum tables.
- past_paper_questions: public read.
- No client writes on either table (content is seeded/admin-managed).

## 3. Notes
- All statements idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS).
- No destructive operations.
*/

CREATE TABLE IF NOT EXISTS past_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade int NOT NULL CHECK (grade BETWEEN 8 AND 12),
  year int NOT NULL,
  term text,
  title text NOT NULL,
  total_marks int,
  duration_minutes int,
  source text NOT NULL DEFAULT 'ECZ'
);

ALTER TABLE past_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_past_papers" ON past_papers;
CREATE POLICY "read_past_papers" ON past_papers FOR SELECT
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS past_paper_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  past_paper_id uuid NOT NULL REFERENCES past_papers(id) ON DELETE CASCADE,
  question_number int NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  options jsonb,
  answer_key text NOT NULL,
  explanation text,
  marks int NOT NULL DEFAULT 1
);

ALTER TABLE past_paper_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_past_paper_questions" ON past_paper_questions;
CREATE POLICY "read_past_paper_questions" ON past_paper_questions FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_past_paper_questions_paper
  ON past_paper_questions(past_paper_id, question_number);

CREATE INDEX IF NOT EXISTS idx_past_papers_subject_grade_year
  ON past_papers(subject_id, grade, year DESC);

-- Track attempts the same way practice_attempts does, so past-paper
-- progress can eventually roll into progress_records too.
CREATE TABLE IF NOT EXISTS past_paper_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES past_paper_questions(id) ON DELETE CASCADE,
  submitted_answer text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE past_paper_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_past_paper_attempts" ON past_paper_attempts;
CREATE POLICY "select_own_past_paper_attempts" ON past_paper_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_past_paper_attempts" ON past_paper_attempts;
CREATE POLICY "insert_own_past_paper_attempts" ON past_paper_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
