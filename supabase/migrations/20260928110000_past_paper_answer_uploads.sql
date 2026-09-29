-- Keep the uploaded answer/marking-scheme PDF associated with its paper.
ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS answer_storage_path text;