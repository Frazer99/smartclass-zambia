/*
# SmartClass Zambia — Link Past Paper Questions to Topics

## Purpose
past_paper_questions currently has no link to the topics table (past
papers are organized by subject/grade/year, not by topic). This means
past_paper_attempts couldn't feed lib/adaptiveLearning.ts's per-topic weak
area analysis, even though a pupil getting a quadratic-equations past-paper
question wrong is exactly the same signal as getting a practice question
on that topic wrong.

## Change
Adds a nullable topic_id to past_paper_questions. Nullable because not
every past-paper question needs to be tagged to appear in the paper itself
— tagging is opt-in, done by an admin when they want that question to
count toward adaptive learning, and untagged questions simply don't
contribute to weak-area analysis (they still work fine as ordinary
past-paper questions).

All statements are idempotent. No destructive operations; no data loss for
existing rows (the new column defaults to NULL).
*/

ALTER TABLE past_paper_questions
  ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_past_paper_questions_topic
  ON past_paper_questions(topic_id) WHERE topic_id IS NOT NULL;

-- Best-effort auto-tagging for the seeded example papers (SRS 20260712090500):
-- link each seeded question to a topic with a matching name, where one
-- exists for that paper's grade. Silently does nothing where no exact
-- name match exists — this is a convenience for the demo data, not a
-- requirement; untagged rows remain valid.
DO $$
DECLARE
  q RECORD;
  matched_topic_id uuid;
BEGIN
  FOR q IN
    SELECT ppq.id AS question_id, pp.grade, ppq.question_text
    FROM past_paper_questions ppq
    JOIN past_papers pp ON pp.id = ppq.past_paper_id
    WHERE ppq.topic_id IS NULL
  LOOP
    SELECT t.id INTO matched_topic_id
    FROM topics t
    WHERE t.grade = q.grade
      AND (
        q.question_text ILIKE '%quadratic%' AND t.name ILIKE '%quadratic%'
        OR q.question_text ILIKE '%factor%' AND t.name ILIKE '%quadratic%'
        OR q.question_text ILIKE '%gradient%' AND t.name ILIKE '%coordinate%'
        OR q.question_text ILIKE '%force%' AND t.name ILIKE '%force%'
        OR q.question_text ILIKE '%acceleration%' AND t.name ILIKE '%motion%'
        OR q.question_text ILIKE '%velocity%' AND t.name ILIKE '%motion%'
      )
    LIMIT 1;

    IF matched_topic_id IS NOT NULL THEN
      UPDATE past_paper_questions SET topic_id = matched_topic_id WHERE id = q.question_id;
    END IF;
    matched_topic_id := NULL;
  END LOOP;
END $$;
