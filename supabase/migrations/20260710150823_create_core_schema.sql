/*
# SmartClass Zambia — Core Database Schema

Creates the full MVP schema for the SmartClass Zambia AI tutoring platform.
This migration sets up tables for users (pupils), the ECZ Mathematics curriculum
(Grades 8–12), lessons, lesson sessions, practice questions, practice attempts,
and progress tracking.

## 1. New Tables

### profiles
Extends `auth.users` with pupil-specific data.
- `id` (uuid, PK, references auth.users) — one-to-one with the auth user
- `full_name` (text) — pupil's display name
- `grade` (int 8–12) — current grade level
- `created_at` (timestamptz)

### topics
Curriculum topics seeded from the ECZ Mathematics syllabus.
- `id` (uuid, PK)
- `grade` (int 8–12)
- `name` (text) — e.g. "Algebraic Expressions"
- `category` (text) — e.g. "Algebra", "Geometry"
- `syllabus_reference` (text)
- `display_order` (int) — ordering within a grade
- `description` (text)

### lessons
Individual lessons within a topic.
- `id` (uuid, PK)
- `topic_id` (uuid, FK → topics)
- `title` (text)
- `content` (jsonb) — structured lesson content (intro, steps, examples, summary)
- `difficulty` (text) — 'introductory' | 'standard' | 'advanced'
- `display_order` (int)

### lesson_sessions
One record per pupil lesson attempt (start/resume tracking).
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `lesson_id` (uuid, FK → lessons)
- `status` (text) — 'in_progress' | 'completed'
- `started_at` (timestamptz)
- `completed_at` (timestamptz, nullable)
- `transcript` (jsonb) — chat/voice interaction history

### practice_questions
Practice questions for a topic.
- `id` (uuid, PK)
- `topic_id` (uuid, FK → topics)
- `question_text` (text)
- `question_type` (text) — 'multiple_choice' | 'numeric' | 'short_answer'
- `options` (jsonb, nullable) — for multiple choice
- `answer_key` (text)
- `explanation` (text) — shown after answering
- `difficulty` (text)

### practice_attempts
Records each pupil answer for mastery calculation.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `question_id` (uuid, FK → practice_questions)
- `submitted_answer` (text)
- `is_correct` (boolean)
- `created_at` (timestamptz)

### progress_records
Aggregated mastery per pupil per topic.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, DEFAULT auth.uid())
- `topic_id` (uuid, FK → topics)
- `mastery_percentage` (numeric, 0–100)
- `lessons_completed` (int)
- `total_attempts` (int)
- `correct_attempts` (int)
- `last_updated` (timestamptz)

## 2. Security (RLS)

All tables have RLS enabled.
- `profiles`: owner-scoped CRUD (pupil manages their own profile).
- `topics`, `lessons`, `practice_questions`: public read (curriculum content is shared)
  for both anon and authenticated; no writes from the client.
- `lesson_sessions`, `practice_attempts`, `progress_records`: owner-scoped CRUD —
  each pupil can only see/modify their own records.

## 3. Notes
- `user_id` columns default to `auth.uid()` so client inserts that omit the
  user_id still satisfy RLS WITH CHECK.
- Curriculum tables use `TO anon, authenticated` for SELECT so the app can
  read them regardless of auth state.
- No destructive operations; all statements are idempotent.
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  grade int NOT NULL DEFAULT 8 CHECK (grade BETWEEN 8 AND 12),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Topics table (curriculum)
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade int NOT NULL CHECK (grade BETWEEN 8 AND 12),
  name text NOT NULL,
  category text NOT NULL,
  syllabus_reference text,
  display_order int NOT NULL DEFAULT 0,
  description text
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_topics" ON topics;
CREATE POLICY "read_topics" ON topics FOR SELECT
  TO anon, authenticated USING (true);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  difficulty text NOT NULL DEFAULT 'standard',
  display_order int NOT NULL DEFAULT 0
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_lessons" ON lessons;
CREATE POLICY "read_lessons" ON lessons FOR SELECT
  TO anon, authenticated USING (true);

-- Lesson sessions table
CREATE TABLE IF NOT EXISTS lesson_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON lesson_sessions;
CREATE POLICY "select_own_sessions" ON lesson_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON lesson_sessions;
CREATE POLICY "insert_own_sessions" ON lesson_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON lesson_sessions;
CREATE POLICY "update_own_sessions" ON lesson_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON lesson_sessions;
CREATE POLICY "delete_own_sessions" ON lesson_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Practice questions table
CREATE TABLE IF NOT EXISTS practice_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  options jsonb,
  answer_key text NOT NULL,
  explanation text,
  difficulty text NOT NULL DEFAULT 'standard'
);

ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_practice_questions" ON practice_questions;
CREATE POLICY "read_practice_questions" ON practice_questions FOR SELECT
  TO anon, authenticated USING (true);

-- Practice attempts table
CREATE TABLE IF NOT EXISTS practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
  submitted_answer text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_attempts" ON practice_attempts;
CREATE POLICY "select_own_attempts" ON practice_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_attempts" ON practice_attempts;
CREATE POLICY "insert_own_attempts" ON practice_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_attempts" ON practice_attempts;
CREATE POLICY "delete_own_attempts" ON practice_attempts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Progress records table
CREATE TABLE IF NOT EXISTS progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  mastery_percentage numeric(5,2) NOT NULL DEFAULT 0,
  lessons_completed int NOT NULL DEFAULT 0,
  total_attempts int NOT NULL DEFAULT 0,
  correct_attempts int NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_progress" ON progress_records;
CREATE POLICY "select_own_progress" ON progress_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_progress" ON progress_records;
CREATE POLICY "insert_own_progress" ON progress_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_progress" ON progress_records;
CREATE POLICY "update_own_progress" ON progress_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_topics_grade ON topics(grade);
CREATE INDEX IF NOT EXISTS idx_lessons_topic ON lessons(topic_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON lesson_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON practice_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON practice_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress_records(user_id);

-- Function to auto-create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, grade)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE((NEW.raw_user_meta_data->>'grade')::int, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
