/*
# SmartClass Zambia — Parent & Teacher Accounts

## Purpose
Two new real roles, not just email recipients: a parent can log in and
see their own child's progress directly (the design doc's "parent
dashboard" section), and a teacher can see their own school's aggregated
analytics without needing admin access. Both reuse infrastructure
already built rather than duplicating it — parent access is built on
`profiles.parent_email` (already collected for the weekly digest) and
`student_topic_mastery`/`progress_records`; teacher access extends the
existing `get_school_topic_analytics()`/`get_common_misconceptions()`
functions rather than writing parallel versions.

`profiles.role` was never constrained to a fixed list of values (no
CHECK constraint in the original schema), so 'parent' and 'teacher' are
usable immediately — no ALTER needed for that part.

## 1. parent_child_links
Many-to-many, not a single parent_email lookup at query time — a parent
could have more than one child on the platform, and (less commonly, but
real in blended families) a pupil could have more than one linked
parent account. One row per confirmed link.

## 2. Auto-linking, both directions
A parent might sign up before or after their child adds the parent's
email in /account. `sync_parent_child_links()` handles both orders:
called whenever a pupil's parent_email changes (checks for an existing
parent account with that email) and whenever a new parent account is
created (checks for any pupil whose parent_email matches). Neither
direction requires the other to have happened first.

## 3. Teacher approval — deliberately not self-service
Anyone can register as a pupil directly; a teacher account requires
admin approval before it can see anything beyond "pending" — teacher
access exposes aggregated performance data across an entire school's
pupils, which is a real enough privilege that self-service registration
alone isn't an appropriate gate for it. `teacher_approved` defaults to
false; the admin Users tab is where an admin flips it (see the frontend
update shipped alongside this migration).

## 4. Functions
- get_my_children(): a parent's own linked children — id, name, grade,
  school. Used by the parent dashboard to list who they can view.
- get_child_progress(child_id): full progress detail for ONE child —
  gated by an actual parent_child_links row existing, not just "any
  parent can see any pupil."
- get_school_topic_analytics() / get_common_misconceptions(): EXTENDED
  (not duplicated) to also allow an approved teacher, scoped to their
  own school specifically — an admin can query any school; a teacher can
  only query their own, checked server-side, not just hidden in the UI.

Idempotent, no destructive operations.
*/

-- ============================================================
-- handle_new_user extended to accept role from signup metadata —
-- SAFELY, only ever 'pupil', 'parent', or 'teacher'. 'admin' can NEVER
-- be set this way; anything else falls back to 'pupil'. This has to
-- happen at INSERT time specifically: prevent_self_role_escalation (a
-- BEFORE UPDATE trigger from migration 20260719080000) would silently
-- revert any attempt to set role via an UPDATE from a non-admin session
-- — setting it correctly during the initial INSERT avoids that
-- entirely, since that trigger never fires on INSERT at all. Every
-- existing signup path (the pupil /register form) doesn't pass a role
-- in its metadata, so it's unaffected — still defaults to 'pupil'
-- exactly as before this migration.
-- ============================================================

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
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
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
CREATE POLICY "select_own_parent_links" ON parent_child_links FOR SELECT
  TO authenticated USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "admin_select_all_parent_links" ON parent_child_links;
CREATE POLICY "admin_select_all_parent_links" ON parent_child_links FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent ON parent_child_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_child ON parent_child_links(child_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS teacher_approved boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION sync_parent_child_links()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Every pupil with a parent_email that matches a real parent account's
  -- login email, that isn't already linked, gets linked. Re-running this
  -- is always safe — ON CONFLICT DO NOTHING means an existing link is
  -- never duplicated or disturbed.
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
RETURNS TRIGGER AS $$
BEGIN
  PERFORM sync_parent_child_links();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fires only when it could actually matter — a pupil's parent_email
-- being set/changed, or a new parent account appearing — not on every
-- unrelated profile edit (changing full_name, grade, etc. shouldn't
-- trigger a full re-scan of every pupil/parent pair).
DROP TRIGGER IF EXISTS trg_sync_parent_links ON profiles;
CREATE TRIGGER trg_sync_parent_links
  AFTER INSERT OR UPDATE OF parent_email, role ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'parent' OR NEW.parent_email IS NOT NULL)
  EXECUTE FUNCTION trigger_sync_parent_links();

