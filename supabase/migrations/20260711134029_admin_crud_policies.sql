/*
# SmartClass Zambia — Admin CRUD on lessons, practice_questions, progress_records

## 1. Security (RLS)
- lessons: admin INSERT/UPDATE/DELETE
- practice_questions: admin INSERT/UPDATE/DELETE
- progress_records: admin SELECT (for analytics + user detail)
- lesson_sessions: admin SELECT (for analytics + activity feed)

## 2. Notes
- Idempotent.
- No destructive operations.
*/

-- Lessons admin write
DROP POLICY IF EXISTS "admin_insert_lessons" ON lessons;
CREATE POLICY "admin_insert_lessons" ON lessons FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_lessons" ON lessons;
CREATE POLICY "admin_update_lessons" ON lessons FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_lessons" ON lessons;
CREATE POLICY "admin_delete_lessons" ON lessons FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Practice questions admin write
DROP POLICY IF EXISTS "admin_insert_practice_questions" ON practice_questions;
CREATE POLICY "admin_insert_practice_questions" ON practice_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_practice_questions" ON practice_questions;
CREATE POLICY "admin_update_practice_questions" ON practice_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_practice_questions" ON practice_questions;
CREATE POLICY "admin_delete_practice_questions" ON practice_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Progress records admin read
DROP POLICY IF EXISTS "admin_read_progress_records" ON progress_records;
CREATE POLICY "admin_read_progress_records" ON progress_records FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Lesson sessions admin read
DROP POLICY IF EXISTS "admin_read_lesson_sessions" ON lesson_sessions;
CREATE POLICY "admin_read_lesson_sessions" ON lesson_sessions FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Practice attempts admin read
DROP POLICY IF EXISTS "admin_read_practice_attempts" ON practice_attempts;
CREATE POLICY "admin_read_practice_attempts" ON practice_attempts FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
