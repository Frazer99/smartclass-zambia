/*
# SmartClass Zambia — AI Chat Rate Limiting Support

## Purpose
ai-teacher-chat now enforces per-user rate limits (see the Edge Function
itself for the actual limits and logic) by counting recent rows in
ai_interaction_logs for the requesting user. That query needs an index on
(user_id, created_at) to stay fast as the table grows — without it, every
chat message would trigger a full table scan just to decide whether to
allow the message through, which gets slower exactly as the table gets
bigger from real usage.

## Change
Adds idx_ai_logs_user_created. No existing behavior changes; this is
purely a performance index for a query pattern that didn't exist until
now (nothing previously queried ai_interaction_logs filtered by user_id).

Idempotent, no destructive operations.
*/

CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created
  ON ai_interaction_logs(user_id, created_at DESC);
