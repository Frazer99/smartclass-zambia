/*
# SmartClass Zambia — Form 1-6 Restructure

## 1. Curriculum restructure (Grade 8-12 -> Form 1-6)
Per the updated curriculum offering:
- Form 1-3: Science and Mathematics
- Form 4-6: Mathematics, Physics, and Chemistry

The numeric "grade" column (kept as-is internally to avoid a much larger
rename across every table/query in the app) is remapped so it now stores
Form numbers 1-6 instead of Grade numbers 8-12. Existing seeded content
is preserved by shifting every existing value down by 7 (old Grade 8-12
data becomes Form 1-5; Form 6 is new and starts empty, matching where the
old system had no equivalent level).

Affected: profiles, topics, content_materials, search_index, past_papers.
CHECK constraints are dropped and recreated with the new 1-6 range,
relying on Postgres's default constraint-naming convention
(`<table>_<column>_check`) since none of the original constraints were
explicitly named.

## 2. profiles.school
Adds a nullable school name field, collected at registration alongside
Form, per the updated registration flow.

## 3. Subject offering per the new curriculum
- Mathematics: Form 1-6 (offered throughout)
- Science: Form 1-3 only
- Physics / Chemistry: Form 4-6 only

## 4. Terminology
Past papers keep "ECZ" as their source — they are literally ECZ
(Examinations Council of Zambia) documents, uploaded manually when a
direct ECZ system integration isn't available (see the admin Materials
tab). "Zambian Curriculum" is used elsewhere in the product (syllabus
alignment, general curriculum framing) where a specific examining body
isn't being cited, but past papers are the one place ECZ is the accurate,
correct term rather than a genericization.

All statements are idempotent / safe to re-run.
*/

-- ============================================================
-- 1. Widen constraints first (so the data shift below is valid
--    at every intermediate step), then shift existing data down by 7,
--    then tighten constraints to the final 1-6 range.
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_grade_check;
ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_grade_check;
ALTER TABLE content_materials DROP CONSTRAINT IF EXISTS content_materials_grade_check;
ALTER TABLE search_index DROP CONSTRAINT IF EXISTS search_index_grade_check;
ALTER TABLE past_papers DROP CONSTRAINT IF EXISTS past_papers_grade_check;

UPDATE profiles SET grade = grade - 7 WHERE grade BETWEEN 8 AND 12;
UPDATE topics SET grade = grade - 7 WHERE grade BETWEEN 8 AND 12;
UPDATE content_materials SET grade = grade - 7 WHERE grade BETWEEN 8 AND 12;
UPDATE search_index SET grade = grade - 7 WHERE grade BETWEEN 8 AND 12;
UPDATE past_papers SET grade = grade - 7 WHERE grade BETWEEN 8 AND 12;

ALTER TABLE profiles ALTER COLUMN grade SET DEFAULT 1;
ALTER TABLE profiles ADD CONSTRAINT profiles_grade_check CHECK (grade BETWEEN 1 AND 6);
ALTER TABLE topics ADD CONSTRAINT topics_grade_check CHECK (grade BETWEEN 1 AND 6);
ALTER TABLE content_materials ADD CONSTRAINT content_materials_grade_check CHECK (grade IS NULL OR (grade BETWEEN 1 AND 6));
ALTER TABLE search_index ADD CONSTRAINT search_index_grade_check CHECK (grade BETWEEN 1 AND 6);
ALTER TABLE past_papers ADD CONSTRAINT past_papers_grade_check CHECK (grade BETWEEN 1 AND 6);

-- ============================================================
-- 2. profiles.school
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school text;

-- ============================================================
-- 3. Subject offering: Science Form 1-3 only; Physics/Chemistry
--    Form 4-6 only; Mathematics across all six forms.
-- ============================================================

UPDATE subjects SET grades = '{1,2,3,4,5,6}' WHERE code = 'MATH';
UPDATE subjects SET grades = '{1,2,3}' WHERE code = 'SCI';
UPDATE subjects SET grades = '{4,5,6}' WHERE code = 'PHY';
UPDATE subjects SET grades = '{4,5,6}' WHERE code = 'CHEM';

-- ============================================================
-- 4. Terminology: past papers keep "ECZ" as their source — see
--    the note above. No changes needed here; past_papers.source
--    already defaults to 'ECZ' from its original migration.
-- ============================================================

-- ============================================================
-- 5. handle_new_user(): now also captures school from signup
--    metadata, and defaults grade to Form 1 instead of the old
--    Grade 8 default.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, grade, school)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'grade')::int, 1),
    NEW.raw_user_meta_data->>'school'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
