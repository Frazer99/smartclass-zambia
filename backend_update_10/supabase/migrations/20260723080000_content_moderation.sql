/*
# SmartClass Zambia — Content Moderation

## Purpose
ai-teacher-chat has never screened pupil messages before processing them —
every message went straight to RAG retrieval and the teaching LLM. For a
platform built for minors, that's a real gap independent of anything else
in this codebase. This migration adds storage for flagged messages;
ai-teacher-chat itself is updated in the same pass to actually call
OpenAI's Moderation API (a free, purpose-built endpoint — not a custom
keyword list, which would be both less effective and the kind of thing
better left to a model trained specifically for this) before generating
any teaching response.

## 1. moderation_flags
One row per message that OpenAI's moderation endpoint flags.
- id, user_id, session_id, message, categories (jsonb — the raw category
  flags OpenAI returned, e.g. {"harassment": true, "self-harm": false, ...}),
  severity ('self_harm' | 'other' — self-harm signals get their own
  category here because they need a different response, not just a
  different log entry; see below), reviewed (boolean, default false),
  reviewed_by (nullable FK to profiles, which admin reviewed it),
  reviewed_at, created_at

## 2. Security (RLS)
Read: admin only — same pattern as ai_interaction_logs and the AI eval
tables. Deliberately NOT readable by the pupil who triggered it, even
their own rows — this is a safeguarding/moderation record, not a
personal-data self-service view, and showing a pupil "here is what we
flagged from you" serves no constructive purpose. Write: only via the
Edge Function's service role key, which bypasses RLS — no INSERT policy
needed for the app to function, matching every other logging table in
this project.

## 3. A note on data sensitivity
This table can contain genuinely sensitive content — a pupil's message
during a moment of distress. It's real data that real people (school
staff, ZedCode's own team) may need to act on for a pupil's safety, which
is why it's captured at all rather than only anonymized/aggregated. But
that also means it deserves an actual data retention policy (how long
flagged messages are kept, who beyond "admin" should be able to see
self_harm severity specifically) — a real operational decision for
whoever runs this in production, not something a migration can decide.
Not implemented here; flagged in the README as something to define before
launch, not glossed over.

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid,
  message text NOT NULL,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'other',
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_moderation_flags" ON moderation_flags;
CREATE POLICY "admin_select_moderation_flags" ON moderation_flags FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_moderation_flags" ON moderation_flags;
CREATE POLICY "admin_update_moderation_flags" ON moderation_flags FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_moderation_flags_created ON moderation_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_unreviewed ON moderation_flags(reviewed) WHERE reviewed = false;
CREATE INDEX IF NOT EXISTS idx_moderation_flags_severity ON moderation_flags(severity) WHERE severity = 'self_harm';
