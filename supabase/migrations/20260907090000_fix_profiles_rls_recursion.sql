/*
# Fix recursive profiles RLS policies

The admin profile policies previously queried profiles from inside a
profiles policy, which causes PostgreSQL to recurse indefinitely. The helper
runs as the policy owner so its role lookup bypasses profiles RLS.
*/

CREATE OR REPLACE FUNCTION public.is_admin_profile_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_profile_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_profile_user() TO authenticated;

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin_profile_user());

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin_profile_user())
  WITH CHECK (auth.uid() = id OR public.is_admin_profile_user());
