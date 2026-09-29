CREATE TABLE IF NOT EXISTS public.test_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('online', 'upload')),
  submitted_text text,
  marks jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  maximum_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_test_submissions" ON public.test_submissions;
CREATE POLICY "select_own_test_submissions" ON public.test_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_test_submissions" ON public.test_submissions;
CREATE POLICY "insert_own_test_submissions" ON public.test_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_test_submissions" ON public.test_submissions;
CREATE POLICY "admin_read_test_submissions" ON public.test_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));