CREATE OR REPLACE FUNCTION get_my_children()
RETURNS TABLE (child_id uuid, full_name text, grade int, school text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name, p.grade, p.school
  FROM parent_child_links l
  JOIN profiles p ON p.id = l.child_id
  WHERE l.parent_id = auth.uid()
  ORDER BY p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_children TO authenticated;

CREATE OR REPLACE FUNCTION get_child_progress(p_child_id uuid)
RETURNS TABLE (
  topic_id uuid, topic_name text, subject_name text,
  mastery_percentage numeric, lessons_completed int, total_attempts int, correct_attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s progress';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, s.name, pr.mastery_percentage, pr.lessons_completed, pr.total_attempts, pr.correct_attempts
  FROM progress_records pr
  JOIN topics t ON t.id = pr.topic_id
  JOIN subjects s ON s.id = t.subject_id
  WHERE pr.user_id = p_child_id
  ORDER BY pr.mastery_percentage ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_child_progress TO authenticated;

-- Extend (not duplicate) the existing school analytics functions to
-- also allow an approved teacher, scoped to their own school only.
CREATE OR REPLACE FUNCTION get_school_topic_analytics(
  p_school text DEFAULT NULL,
  p_grade int DEFAULT NULL
)
RETURNS TABLE (
  subject_name text,
  topic_id uuid,
  topic_name text,
  pupil_count bigint,
  avg_mastery numeric,
  min_mastery numeric,
  max_mastery numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_teacher_school text;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    SELECT school INTO v_teacher_school FROM profiles
    WHERE id = auth.uid() AND role = 'teacher' AND teacher_approved = true;

    IF v_teacher_school IS NULL THEN
      RAISE EXCEPTION 'Admin or approved teacher access required';
    END IF;
    IF p_school IS DISTINCT FROM v_teacher_school THEN
      RAISE EXCEPTION 'Teachers can only view their own school''s analytics';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    s.name AS subject_name,
    t.id AS topic_id,
    t.name AS topic_name,
    count(DISTINCT stm.student_id) AS pupil_count,
    ROUND(AVG(stm.mastery_score), 1) AS avg_mastery,
    MIN(stm.mastery_score) AS min_mastery,
    MAX(stm.mastery_score) AS max_mastery
  FROM student_topic_mastery stm
  JOIN profiles p ON p.id = stm.student_id
  JOIN topics t ON t.id = stm.topic_id
  JOIN subjects s ON s.id = t.subject_id
  WHERE (p_school IS NULL OR COALESCE(p.school, 'Unspecified') = p_school)
    AND (p_grade IS NULL OR p.grade = p_grade)
  GROUP BY s.name, t.id, t.name
  ORDER BY avg_mastery ASC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION get_common_misconceptions(
  p_school text DEFAULT NULL,
  p_grade int DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL
)
RETURNS TABLE (
  topic_name text,
  detected_mistake text,
  occurrence_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_teacher_school text;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin FROM profiles WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    SELECT school INTO v_teacher_school FROM profiles
    WHERE id = auth.uid() AND role = 'teacher' AND teacher_approved = true;

    IF v_teacher_school IS NULL THEN
      RAISE EXCEPTION 'Admin or approved teacher access required';
    END IF;
    IF p_school IS DISTINCT FROM v_teacher_school THEN
      RAISE EXCEPTION 'Teachers can only view their own school''s analytics';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(t.name, 'General') AS topic_name,
    si.detected_mistake,
    count(*) AS occurrence_count
  FROM student_interactions si
  JOIN profiles p ON p.id = si.student_id
  LEFT JOIN topics t ON t.id = si.topic_id
  WHERE si.detected_mistake IS NOT NULL
    AND (p_school IS NULL OR COALESCE(p.school, 'Unspecified') = p_school)
    AND (p_grade IS NULL OR p.grade = p_grade)
    AND (p_topic_id IS NULL OR si.topic_id = p_topic_id)
  GROUP BY COALESCE(t.name, 'General'), si.detected_mistake
  ORDER BY occurrence_count DESC
  LIMIT 25;
END;
$$;
