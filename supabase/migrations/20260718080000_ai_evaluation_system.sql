/*
# SmartClass Zambia — AI Evaluation System (SRS 12.16)

## Purpose
SRS 12.16 defines four testing dimensions for the AI teacher: accuracy
("does the AI give correct answers?"), teaching quality ("does the AI
explain clearly?"), curriculum alignment ("does the AI follow the Zambian
syllabus?"), and user testing (a real-world process with students and
teachers, not something a database migration can automate). This migration
adds storage for the first three, run automatically by
scripts/run-ai-evaluation.js against a curated set of test cases built
from real seeded curriculum content (past-paper questions with known
correct answers), so quality can be tracked over time rather than judged
once and forgotten.

## 1. ai_eval_runs
One row per evaluation run (a full pass through the test case set).
- id, run_at, total_cases, passed_cases, avg_score (0-100), notes

## 2. ai_eval_results
One row per test case within a run.
- id, run_id, case_id (stable identifier from the test case file, so the
  same case can be tracked across runs), category
  ('accuracy' | 'teaching_quality' | 'curriculum_alignment'), question,
  response, passed, score (0-100), notes (what specifically passed/failed)

## 3. Security (RLS)
Read: admin only, same pattern as ai_interaction_logs — this is the
"analyze performance" data for the content team, not pupil-facing.
Write: the evaluation script runs with the Supabase service role key
(offline, from a developer machine or CI, never shipped in the app),
which bypasses RLS — no INSERT policy is required for the script to work.
No client-side code ever writes to these tables.

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS ai_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT now(),
  total_cases int NOT NULL,
  passed_cases int NOT NULL,
  avg_score numeric(5,2) NOT NULL,
  notes text
);

ALTER TABLE ai_eval_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ai_eval_runs" ON ai_eval_runs;
CREATE POLICY "admin_select_ai_eval_runs" ON ai_eval_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE TABLE IF NOT EXISTS ai_eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ai_eval_runs(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  category text NOT NULL,
  question text NOT NULL,
  response text,
  passed boolean NOT NULL,
  score numeric(5,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_eval_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ai_eval_results" ON ai_eval_results;
CREATE POLICY "admin_select_ai_eval_results" ON ai_eval_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_ai_eval_results_run ON ai_eval_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_eval_results_case ON ai_eval_results(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_run_at ON ai_eval_runs(run_at DESC);
