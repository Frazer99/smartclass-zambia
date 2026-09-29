# Real AI-generated greeting (not a template) — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Why this update exists
The previous update made the "welcome back" memory template-based on
purpose — to avoid an API call before the pupil had said anything. That
was a real tradeoff, and direct feedback was that it traded away the
wrong thing: the rest of the teaching conversation (ai-teacher-chat) was
always a genuine live LLM call, so the one templated, scripted-feeling
moment was exactly the pupil's first impression of the "teacher." This
update replaces that template with a real AI-generated greeting instead.

## New file (1)
supabase/functions/generate-greeting/index.ts
    Resolves the same named persona as ai-teacher-chat, looks up the
    pupil's most recent genuinely-past struggle (a different calendar
    day, not the same sitting), and asks the model for a short, natural
    greeting in the teacher's own words — not a fixed sentence shape.
    Deliberately NOT counted against the daily free-message quota and
    NOT run through content moderation, since this isn't a pupil message
    being screened. Falls back to a plain template (the previous
    implementation, kept as the safety net) if OPENAI_API_KEY isn't set
    or the OpenAI call fails.
    Deploy: supabase functions deploy generate-greeting

## Modified files (2)
app/(app)/lesson/[id]/page.tsx
    The opening greeting now calls generate-greeting instead of
    constructing a template client-side. Falls back to a simple default
    greeting if the call fails for any reason (network error, etc.) —
    a pupil should never see a missing greeting.

README.md
    Updated the "Welcome back" section to describe the new AI-generated
    approach. ALSO fixed two deployment checklists that had drifted
    significantly behind — one was still listing only 8 of what's now
    12 Edge Functions, missing create-payment, verify-payment, and
    delete-user-account entirely. Both now list all 12.

## After copying these in
1. supabase functions deploy generate-greeting
2. No new secrets needed — reuses OPENAI_API_KEY, already required for
   ai-teacher-chat to do anything beyond its fallback
3. No migration needed for this specific update
