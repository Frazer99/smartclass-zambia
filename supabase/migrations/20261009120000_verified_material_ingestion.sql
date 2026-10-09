/* Keep uncertain ingestion unpublished until an administrator reviews it. */

ALTER TABLE public.content_materials
  ADD COLUMN IF NOT EXISTS ingestion_method text,
  ADD COLUMN IF NOT EXISTS ingestion_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS page_count integer;

ALTER TABLE public.past_paper_questions
  ADD COLUMN IF NOT EXISTS source_page integer,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "read_content_materials" ON public.content_materials;
DROP POLICY IF EXISTS "read_approved_content_materials" ON public.content_materials;
CREATE POLICY "read_approved_content_materials" ON public.content_materials
  FOR SELECT TO anon, authenticated
  USING (status IN ('approved', 'ingested') AND needs_review = false);

DROP POLICY IF EXISTS "admin_read_all_content_materials" ON public.content_materials;
CREATE POLICY "admin_read_all_content_materials" ON public.content_materials
  FOR SELECT TO authenticated
  USING (public.is_admin_profile_user());

CREATE INDEX IF NOT EXISTS content_materials_review_idx
  ON public.content_materials (needs_review, status, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS past_paper_questions_review_idx
  ON public.past_paper_questions (past_paper_id, needs_review, source_page);

NOTIFY pgrst, 'reload schema';
