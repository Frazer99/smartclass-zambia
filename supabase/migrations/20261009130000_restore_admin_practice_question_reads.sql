/* Keep practice answer keys private while restoring admin dashboard reads. */

DROP POLICY IF EXISTS "admin_read_practice_questions" ON public.practice_questions;
CREATE POLICY "admin_read_practice_questions" ON public.practice_questions
  FOR SELECT TO authenticated
  USING (public.is_admin_profile_user());

NOTIFY pgrst, 'reload schema';
