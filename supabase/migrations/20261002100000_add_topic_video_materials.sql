ALTER TABLE public.content_materials
  ADD COLUMN IF NOT EXISTS topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_materials_topic_video
  ON public.content_materials(topic_id, material_type);