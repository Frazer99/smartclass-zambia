-- Allow the admin staff-management function to create admin profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  INSERT INTO public.profiles (id, full_name, grade, school, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'SmartClass User'
    ),
    CASE
      WHEN (NEW.raw_user_meta_data->>'grade') ~ '^[0-9]+$'
        AND (NEW.raw_user_meta_data->>'grade')::int BETWEEN 1 AND 6
        THEN (NEW.raw_user_meta_data->>'grade')::int
      ELSE 1
    END,
    NULLIF(trim(NEW.raw_user_meta_data->>'school'), ''),
    CASE WHEN requested_role IN ('parent', 'teacher', 'admin') THEN requested_role ELSE 'pupil' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
