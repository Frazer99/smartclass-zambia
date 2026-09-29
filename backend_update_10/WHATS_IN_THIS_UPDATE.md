# Content moderation — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Important note on this one
Most of this feature (the migration, the moderation logic in
ai-teacher-chat, the moderation-tab.tsx component) was already sitting in
my working environment when I picked this task up — genuinely well-built,
including a factually-verified crisis helpline number and an honest note
about an unresolved data-retention policy. I don't have full certainty
whether all of it was actually delivered to you in an earlier update or
only ever existed in my own sandbox, so — to avoid any gap — this package
includes the complete feature, not just what I changed this session. If
you already have identical copies of some of these files, re-copying them
is harmless.

## What I actually found and fixed this session
The admin Moderation tab was built but never wired in: the component
existed, the nav tab was clickable, but nothing rendered when you clicked
it and no data was ever fetched — a real gap, not a hypothetical one.
Fixed in app/admin/(protected)/page.tsx: added moderationFlags state, a
fetchModeration() function (self-harm severity sorted first, unreviewed
before reviewed), a handleMarkReviewed() handler, and the actual render
call site. Verified by clicking through with Playwright, not just reading
the code — screenshotted the tab showing a self-harm flag with its
distinct red border and warning banner, and a routine flag rendering
normally below it.

## Files in this package
supabase/migrations/20260723080000_content_moderation.sql
    moderation_flags table — admin-only read/update RLS.

supabase/functions/ai-teacher-chat/index.ts
    Every pupil message is now screened by OpenAI's Moderation API before
    reaching RAG or the teaching model. Self-harm signals get a response
    pointing to a trusted adult and Lifeline/Childline Zambia's 116 Child
    Helpline (I verified this number against multiple independent sources
    before trusting it — a wrong crisis number would be actively harmful).
    Everything else flagged gets a calm redirect. Redeploy:
    supabase functions deploy ai-teacher-chat

app/admin/(protected)/tabs/moderation-tab.tsx
    The review UI — self-harm flags visually distinct and sorted first.

app/admin/(protected)/page.tsx
    THE FIX: wires the above into the actual admin page (state, fetch,
    render). Without this file, the tab exists but shows nothing.

README.md
    New "Content Moderation" section, including the honest note about an
    unresolved data-retention policy for flagged messages — a real
    operational decision for whoever runs this in production, not
    something this codebase decides for you.

## After copying these in
1. Run the migration in the Supabase SQL editor (skip if you already ran
   it from an earlier delivery — it's idempotent either way)
2. supabase functions deploy ai-teacher-chat
3. No new secret — reuses OPENAI_API_KEY, already required for chat to
   do anything beyond its fallback
4. Before real pupils use this: decide on the data retention question
   flagged in the README. This codebase intentionally doesn't decide it
   for you.
