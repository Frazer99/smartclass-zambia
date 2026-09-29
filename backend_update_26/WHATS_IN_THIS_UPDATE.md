# Observability, admin pagination, schools reference, exam countdown

Same pattern as every previous update: just the files touched across
this whole session, same relative paths, drop straight in and
overwrite. This bundles four separate pieces of work delivered together
since the last package — read the README's two new sections in full,
not just this file, before deploying.

## Part 1: Error logging (production observability)
New: supabase/functions/_shared/errorLog.ts, lib/logError.ts,
app/error.tsx, app/global-error.tsx, admin System Health tab.
Modified: create-payment, verify-payment, delete-user-account,
ai-teacher-chat (all now log to app_error_log on failure).

IMPORTANT BUG FIX INCLUDED: in three of the four Edge Functions,
`supabase` was declared inside the try block and was NEVER actually
reachable from catch — the original error-logging code as first written
would have thrown a ReferenceError the first time it fired. Fixed by
creating a fresh client inside each catch block specifically for the
logging call. This is why create-payment, verify-payment, and
delete-user-account all need to be redeployed, not just the new files
added.

## Part 2: Admin list pagination
Modified: users-tab.tsx, moderation-tab.tsx, billing-tab.tsx, and
page.tsx (extensive wiring for all three).

Users and Payments: straightforward server-side pagination (50/page),
replacing an unlimited fetch (Users) and a flat .limit(200) (Payments).
Search and the Form filter on Users are now server-side too.

Moderation: deliberately NOT uniform pagination — unreviewed flags
(especially self-harm) stay fully unpaginated and sorted to the top;
only the reviewed history is paginated.

REGRESSION CAUGHT AND FIXED: the "pending teacher approval" banner was
deriving from the paginated Users list, meaning a pending teacher could
be invisible if their row fell on a page not currently loaded. Fixed
with its own separate, always-unpaginated query.

## Part 3: Schools reference table
New: schools table + auto-populating trigger (in the same migration as
error logging), components/SchoolAutocomplete.tsx.
Modified: register/page.tsx, register/teacher/page.tsx,
(app)/account/page.tsx — all three now use the autocomplete instead of
a plain text input.

profiles.school is UNCHANGED — still free text, no foreign key. This is
a lower-risk, incremental improvement (better suggestions going
forward), not a full normalization.

## Part 4: Exam Countdown & Revision Recommendations
New: exam_dates table + get_exam_prep_recommendations() function
(separate migration), components/ExamCountdown.tsx.
Modified: (app)/dashboard/page.tsx (mounts the new component).

Per-subject exam dates, not one date per pupil — past papers and topic
mastery are both subject-scoped already, so this was the only design
that could produce a genuinely targeted recommendation. Verified with a
real screenshot: urgent (red) vs. calm (teal) countdown styling actually
rendering correctly, and expanding a subject showing real weak topics
with real mastery percentages plus past papers sorted
unattempted-first.

## After copying these in
1. Run both new migrations in the Supabase SQL editor, in filename
   order (20260804080000 before 20260805080000)
2. Redeploy ALL FOUR modified Edge Functions — not optional, the
   scoping bug fix is in the redeploy, not just the new shared file:
   supabase functions deploy create-payment verify-payment delete-user-account ai-teacher-chat
3. No new secrets needed
4. Test: trigger a deliberate error (e.g. an invalid payment request)
   and confirm it shows up in /admin -> System Health
5. Test: set an exam date on /dashboard, confirm the countdown and
   recommendations both render
