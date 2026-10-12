/* Persist every position needed to pause and resume a complete topic course. */

ALTER TABLE public.lesson_sessions
  ADD COLUMN IF NOT EXISTS planned_minutes integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS elapsed_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lesson_example_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lesson_practice_index integer NOT NULL DEFAULT 0;

UPDATE public.lessons
SET content = content || jsonb_build_object(
  'estimatedMinutes', GREATEST(COALESCE((content->>'estimatedMinutes')::integer, 0), 300),
  'minimumMinutes', 300
)
WHERE content IS NOT NULL;

UPDATE public.lesson_sessions ls
SET planned_minutes = GREATEST(
  300,
  COALESCE((l.content->>'estimatedMinutes')::integer, 0)
)
FROM public.lessons l
WHERE l.id = ls.lesson_id;

NOTIFY pgrST, 'reload schema';
