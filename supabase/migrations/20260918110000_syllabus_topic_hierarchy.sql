ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS parent_topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_topics_parent_topic ON public.topics(parent_topic_id);