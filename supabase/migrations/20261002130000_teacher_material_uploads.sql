-- Allow approved teachers to upload teaching materials while keeping
-- material edits and deletion restricted to administrators.

DROP POLICY IF EXISTS "admin_upload_content_materials" ON storage.objects;
DROP POLICY IF EXISTS "staff_upload_content_materials" ON storage.objects;
CREATE POLICY "staff_upload_content_materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'content-materials'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR (profiles.role = 'teacher' AND profiles.teacher_approved = true))
    )
  );
