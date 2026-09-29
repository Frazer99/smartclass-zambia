ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS audio_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-recordings', 'feedback-recordings', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "upload_own_feedback_recordings" ON storage.objects;
CREATE POLICY "upload_own_feedback_recordings" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "read_own_feedback_recordings" ON storage.objects;
CREATE POLICY "read_own_feedback_recordings" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-recordings'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
  );
