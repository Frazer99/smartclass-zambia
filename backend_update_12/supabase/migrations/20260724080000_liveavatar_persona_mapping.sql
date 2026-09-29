/*
# SmartClass Zambia — LiveAvatar (HeyGen) Integration: Persona Mapping

## Purpose
Adds the columns needed to connect each named teacher persona
(Linda, Mrs Tembo, Mr Chomba, Mr Banda, Chipo) to a real,
photorealistic streaming video avatar via LiveAvatar (HeyGen's real-time
avatar product — see supabase/functions/liveavatar-token/index.ts and
components/teacher/LiveTeacherAvatar.tsx).

## Why nullable
Creating an actual LiveAvatar avatar is a manual, human step outside this
codebase entirely — signing up at app.liveavatar.com, and either picking
a stock avatar or training a custom one from real (consented) footage per
persona. That cannot be scripted or automated by a migration. Both columns
are nullable so the system keeps working exactly as it does today for any
persona that doesn't have one configured yet: the frontend falls back to
the existing illustrated SVG avatar (TeacherAvatar.tsx), the same
graceful-degradation pattern already used throughout this project for
every other optional integration (no OPENAI_API_KEY -> rule-based
fallback; no RESEND_API_KEY -> email silently doesn't send; here, no
liveavatar_avatar_id -> illustrated avatar instead of live video).

## Columns
- liveavatar_avatar_id (text, nullable): the avatar_id from LiveAvatar's
  dashboard/API for this persona.
- liveavatar_voice_id (text, nullable): optional — assigns a specific
  voice to this persona's avatar session, so e.g. Linda and Chipo
  (both female) can still sound distinct from each other rather than
  sharing a default voice. Safe to leave null; LiveAvatar/the avatar's
  own trained voice is used when unset.

Idempotent, no destructive operations.
*/

ALTER TABLE teacher_personas ADD COLUMN IF NOT EXISTS liveavatar_avatar_id text;
ALTER TABLE teacher_personas ADD COLUMN IF NOT EXISTS liveavatar_voice_id text;
