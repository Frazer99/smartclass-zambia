-- Parent and teacher accounts, child links, and scoped dashboard RPCs.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';
  INSERT INTO public.profiles (id, full_name, grade, school, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'grade')::int, 1),
    NEW.raw_user_meta_data->>'school',
    CASE WHEN requested_role IN ('parent', 'teacher') THEN requested_role ELSE 'pupil' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (parent_id, child_id)
);
ALTER TABLE parent_child_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_parent_links" ON parent_child_links;
CREATE POLICY "select_own_parent_links" ON parent_child_links FOR SELECT TO authenticated USING (auth.uid() = parent_id);
DROP POLICY IF EXISTS "admin_select_all_parent_links" ON parent_child_links;
CREATE POLICY "admin_select_all_parent_links" ON parent_child_links FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent ON parent_child_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_child ON parent_child_links(child_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS teacher_approved boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION sync_parent_child_links()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO parent_child_links (parent_id, child_id)
  SELECT parent_profile.id, pupil.id
  FROM profiles pupil
  JOIN auth.users parent_user ON lower(parent_user.email) = lower(pupil.parent_email)
  JOIN profiles parent_profile ON parent_profile.id = parent_user.id AND parent_profile.role = 'parent'
  WHERE pupil.role = 'pupil' AND pupil.parent_email IS NOT NULL
  ON CONFLICT (parent_id, child_id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION sync_parent_child_links TO authenticated, service_role;

CREATE OR REPLACE FUNCTION trigger_sync_parent_links()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM sync_parent_child_links();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_parent_links ON profiles;
CREATE TRIGGER trg_sync_parent_links AFTER INSERT OR UPDATE OF parent_email, role ON profiles
FOR EACH ROW WHEN (NEW.role = 'parent' OR NEW.parent_email IS NOT NULL)
EXECUTE FUNCTION trigger_sync_parent_links();

CREATE OR REPLACE FUNCTION get_my_children()
RETURNS TABLE (child_id uuid, full_name text, grade int, school text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.full_name, p.grade, p.school
  FROM parent_child_links l JOIN profiles p ON p.id = l.child_id
  WHERE l.parent_id = auth.uid() ORDER BY p.full_name;
$$;
GRANT EXECUTE ON FUNCTION get_my_children TO authenticated;

CREATE OR REPLACE FUNCTION get_child_progress(p_child_id uuid)
RETURNS TABLE (topic_id uuid, topic_name text, subject_name text, mastery_percentage numeric, lessons_completed int, total_attempts int, correct_attempts int)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s progress';
  END IF;
  RETURN QUERY
  SELECT t.id, t.name, s.name, pr.mastery_percentage, pr.lessons_completed, pr.total_attempts, pr.correct_attempts
  FROM progress_records pr JOIN topics t ON t.id = pr.topic_id JOIN subjects s ON s.id = t.subject_id
  WHERE pr.user_id = p_child_id ORDER BY pr.mastery_percentage ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_child_progress TO authenticated;

CREATE OR REPLACE FUNCTION get_school_topic_analytics(p_school text DEFAULT NULL, p_grade int DEFAULT NULL)
RETURNS TABLE (subject_name text, topic_id uuid, topic_name text, pupil_count bigint, avg_mastery numeric, min_mastery numeric, max_mastery numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE teacher_school text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    SELECT school INTO teacher_school FROM profiles WHERE id = auth.uid() AND role = 'teacher' AND teacher_approved;
    IF teacher_school IS NULL OR p_school IS DISTINCT FROM teacher_school THEN RAISE EXCEPTION 'Admin or approved teacher access required'; END IF;
  END IF;
  RETURN QUERY SELECT s.name, t.id, t.name, count(DISTINCT stm.student_id), ROUND(AVG(stm.mastery_score), 1), MIN(stm.mastery_score), MAX(stm.mastery_score)
  FROM student_topic_mastery stm JOIN profiles p ON p.id = stm.student_id JOIN topics t ON t.id = stm.topic_id JOIN subjects s ON s.id = t.subject_id
  WHERE (p_school IS NULL OR COALESCE(p.school, 'Unspecified') = p_school) AND (p_grade IS NULL OR p.grade = p_grade)
  GROUP BY s.name, t.id, t.name ORDER BY avg_mastery ASC NULLS LAST;
END;
$$;
GRANT EXECUTE ON FUNCTION get_school_topic_analytics(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION get_common_misconceptions(p_school text DEFAULT NULL, p_grade int DEFAULT NULL, p_topic_id uuid DEFAULT NULL)
RETURNS TABLE (topic_name text, detected_mistake text, occurrence_count bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE teacher_school text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    SELECT school INTO teacher_school FROM profiles WHERE id = auth.uid() AND role = 'teacher' AND teacher_approved;
    IF teacher_school IS NULL OR p_school IS DISTINCT FROM teacher_school THEN RAISE EXCEPTION 'Admin or approved teacher access required'; END IF;
  END IF;
  RETURN QUERY SELECT COALESCE(t.name, 'General'), si.detected_mistake, count(*)
  FROM student_interactions si JOIN profiles p ON p.id = si.student_id LEFT JOIN topics t ON t.id = si.topic_id
  WHERE si.detected_mistake IS NOT NULL AND (p_school IS NULL OR COALESCE(p.school, 'Unspecified') = p_school)
    AND (p_grade IS NULL OR p.grade = p_grade) AND (p_topic_id IS NULL OR si.topic_id = p_topic_id)
  GROUP BY COALESCE(t.name, 'General'), si.detected_mistake ORDER BY count(*) DESC LIMIT 25;
END;
$$;
GRANT EXECUTE ON FUNCTION get_common_misconceptions(text, int, uuid) TO authenticated;
