/* Keep the admin Users tab complete if an auth profile trigger was unavailable
   when a pupil registered. */

CREATE OR REPLACE FUNCTION public.admin_sync_registered_pupils()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin_profile_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.profiles (id, full_name, grade, school)
  SELECT
    u.id,
    COALESCE(
      NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
      'SmartClass User'
    ),
    CASE
      WHEN (u.raw_user_meta_data->>'grade') ~ '^[0-9]+$'
        AND (u.raw_user_meta_data->>'grade')::integer BETWEEN 1 AND 6
        THEN (u.raw_user_meta_data->>'grade')::integer
      ELSE 1
    END,
    NULLIF(trim(u.raw_user_meta_data->>'school'), '')
  FROM auth.users AS u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = u.id
  );

  RETURN QUERY
    SELECT p.*
    FROM public.profiles AS p
    ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sync_registered_pupils() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sync_registered_pupils() TO authenticated;