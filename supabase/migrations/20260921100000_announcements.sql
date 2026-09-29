CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_active_announcements" ON public.announcements;
CREATE POLICY "read_active_announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_insert_announcements" ON public.announcements;
CREATE POLICY "admin_insert_announcements" ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_profile_user() AND created_by = auth.uid());

DROP POLICY IF EXISTS "admin_update_announcements" ON public.announcements;
CREATE POLICY "admin_update_announcements" ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_delete_announcements" ON public.announcements;
CREATE POLICY "admin_delete_announcements" ON public.announcements
  FOR DELETE TO authenticated
  USING (public.is_admin_profile_user());

CREATE INDEX IF NOT EXISTS announcements_active_created_at_idx
  ON public.announcements (is_active, created_at DESC);