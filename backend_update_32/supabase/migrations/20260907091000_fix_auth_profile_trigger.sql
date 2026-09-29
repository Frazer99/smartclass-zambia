/*
# Make auth profile creation safe for dashboard-created users

Users created from the Supabase dashboard have no raw signup metadata.
The previous trigger inserted a NULL full_name, violating profiles.full_name
NOT NULL and causing Auth to report "Database error creating new user".
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_grade integer;
BEGIN
  requested_grade := CASE
    WHEN NEW.raw_user_meta_data->>'grade' ~ '^[0-9]+$'
      THEN (NEW.raw_user_meta_data->>'grade')::integer
    ELSE NULL
  END;

  INSERT INTO public.profiles (id, full_name, grade, school)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'SmartClass User'
    ),
    CASE
      WHEN requested_grade BETWEEN 1 AND 6 THEN requested_grade
      ELSE 1
    END,
    NULLIF(trim(NEW.raw_user_meta_data->>'school'), '')
  );

  RETURN NEW;
END;
$$;
