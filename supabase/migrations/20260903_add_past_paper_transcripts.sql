-- Adds a table to persist interactive transcripts for past paper run sessions
CREATE TABLE IF NOT EXISTS past_paper_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  past_paper_id uuid NOT NULL REFERENCES past_papers(id) ON DELETE CASCADE,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT past_paper_transcripts_student_paper_key UNIQUE (student_id, past_paper_id)
);

ALTER TABLE past_paper_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_past_paper_transcripts" ON past_paper_transcripts;
CREATE POLICY "select_own_past_paper_transcripts" ON past_paper_transcripts FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "insert_own_past_paper_transcripts" ON past_paper_transcripts;
CREATE POLICY "insert_own_past_paper_transcripts" ON past_paper_transcripts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "update_own_past_paper_transcripts" ON past_paper_transcripts;
CREATE POLICY "update_own_past_paper_transcripts" ON past_paper_transcripts FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_past_paper_transcripts_student ON past_paper_transcripts(student_id, past_paper_id, created_at DESC);
