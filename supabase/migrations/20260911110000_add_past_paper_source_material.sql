/* Link ingested past papers back to their uploaded content material. */

ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS source_material_id uuid
  REFERENCES public.content_materials(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_past_papers_source_material
  ON public.past_papers(source_material_id);
