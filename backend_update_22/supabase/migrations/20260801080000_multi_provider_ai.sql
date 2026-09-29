/*
# SmartClass Zambia — Multi-Provider AI: OpenAI + Anthropic

## Purpose
ai-teacher-chat's teaching response generation now tries an
admin-configured preferred provider first (OpenAI or Anthropic/Claude)
and automatically falls back to the other one if it fails or isn't
configured — real resilience, not a cosmetic toggle. See
supabase/functions/_shared/llm.ts for the actual dual-provider logic.

Deliberately scoped to chat completions only. OpenAI's Moderation API
and embeddings (powering content moderation and RAG) stay OpenAI-only —
Anthropic doesn't offer a public equivalent for either, so there's no
real "switch providers" story for those two capabilities.

## platform_settings addition
primary_ai_provider ('openai' | 'anthropic'), default 'openai' — reuses
the same key-value settings table already used for is_platform_free,
subscription_price_zmw, and free_daily_message_limit, rather than a new
single-purpose table for one more admin-tunable value.

Idempotent, no destructive operations.
*/

INSERT INTO platform_settings (key, value) VALUES
  ('primary_ai_provider', '"openai"'::jsonb)
ON CONFLICT (key) DO NOTHING;
