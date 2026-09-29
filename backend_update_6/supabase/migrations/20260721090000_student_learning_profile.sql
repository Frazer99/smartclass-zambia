/*
# SmartClass Zambia — Student Learning Profile (Adaptive Learning Engine v2)

## Purpose
`progress_records` (mastery % + attempt counts) and `ai_interaction_logs`
(chat turns for the continuous-learning pipeline) already exist and keep
working exactly as before — nothing here replaces them, and no existing
code needs to change for the app to keep functioning. This migration adds
a richer layer alongside them, per the updated design: not just "was the
answer right," but *what kind* of mistake was made, *which* explanation
strategies have already been tried for this pupil on this topic, and a
mastery score that blends multiple signals rather than one quiz.

Why not replace progress_records? It's read by the dashboard, the lesson
page, the practice page, and lib/adaptiveLearning.ts today. Migrating all
of that to a new schema in the same pass as introducing it is exactly the
kind of big, simultaneous, hard-to-verify change worth avoiding — especially
here, where nothing can be tested against a live database before shipping.
student_topic_mastery is the intended richer replacement *eventually*;
today it's populated alongside progress_records, not instead of it, so the
app has a real migration path rather than a risky flag-day cutover.

## 1. student_interactions
One row per meaningful pupil interaction (a chat turn, a practice
question, a past-paper question) — richer than ai_interaction_logs, which
only covers AI chat turns. Includes what ai_interaction_logs doesn't:
which question was asked, the pupil's actual response, whether a mistake
was detected and what kind, and time spent.

- id, student_id, lesson_id (nullable), subject_id, topic_id,
  interaction_type ('chat' | 'practice_question' | 'past_paper_question'),
  question (nullable — chat turns may not have a formal question),
  student_response, ai_response, correct (nullable — not every interaction
  is right/wrong, e.g. an open chat question), difficulty (nullable),
  detected_mistake (nullable text — a short description of the
  misconception, e.g. "added instead of subtracting the constant term"),
  time_spent_seconds (nullable), created_at

## 2. student_topic_mastery
Per pupil per topic, blending multiple signals rather than a single quiz
score, matching the design's explicit list: quiz performance, repeated
questions, past-paper performance, teacher interaction, lesson completion,
recent performance.

- id, student_id, topic_id, mastery_score (0-100, blended — computed
  application-side, not by a trigger, since the exact weighting is a
  product decision likely to be tuned over time, and a trigger would
  freeze that decision in SQL where it's harder to iterate on), attempts,
  correct_attempts, last_attempt (timestamptz), confidence
  ('low' | 'medium' | 'high' — how much data backs this score; a mastery
  score from 2 attempts should be trusted less than one from 20),
  status ('needs_support' | 'developing' | 'good_progress' | 'proficient'
  | 'mastered' — the banded version of mastery_score, matching the
  design's 0-39/40-59/60-79/80-89/90-100 bands)

One row per (student_id, topic_id) — upserted as new interactions come in,
not appended to.

## 3. Security (RLS)
Same pattern as progress_records / practice_attempts: pupils see and
insert only their own rows; admins can read everything (for the
teacher/school analytics described in the design — aggregated views come
later, this migration only lays the row-level foundation they'd query).

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS student_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  interaction_type text NOT NULL,
  question text,
  student_response text,
  ai_response text,
  correct boolean,
  difficulty text,
  detected_mistake text,
  time_spent_seconds int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_interactions" ON student_interactions;
CREATE POLICY "select_own_interactions" ON student_interactions FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "insert_own_interactions" ON student_interactions;
CREATE POLICY "insert_own_interactions" ON student_interactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_interactions" ON student_interactions;
CREATE POLICY "admin_select_all_interactions" ON student_interactions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_student_interactions_student_topic
  ON student_interactions(student_id, topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_interactions_mistake
  ON student_interactions(topic_id) WHERE detected_mistake IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_topic_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  mastery_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
  attempts int NOT NULL DEFAULT 0,
  correct_attempts int NOT NULL DEFAULT 0,
  last_attempt timestamptz,
  confidence text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'needs_support',
  UNIQUE (student_id, topic_id)
);

ALTER TABLE student_topic_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_mastery" ON student_topic_mastery;
CREATE POLICY "select_own_mastery" ON student_topic_mastery FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "upsert_own_mastery" ON student_topic_mastery;
CREATE POLICY "upsert_own_mastery" ON student_topic_mastery FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "update_own_mastery" ON student_topic_mastery;
CREATE POLICY "update_own_mastery" ON student_topic_mastery FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_mastery" ON student_topic_mastery;
CREATE POLICY "admin_select_all_mastery" ON student_topic_mastery FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_student_topic_mastery_student
  ON student_topic_mastery(student_id, topic_id);
