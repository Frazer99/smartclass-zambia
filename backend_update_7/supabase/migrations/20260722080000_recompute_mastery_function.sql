/*
# SmartClass Zambia — Shared Mastery Recompute Function

## Purpose
ai-teacher-chat already recomputes student_topic_mastery inline in
TypeScript after logging a chat interaction (see logStudentInteraction in
supabase/functions/ai-teacher-chat/index.ts). Wiring the practice page and
past-paper runner into the same Student Learning Profile tables means
either duplicating that exact math in two more places, or extracting it
once and having all three call sites share it. This migration does the
latter: recompute_topic_mastery(student, topic) — callable via RPC from
an Edge Function or directly from the frontend (both already have a
Supabase client) — is now the single source of truth for "how do we turn
a pupil's interaction history into a mastery score." The Edge Function's
inline version will be replaced with a call to this in the same pass that
introduces this migration.

## Function
recompute_topic_mastery(p_student_id uuid, p_topic_id uuid) RETURNS void

Reads every student_interactions row for that student+topic where
`correct` is not null (i.e. actually assessable — most open chat turns
correctly have correct = null and don't count), computes mastery_score as
percent-correct, sets confidence based on sample size, and upserts the
result into student_topic_mastery. Identical logic to what ai-teacher-chat
was computing inline; this migration doesn't change the math, only where
it lives.

SECURITY DEFINER so a pupil calling this via RPC (their own row, gated by
student_topic_mastery's existing RLS on the upsert target) doesn't need
direct SELECT rights on student_interactions beyond what RLS already
grants them for their own rows anyway — in practice this doesn't grant
any new access, since a pupil can already read/write their own rows in
both tables, but keeps the function's internal read from being coupled to
whichever RLS policies happen to exist on the caller's session.

Idempotent (CREATE OR REPLACE), no destructive operations.
*/

CREATE OR REPLACE FUNCTION recompute_topic_mastery(p_student_id uuid, p_topic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts int;
  v_correct int;
  v_score numeric(5,2);
  v_confidence text;
  v_status text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE correct)
  INTO v_attempts, v_correct
  FROM student_interactions
  WHERE student_id = p_student_id AND topic_id = p_topic_id AND correct IS NOT NULL;

  IF v_attempts = 0 THEN
    RETURN;
  END IF;

  v_score := ROUND((v_correct::numeric / v_attempts) * 100, 2);
  v_confidence := CASE WHEN v_attempts >= 10 THEN 'high' WHEN v_attempts >= 4 THEN 'medium' ELSE 'low' END;
  v_status := CASE
    WHEN v_score >= 90 THEN 'mastered'
    WHEN v_score >= 80 THEN 'proficient'
    WHEN v_score >= 60 THEN 'good_progress'
    WHEN v_score >= 40 THEN 'developing'
    ELSE 'needs_support'
  END;

  INSERT INTO student_topic_mastery
    (student_id, topic_id, mastery_score, attempts, correct_attempts, last_attempt, confidence, status)
  VALUES
    (p_student_id, p_topic_id, v_score, v_attempts, v_correct, now(), v_confidence, v_status)
  ON CONFLICT (student_id, topic_id) DO UPDATE SET
    mastery_score = EXCLUDED.mastery_score,
    attempts = EXCLUDED.attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    last_attempt = EXCLUDED.last_attempt,
    confidence = EXCLUDED.confidence,
    status = EXCLUDED.status;
END;
$$;

GRANT EXECUTE ON FUNCTION recompute_topic_mastery TO authenticated, service_role;
