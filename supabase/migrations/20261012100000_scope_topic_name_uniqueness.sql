/* Allow the same topic name in different subjects while keeping syllabus retries idempotent. */

ALTER TABLE public.topics DROP CONSTRAINT IF EXISTS topics_grade_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS topics_subject_grade_name_unique
  ON public.topics(subject_id, grade, name)
  WHERE subject_id IS NOT NULL;

NOTIFY pgrST, 'reload schema';