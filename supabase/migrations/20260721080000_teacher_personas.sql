/*
# SmartClass Zambia — Named Teacher Personas

## Purpose
Until now, every subject and every grade was taught by a single persona
("Mr. Chomba"), hardcoded into the ai-teacher-chat system prompt and the
frontend's avatar label — accurate for Mathematics, wrong for every other
subject. Per the updated design: five named, subject/grade-specific
teachers, each with a consistent identity (name, gender, described
appearance/accent) the AI stays in character as, and the frontend displays
correctly:

  Form 1-3 Mathematics -> Linda
  Form 1-3 Science     -> Mrs Tembo
  Form 4-6 Mathematics -> Mr Chomba   (existing persona, kept)
  Form 4-6 Physics     -> Mr Banda
  Form 4-6 Chemistry   -> Chipo

All five are described as Zambian in appearance and speaking with a
Zambian accent — captured here as a `persona_description` field the AI
system prompt includes, since a text model can't literally have an accent
but can be instructed to write in a way consistent with one (the existing
system prompt already asks for Zambian-context examples and simple
English; this extends that same instruction per-teacher).

Illustrated avatars for the four new personas (TeacherAvatar.tsx currently
only renders "Mr. Chomba") are a separate, real design task — not attempted
in this migration. The frontend change in this pass is limited to
displaying the correct *name*, which is cheap and removes the immediate
inconsistency of "Mr. Chomba" appearing on a Physics or Grade 2 lesson;
matching illustrated character art for all five follows later.

## 1. teacher_personas
- id, name, gender, subject_id (FK), grade_min, grade_max (inclusive Form
  range this persona covers), persona_description (used in the AI system
  prompt), avatar_style (a hint for the frontend once per-persona art
  exists — 'chomba' for now is the only one with real art)

## 2. Security (RLS)
Public read (anon + authenticated) — this is reference/config data, same
shape as `subjects`, not personal information. No client writes; managed
via migrations/admin tooling only, same as subjects and topics.

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS teacher_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender text NOT NULL,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_min int NOT NULL CHECK (grade_min BETWEEN 1 AND 6),
  grade_max int NOT NULL CHECK (grade_max BETWEEN 1 AND 6),
  persona_description text NOT NULL,
  avatar_style text NOT NULL DEFAULT 'generic',
  CHECK (grade_min <= grade_max)
);

ALTER TABLE teacher_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_teacher_personas" ON teacher_personas;
CREATE POLICY "read_teacher_personas" ON teacher_personas FOR SELECT
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_teacher_personas_subject_grade
  ON teacher_personas(subject_id, grade_min, grade_max);

-- ============================================================
-- Seed the five personas described in the spec
-- ============================================================

DO $$
DECLARE
  math_id uuid;
  sci_id uuid;
  phy_id uuid;
  chem_id uuid;
BEGIN
  SELECT id INTO math_id FROM subjects WHERE code = 'MATH';
  SELECT id INTO sci_id FROM subjects WHERE code = 'SCI';
  SELECT id INTO phy_id FROM subjects WHERE code = 'PHY';
  SELECT id INTO chem_id FROM subjects WHERE code = 'CHEM';

  IF math_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teacher_personas WHERE name = 'Linda') THEN
    INSERT INTO teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    VALUES ('Linda', 'female', math_id, 1, 3,
      'Linda is a warm, patient Zambian Mathematics teacher for junior secondary (Form 1-3). She is Zambian in appearance and speaks with a Zambian accent — write her dialogue in plain, encouraging English consistent with that, favouring local examples (Zambian towns, kwacha, familiar everyday scenarios) the way a real junior-secondary teacher in Zambia would.',
      'generic');
  END IF;

  IF sci_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teacher_personas WHERE name = 'Mrs Tembo') THEN
    INSERT INTO teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    VALUES ('Mrs Tembo', 'female', sci_id, 1, 3,
      'Mrs Tembo is an enthusiastic, encouraging Zambian Science teacher for junior secondary (Form 1-3). She is Zambian in appearance and speaks with a Zambian accent — write her dialogue in plain, curious, hands-on English consistent with that, connecting science concepts to things Zambian pupils would recognise from daily life.',
      'generic');
  END IF;

  IF math_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teacher_personas WHERE name = 'Mr Chomba') THEN
    INSERT INTO teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    VALUES ('Mr Chomba', 'male', math_id, 4, 6,
      'Mr Chomba is a patient, methodical Zambian Mathematics teacher for senior secondary (Form 4-6), including ECZ exam preparation. He is Zambian in appearance and speaks with a Zambian accent — write his dialogue in clear, step-by-step English consistent with that, favouring local examples and building confidence for exam-level work.',
      'chomba');
  END IF;

  IF phy_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teacher_personas WHERE name = 'Mr Banda') THEN
    INSERT INTO teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    VALUES ('Mr Banda', 'male', phy_id, 4, 6,
      'Mr Banda is a practical, precise Zambian Physics teacher for senior secondary (Form 4-6). He is Zambian in appearance and speaks with a Zambian accent — write his dialogue in clear English consistent with that, grounding physics concepts in real, tangible examples where possible.',
      'generic');
  END IF;

  IF chem_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teacher_personas WHERE name = 'Chipo') THEN
    INSERT INTO teacher_personas (name, gender, subject_id, grade_min, grade_max, persona_description, avatar_style)
    VALUES ('Chipo', 'female', chem_id, 4, 6,
      'Chipo is a warm, precise Zambian Chemistry teacher for senior secondary (Form 4-6). She is Zambian in appearance and speaks with a Zambian accent — write her dialogue in clear English consistent with that, being careful and exact about chemical processes while staying approachable.',
      'generic');
  END IF;
END $$;
