/*
# Admin past-paper management

Allow admin users to manage past-paper metadata and its questions while
keeping public read access unchanged for pupils.
*/

DROP POLICY IF EXISTS "admin_insert_past_papers" ON public.past_papers;
CREATE POLICY "admin_insert_past_papers" ON public.past_papers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_update_past_papers" ON public.past_papers;
CREATE POLICY "admin_update_past_papers" ON public.past_papers
  FOR UPDATE TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_delete_past_papers" ON public.past_papers;
CREATE POLICY "admin_delete_past_papers" ON public.past_papers
  FOR DELETE TO authenticated
  USING (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_insert_past_paper_questions" ON public.past_paper_questions;
CREATE POLICY "admin_insert_past_paper_questions" ON public.past_paper_questions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_update_past_paper_questions" ON public.past_paper_questions;
CREATE POLICY "admin_update_past_paper_questions" ON public.past_paper_questions
  FOR UPDATE TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_delete_past_paper_questions" ON public.past_paper_questions;
CREATE POLICY "admin_delete_past_paper_questions" ON public.past_paper_questions
  FOR DELETE TO authenticated
  USING (public.is_admin_profile_user());
