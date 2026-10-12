/* Persist self-paced past-paper progress alongside the existing transcript. */

ALTER TABLE public.past_paper_transcripts
  ADD COLUMN IF NOT EXISTS current_question_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elapsed_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS board_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS awaiting_understanding_check boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrST, 'reload schema';