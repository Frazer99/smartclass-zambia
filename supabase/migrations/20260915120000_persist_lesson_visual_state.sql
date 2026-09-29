ALTER TABLE public.lesson_sessions
  ADD COLUMN IF NOT EXISTS lesson_phase text NOT NULL DEFAULT 'intro',
  ADD COLUMN IF NOT EXISTS lesson_step_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS board_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS awaiting_understanding_check boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.lesson_sessions'::regclass
      AND conname = 'lesson_sessions_phase_check'
  ) THEN
    ALTER TABLE public.lesson_sessions
      ADD CONSTRAINT lesson_sessions_phase_check
      CHECK (lesson_phase IN ('intro', 'steps', 'examples', 'summary', 'complete'));
  END IF;
END $$;