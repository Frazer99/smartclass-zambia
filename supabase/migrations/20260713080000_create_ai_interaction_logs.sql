/*
# SmartClass Zambia — AI Interaction Logging

## Purpose
Implements the data-capture half of SRS 12.17 (Continuous Learning
Pipeline: Learner Interaction -> Analyze Performance -> Identify
Improvements -> Update AI Knowledge -> Better Teaching). This migration
adds the "Learner Interaction" capture point; the "Analyze Performance" /
"Identify Improvements" steps are surfaced in the admin Analytics tab.
Automatic model retraining ("Update AI Knowledge") is out of scope for an
API-based MVP (see SRS 12.7) — the realistic version of that step, for
now, is a human (ZedCode content team) reading these aggregates and
updating `content_materials` or lesson content accordingly.

## 1. New Table

### ai_interaction_logs
One row per AI teacher chat turn (SRS Section 5.2 / Chapter 12).
- id (uuid, PK)
- session_id (uuid, nullable) — the lesson_sessions.id this turn belongs to, if any
- user_id (uuid, nullable, FK -> auth.users) — nullable so a user deletion
  doesn't cascade-delete analytics history
- topic_id (uuid, nullable, FK -> topics)
- grade (int, nullable)
- message (text) — the pupil's message
- response (text) — Mr. Chomba's response
- source (text) — 'openai' | 'fallback' | 'error'
- used_curriculum_context (boolean) — whether RAG found matching
  content_materials/search_index/past-paper material for this turn
- detected_confusion (boolean) — whether the pupil's message matched
  confusion-signal language (see the edge function)
- created_at (timestamptz)

## 2. Security (RLS)
Only the ai-teacher-chat Edge Function writes to this table, using the
Supabase service role key, which bypasses RLS entirely — so no INSERT
policy is required for the app to function. RLS below only governs read
access (admin-only, for the Analytics tab) as defense in depth in case a
client ever queries this table directly.

## 3. Notes
All statements are idempotent. No destructive operations.
*/

CREATE TABLE IF NOT EXISTS ai_interaction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  grade int,
  message text NOT NULL,
  response text NOT NULL,
  source text NOT NULL DEFAULT 'openai',
  used_curriculum_context boolean NOT NULL DEFAULT false,
  detected_confusion boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_interaction_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_ai_logs" ON ai_interaction_logs;
CREATE POLICY "admin_select_ai_logs" ON ai_interaction_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_logs_topic ON ai_interaction_logs(topic_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_interaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_confusion ON ai_interaction_logs(detected_confusion) WHERE detected_confusion = true;
