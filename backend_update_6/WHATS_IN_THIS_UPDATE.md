# Named teacher personas + Student Learning Profile — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## New files (2)
supabase/migrations/20260721080000_teacher_personas.sql
    teacher_personas table, seeded with all five: Linda (Math,
    Form 1-3), Mrs Tembo (Science, Form 1-3), Mr Chomba (Math, Form 4-6),
    Mr Banda (Physics, Form 4-6), Chipo (Chemistry, Form 4-6).

supabase/migrations/20260721090000_student_learning_profile.sql
    student_interactions + student_topic_mastery — the richer adaptive
    learning tables. ADDITIVE: progress_records and ai_interaction_logs
    are untouched and keep working exactly as before for everything that
    already reads them.

## Modified files (6)
supabase/functions/ai-teacher-chat/index.ts
    - Resolves the correct named persona by subject+grade, stays in
      character in the system prompt (falls back to "Mr. Chomba"
      generically if no persona matches, so nothing breaks).
    - New: detectMistake() — a lightweight second OpenAI call identifying
      the specific misconception in a pupil's message, only attempted for
      substantive messages (skips greetings) to control cost.
    - Writes richer records to student_interactions and best-effort
      upserts student_topic_mastery (only from chat data right now — see
      README's "Known limitation" note).
    Redeploy: supabase functions deploy ai-teacher-chat

components/teacher/TeacherAvatar.tsx
    New `name` prop. Personas other than Mr. Chomba (who's the only one
    with real illustrated art) render a plain initials placeholder
    instead of incorrectly reusing his male illustration under a
    different — often female — teacher's name.

app/(app)/lesson/[id]/page.tsx
app/(app)/past-papers/[id]/run/page.tsx
    Both resolve the correct persona name up front (querying
    teacher_personas directly on page load) rather than waiting for the
    first AI response, so the header never briefly shows the wrong name.
    Screenshotted and confirmed: a Physics/Form 4 lesson correctly shows
    "Mr Banda" with the honest initials placeholder.

lib/supabase-client.ts
    Profile type unchanged from the last update; no schema-driven type
    changes needed here since teacher_personas/student_interactions/
    student_topic_mastery aren't queried through typed helpers yet.

README.md
    New "Named Teacher Personas" and "Student Learning Profile" sections.

## Two things worth knowing before you deploy

1. Illustrated avatars for Linda, Mrs Tembo, Mr Banda, and Chipo
   don't exist — they show initials placeholders. That's a real design
   task, not attempted in this pass.

2. "Chipo" (the Chemistry teacher, per your spec) shares a name with
   "Chipo Mwansa," the mock pupil used throughout the existing demo data
   and README examples. Not a technical conflict, just worth a rename
   discussion if it's confusing in practice — e.g. "ask Chipo" being
   ambiguous in conversation between the pupil and the teacher.

## After copying these in
1. Run both new migrations in the Supabase SQL editor, in order
2. supabase functions deploy ai-teacher-chat
3. No new secrets needed — this reuses OPENAI_API_KEY, already required
   for ai-teacher-chat to do anything beyond the rule-based fallback
