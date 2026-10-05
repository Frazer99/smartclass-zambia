/* Attach an optional prerecorded solution video to each past paper. */

ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS solution_video_storage_path text;
