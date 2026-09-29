/*
# SmartClass Zambia — Exam Countdown & Revision Recommendations

## Purpose
A pupil sets an exam date and gets a countdown plus real, personalized
recommendations — which topics to focus on and which past papers to
revise — rather than a generic reminder with no actual guidance.

## Why per-subject, not one exam date per pupil
Past papers and topic mastery are both already subject-scoped
throughout this project (past_papers.subject_id, topics.subject_id,
student_topic_mastery joins through topics to a subject). A single
"my exam date" field couldn't produce a genuinely targeted
recommendation — a pupil taking Mathematics, Physics, and Chemistry on
different dates needs different advice for each, not one blended list.
One row per (pupil, subject) instead, each with its own date.

## exam_dates
UNIQUE(student_id, subject_id) — setting a new date for a subject
updates the existing row rather than creating a second one; a pupil has
exactly one upcoming exam date per subject at a time.

## get_exam_prep_recommendations(subject_id)
Returns two kinds of rows in one result set (recommendation_type
'weak_topic' or 'past_paper'), both scoped to the calling pupil (auth.uid())
and their own grade — a Form 3 pupil never sees Form 5 recommendations.

- Weakest topics: the 5 lowest-mastery topics for this subject+grade,
  from student_topic_mastery (the richer adaptive learning engine v2
  signal, not the older progress_records) — a topic with no mastery row
  at all (never attempted) sorts to the very top via COALESCE(...,0),
  since "never touched" is at least as urgent as "attempted and still
  weak."
- Past papers to revise: ordered unattempted-first, then lowest
  correct-rate first — a paper with zero attempts sorts ahead of one
  that's been tried and gotten wrong, on the reasoning that an entirely
  unpracticed paper carries more unknown risk before an exam than one
  already partially attempted.

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS exam_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, subject_id)
);

ALTER TABLE exam_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_exam_dates" ON exam_dates;
CREATE POLICY "select_own_exam_dates" ON exam_dates FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "insert_own_exam_dates" ON exam_dates;
CREATE POLICY "insert_own_exam_dates" ON exam_dates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "update_own_exam_dates" ON exam_dates;
CREATE POLICY "update_own_exam_dates" ON exam_dates FOR UPDATE
  TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "delete_own_exam_dates" ON exam_dates;
CREATE POLICY "delete_own_exam_dates" ON exam_dates FOR DELETE
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_exam_dates" ON exam_dates;
CREATE POLICY "admin_select_all_exam_dates" ON exam_dates FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_exam_dates_student ON exam_dates(student_id, exam_date);

CREATE OR REPLACE FUNCTION get_exam_prep_recommendations(p_subject_id uuid)
RETURNS TABLE (
  recommendation_type text,
  item_id uuid,
  title text,
  detail text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grade int;
BEGIN
  SELECT grade INTO v_grade FROM profiles WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    'weak_topic'::text,
    t.id,
    t.name,
    COALESCE(stm.mastery_score::text || '% mastery', 'Not started yet')
  FROM topics t
  LEFT JOIN student_topic_mastery stm ON stm.topic_id = t.id AND stm.student_id = auth.uid()
  WHERE t.subject_id = p_subject_id AND t.grade = v_grade
  ORDER BY COALESCE(stm.mastery_score, 0) ASC
  LIMIT 5;

  RETURN QUERY
  SELECT
    'past_paper'::text,
    pp.id,
    pp.title,
    CASE
      WHEN attempt_stats.total_q IS NULL OR attempt_stats.total_q = 0 THEN 'Not attempted yet'
      ELSE ROUND(100.0 * attempt_stats.correct_q / attempt_stats.total_q)::text || '% correct so far'
    END
  FROM past_papers pp
  LEFT JOIN LATERAL (
    SELECT count(*) AS total_q, count(*) FILTER (WHERE ppa.is_correct) AS correct_q
    FROM past_paper_questions ppq
    JOIN past_paper_attempts ppa ON ppa.question_id = ppq.id AND ppa.user_id = auth.uid()
    WHERE ppq.past_paper_id = pp.id
  ) attempt_stats ON true
  WHERE pp.subject_id = p_subject_id AND pp.grade = v_grade
  ORDER BY COALESCE(100.0 * attempt_stats.correct_q / NULLIF(attempt_stats.total_q, 0), -1) ASC
  LIMIT 3;
END;
$$;

GRANT EXECUTE ON FUNCTION get_exam_prep_recommendations TO authenticated;
