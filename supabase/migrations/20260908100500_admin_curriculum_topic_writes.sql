/* Admin topic creation for curriculum management. */

DROP POLICY IF EXISTS "admin_insert_topics" ON public.topics;
CREATE POLICY "admin_insert_topics" ON public.topics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_update_topics" ON public.topics;
CREATE POLICY "admin_update_topics" ON public.topics
  FOR UPDATE TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_delete_topics" ON public.topics;
CREATE POLICY "admin_delete_topics" ON public.topics
  FOR DELETE TO authenticated
  USING (public.is_admin_profile_user());
