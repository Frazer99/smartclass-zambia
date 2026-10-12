ALTER TABLE public.lesson_sessions
  DROP CONSTRAINT IF EXISTS lesson_sessions_phase_check;

ALTER TABLE public.lesson_sessions
  ADD CONSTRAINT lesson_sessions_phase_check
  CHECK (lesson_phase IN ('intro', 'steps', 'examples', 'guided_practice', 'independent_practice', 'assessment', 'summary', 'complete'));

NOTIFY pgrST, 'reload schema';