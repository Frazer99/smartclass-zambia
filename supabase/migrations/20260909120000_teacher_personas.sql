/* Named teacher personas and admin LiveAvatar configuration. */

CREATE TABLE IF NOT EXISTS public.teacher_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  gender text NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  grade_min int NOT NULL CHECK (grade_min BETWEEN 1 AND 6),
  grade_max int NOT NULL CHECK (grade_max BETWEEN 1 AND 6),
  persona_description text NOT NULL,
  avatar_style text NOT NULL DEFAULT 'generic',
  liveavatar_avatar_id text,
  liveavatar_voice_id text,
  CHECK (grade_min <= grade_max)
);

ALTER TABLE public.teacher_personas
  ADD COLUMN IF NOT EXISTS liveavatar_avatar_id text,
  ADD COLUMN IF NOT EXISTS liveavatar_voice_id text;

ALTER TABLE public.teacher_personas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_teacher_personas" ON public.teacher_personas;
CREATE POLICY "read_teacher_personas" ON public.teacher_personas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_teacher_personas" ON public.teacher_personas;
CREATE POLICY "admin_update_teacher_personas" ON public.teacher_personas FOR UPDATE TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

CREATE INDEX IF NOT EXISTS idx_teacher_personas_subject_grade ON public.teacher_personas(subject_id, grade_min, grade_max);

DO $$
DECLARE
  math_id uuid; sci_id uuid; phy_id uuid; chem_id uuid;
BEGIN
  SELECT id INTO math_id FROM public.subjects WHERE code = 'MATH';
  SELECT id INTO sci_id FROM public.subjects WHERE code = 'SCI';
  SELECT id INTO phy_id FROM public.subjects WHERE code = 'PHY';
  SELECT id INTO chem_id FROM public.subjects WHERE code = 'CHEM';
  IF math_id IS NOT NULL THEN
    INSERT INTO public.teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    SELECT * FROM (VALUES
      ('Linda', 'female', math_id, 1, 3, 'Warm, patient Zambian Mathematics teacher for junior secondary.', 'generic'),
      ('Mr Chomba', 'male', math_id, 4, 6, 'Patient, methodical Zambian Mathematics teacher for senior secondary and ECZ preparation.', 'chomba')
    ) AS persona(name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_personas WHERE teacher_personas.name = persona.name);
  END IF;
  IF sci_id IS NOT NULL THEN
    INSERT INTO public.teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    SELECT 'Mrs Tembo', 'female', sci_id, 1, 3, 'Enthusiastic, encouraging Zambian Science teacher for junior secondary.', 'generic'
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_personas WHERE name = 'Mrs Tembo');
  END IF;
  IF phy_id IS NOT NULL THEN
    INSERT INTO public.teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    SELECT 'Mr Banda', 'male', phy_id, 4, 6, 'Practical, precise Zambian Physics teacher for senior secondary.', 'generic'
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_personas WHERE name = 'Mr Banda');
  END IF;
  IF chem_id IS NOT NULL THEN
    INSERT INTO public.teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    SELECT 'Chipo', 'female', chem_id, 4, 6, 'Warm, precise Zambian Chemistry teacher for senior secondary.', 'generic'
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_personas WHERE name = 'Chipo');
  END IF;
END $$;
