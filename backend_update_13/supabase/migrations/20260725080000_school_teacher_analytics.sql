/*
# SmartClass Zambia — School/Teacher Analytics

## Purpose
The realistic version of "teacher/administrator analytics" and a "parent
dashboard" (design doc sections 11-12) without building a whole separate
parent/teacher account system: three admin-gated functions surfacing
aggregated mastery and common misconceptions, filterable by school and
Form — exactly the shape described ("Grade 8 Mathematics — Most difficult
topics: Algebra 61%... Most common misconception: solving equations with
negative numbers"). A real parent or teacher portal (separate accounts,
a school linking a set of pupils to a staff login) is a bigger feature
than this migration attempts; this is the aggregate-visibility layer
ZedCode's own admin team gets today, which a future parent/teacher login
system could reuse rather than duplicate.

## Why functions, not views
A plain SQL view would either bypass RLS entirely (Postgres views run
with the owner's privileges by default) or require `security_invoker`
plus relying on each caller's own row-level access — but a pupil's RLS
only lets them see their own rows, which is the opposite of what an
aggregate analytics view needs. Three SECURITY DEFINER functions, each
checking the caller is an admin before doing anything, is the same
pattern already used for recompute_topic_mastery: elevated internally,
gated at the entry point, not relying on RLS to do double duty.

## 1. get_distinct_schools()
Powers the admin UI's school filter dropdown — every distinct school
name pupils have entered, with a pupil count each.

## 2. get_school_topic_analytics(school, grade)
Average/min/max mastery per topic, filtered by school and/or Form (both
optional — omit either to see everything). Sorted worst-mastery-first,
matching the design's "most difficult topics" framing — the topics
needing attention are what a teacher actually wants to see first, not
buried at the bottom of a table sorted alphabetically.

## 3. get_common_misconceptions(school, grade, topic)
Groups student_interactions.detected_mistake (the free-text misconception
descriptions from ai-teacher-chat's and detect-answer-mistake's LLM
classification) by exact text, counting occurrences. Real limitation,
stated plainly rather than hidden: these are LLM-generated descriptions
in natural language, not a fixed taxonomy — "added instead of subtracting
the constant" and "adds instead of subtracting" describe the same
misconception but won't group together here, since this does exact-text
grouping, not semantic clustering. Good enough to spot a genuinely
recurring, consistently-worded issue; not a substitute for a human
skimming the list for patterns a raw count would miss. A future version
could cluster by embedding similarity (the same pgvector infrastructure
already in this project) rather than exact text match — not attempted in
this pass to keep the change reviewable.

## Security
All three: SECURITY DEFINER, admin-role check as the first statement,
RAISE EXCEPTION for anyone else — matches the existing pattern rather
than introducing a new access-control style.

Idempotent (CREATE OR REPLACE), no destructive operations.
*/

CREATE OR REPLACE FUNCTION get_distinct_schools()
RETURNS TABLE (school text, pupil_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT COALESCE(p.school, 'Unspecified') AS school, count(*) AS pupil_count
  FROM profiles p
  WHERE p.role = 'pupil'
  GROUP BY COALESCE(p.school, 'Unspecified')
  ORDER BY pupil_count DESC;
END;
$$;

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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
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

GRANT EXECUTE ON FUNCTION get_distinct_schools TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_topic_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_common_misconceptions TO authenticated;
