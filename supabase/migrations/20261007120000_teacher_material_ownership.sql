/* Track the staff member who uploaded supplementary material. */

ALTER TABLE public.content_materials
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_materials_uploaded_by
  ON public.content_materials(uploaded_by);
