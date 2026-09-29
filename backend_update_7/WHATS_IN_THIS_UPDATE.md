# Wire practice/past-paper into student_interactions — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## New file (1)
supabase/migrations/20260722080000_recompute_mastery_function.sql
    recompute_topic_mastery(student, topic) — extracted the mastery-math
    that used to live inline in ai-teacher-chat into a shared SQL
    function, so it's not duplicated three times now that practice and
    past-paper also need it. Same math as before, just one place instead
    of three.

## Modified files (3)
supabase/functions/ai-teacher-chat/index.ts
    Simplified: logStudentInteraction() now calls the shared RPC instead
    of recomputing mastery inline. Redeploy:
    supabase functions deploy ai-teacher-chat

app/(app)/practice/[id]/page.tsx
    After marking an answer, now also logs to student_interactions
    (interaction_type: 'practice_question') and calls
    recompute_topic_mastery via RPC.

app/(app)/past-papers/[id]/run/page.tsx
    Same, for interaction_type: 'past_paper_question' — but only for
    questions an admin has tagged with a topic_id (untagged questions
    still work normally, they just don't feed the mastery model — same
    opt-in behaviour lib/adaptiveLearning.ts already relies on elsewhere).

README.md
    Updated the "Known limitation" note from the last update — it's
    closed now — and documented the shared RPC function.

## What's still NOT done (documented in README, not hidden)
detected_mistake (the specific-misconception field) is still only
populated by ai-teacher-chat's LLM classification. Practice and
past-paper wrong answers log with detected_mistake: null, since doing the
same classification there would need a new Edge Function — the OpenAI key
can't be called directly from frontend code. Not built in this pass.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. supabase functions deploy ai-teacher-chat
3. No new secrets needed
