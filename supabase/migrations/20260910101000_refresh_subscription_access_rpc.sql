/* Ensure the admin access RPC is visible to Supabase REST after deployment. */

CREATE OR REPLACE FUNCTION public.set_platform_free_mode(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_profile_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('is_platform_free', to_jsonb(p_enabled), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_platform_free_mode(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_free_mode(boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
