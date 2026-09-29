# Mistake detection for practice/past-paper wrong answers — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## New file (1)
supabase/functions/detect-answer-mistake/index.ts
    New Edge Function. Given a question, the correct answer, and the
    pupil's wrong answer, classifies the specific misconception (e.g.
    "added instead of subtracting the constant term"). More reliable than
    ai-teacher-chat's chat-based mistake detection since this one has the
    actual correct answer to compare against, not just inference from
    conversation. Requires a valid session; degrades to {mistake: null}
    on any failure or missing OPENAI_API_KEY rather than erroring.
    Deploy: supabase functions deploy detect-answer-mistake

## Modified files (3)
app/(app)/practice/[id]/page.tsx
app/(app)/past-papers/[id]/run/page.tsx
    Both now call detect-answer-mistake when (and only when) an answer is
    wrong, and pass the result into student_interactions.detected_mistake
    (previously always null for these two pages).

README.md
    Documented the new function. Also fixed a stale deployment checklist
    that had drifted across several past updates — it only listed 4 of
    what's now 7 Edge Functions. Now lists all 7 in both places it's
    mentioned.

## After copying these in
1. supabase functions deploy detect-answer-mistake
2. No new migration, no new secrets — reuses OPENAI_API_KEY (already
   required for ai-teacher-chat to do anything beyond its fallback) and
   the student_interactions table from the previous update
