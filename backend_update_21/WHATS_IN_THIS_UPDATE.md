# Local language support + proactive engagement — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Read this before assuming local languages "just work"
The account page's language selector is labeled "(beta)" on purpose.
I verified the ISO 639-3 codes carefully (bem/nya/toi/loz — see the
migration's header comment for why toi specifically, not the more
obvious-looking ton or tog), but I have NO way to verify from this build
environment whether GPT-4o-mini actually produces fluent, natural Bemba,
Nyanja, Tonga, or Lozi. That's a real, permanent limitation of what can
be checked here, not something I'm confident is fine. Try it and see —
if quality isn't there yet for a given language, switching back to
English is one click on /account.

## New file (1)
supabase/migrations/20260731080000_local_language_support.sql
    profiles.preferred_language (default 'en', CHECK-constrained to the
    5 supported values). Every existing pupil keeps working in English
    with no behavior change from running this migration.

## Modified files (6)
supabase/functions/ai-teacher-chat/index.ts
    Reads preferred_language, instructs the model to respond primarily
    in that language while mixing in English for technical terms
    (normal Zambian classroom code-switching) and to prefer English over
    guessing at an unclear translation.

supabase/functions/generate-greeting/index.ts
    Two changes: (1) also respects preferred_language for greetings and
    check-ins. (2) NEW: a `mode: "checkin"` option alongside the existing
    opening-greeting mode — same persona resolution and fallback
    structure, different prompt. This is what powers proactive
    engagement (see below).

lib/supabase-client.ts
    Profile type gains preferred_language.

app/(app)/account/page.tsx
    New "Teaching Language (beta)" selector — English/Bemba/Nyanja/
    Tonga/Lozi — with the quality-may-vary note directly underneath it.
    Verified rendering correctly via screenshot (Nyanja pre-selected
    from mock data, caveat text visible).

app/(app)/lesson/[id]/page.tsx
    Proactive engagement: 60 seconds of no pupil activity (after they've
    sent at least one message — not from page load) triggers an
    AI-generated check-in via generate-greeting's new checkin mode.
    IMPORTANT bug fix included here: the first version would have
    checked in every 60 seconds indefinitely if a pupil went silent and
    never returned, since it reset the "already checked in" flag on ANY
    new message, including the check-in's own message. Fixed so only
    genuine pupil activity (typing or sending) re-enables a future
    check-in.

README.md
    New "Local Language Support" and "Proactive Engagement" sections,
    including the honest uncertainty note about language quality and a
    description of the check-in repeat-fire bug and its fix.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. supabase functions deploy ai-teacher-chat generate-greeting
3. No new secrets needed — both reuse OPENAI_API_KEY, already required
   for either function to do anything beyond its fallback
