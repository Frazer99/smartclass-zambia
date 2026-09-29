/* PDF material ingestion and syllabus-derived topics. */

ALTER TABLE public.content_materials
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS ingestion_error text;

ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS source_material_id uuid REFERENCES public.content_materials(id) ON DELETE SET NULL;

-- Past papers use the official Grade 8-12 labels. Learner profiles continue
-- using the app's internal 1-6 level values elsewhere.
ALTER TABLE public.past_papers DROP CONSTRAINT IF EXISTS past_papers_grade_check;
UPDATE public.past_papers
SET grade = LEAST(grade + 7, 12)
WHERE grade BETWEEN 1 AND 6;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.past_papers'::regclass
      AND conname = 'past_papers_grade_check'
  ) THEN
    ALTER TABLE public.past_papers
      ADD CONSTRAINT past_papers_grade_check CHECK (grade BETWEEN 8 AND 12);
  END IF;
END $$;

ALTER TABLE public.past_papers
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS source_material_id uuid REFERENCES public.content_materials(id) ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-materials', 'content-materials', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_upload_content_materials" ON storage.objects;
CREATE POLICY "admin_upload_content_materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-materials' AND public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_read_content_materials" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_content_materials" ON storage.objects;
CREATE POLICY "authenticated_read_content_materials" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'content-materials');

DROP POLICY IF EXISTS "admin_delete_content_materials" ON storage.objects;
CREATE POLICY "admin_delete_content_materials" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-materials' AND public.is_admin_profile_user());

DROP INDEX IF EXISTS public.idx_topics_source_material;
CREATE INDEX idx_topics_source_material ON public.topics(source_material_id);
