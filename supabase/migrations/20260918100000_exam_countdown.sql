CREATE TABLE IF NOT EXISTS public.exam_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id)
);

ALTER TABLE public.exam_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_exam_dates" ON public.exam_dates;
CREATE POLICY "select_own_exam_dates" ON public.exam_dates FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "insert_own_exam_dates" ON public.exam_dates;
CREATE POLICY "insert_own_exam_dates" ON public.exam_dates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "update_own_exam_dates" ON public.exam_dates;
CREATE POLICY "update_own_exam_dates" ON public.exam_dates FOR UPDATE TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "delete_own_exam_dates" ON public.exam_dates;
CREATE POLICY "delete_own_exam_dates" ON public.exam_dates FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_exam_dates_student_date ON public.exam_dates(student_id, exam_date);