/* Create one in-app exam countdown notification per student, subject, and day. */

CREATE TABLE IF NOT EXISTS public.student_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'exam_countdown',
  title text NOT NULL,
  body text NOT NULL,
  notification_date date NOT NULL DEFAULT current_date,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, notification_type, notification_date)
);

ALTER TABLE public.student_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_student_notifications" ON public.student_notifications;
CREATE POLICY "select_own_student_notifications" ON public.student_notifications
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "update_own_student_notifications" ON public.student_notifications;
CREATE POLICY "update_own_student_notifications" ON public.student_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS student_notifications_student_created_idx
  ON public.student_notifications (student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_exam_countdown_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.student_notifications (
    student_id, subject_id, notification_type, title, body, notification_date
  )
  SELECT
    ed.student_id,
    ed.subject_id,
    'exam_countdown',
    CASE
      WHEN ed.exam_date = current_date THEN s.name || ' exam is today'
      ELSE s.name || ' exam countdown'
    END,
    CASE
      WHEN ed.exam_date = current_date THEN 'Your ' || s.name || ' exam is today. You are ready.'
      ELSE (ed.exam_date - current_date)::text || ' days until your ' || s.name || ' exam.'
    END,
    current_date
  FROM public.exam_dates ed
  JOIN public.subjects s ON s.id = ed.subject_id
  WHERE ed.student_id = auth.uid()
    AND ed.exam_date >= current_date
  ON CONFLICT (student_id, subject_id, notification_type, notification_date) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_exam_countdown_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_exam_countdown_notifications() TO authenticated;

NOTIFY pgrst, 'reload schema';
