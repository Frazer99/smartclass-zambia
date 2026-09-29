# Printable past paper solutions & teaching notes — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite. No
migration, no new secret, no Edge Function.

## Read this before assuming both pages are equally verified
The teaching notes page (/lesson/[id]/notes) was confirmed with a real
screenshot — all content sections rendering correctly against sample
lesson data. The solutions page (/past-papers/[id]/solutions) was NOT
successfully screenshotted — a crash occurred, but it was isolated to
a throwaway test mock that had already had multiple genuine mistakes
in that same debugging session (invalid syntax, a silently-failed
string replacement). The REAL production build (real Supabase client,
full TypeScript checking, not a mock) compiles this page with zero
errors, which is meaningfully short of a confirmed visual render.
Test this one directly against a real past paper before relying on it.

## New files (2)
app/(app)/past-papers/[id]/solutions/page.tsx
    Every question, its answer, and its explanation, print-optimized
    (same approach as /progress/report — browser print-to-PDF, no
    added PDF library). Uses the explanation already stored on each
    question, not a fresh AI call.

app/(app)/lesson/[id]/notes/page.tsx
    The lesson's structured teaching content (intro, steps with board
    work, worked examples, summary), same print-optimized approach.
    Route param is the SESSION id (matching the main lesson page's own
    convention), not the lesson id directly.

## Modified files (2)
app/(app)/past-papers/[id]/page.tsx
    Added a "Print solutions" link next to "Start whole paper."

app/(app)/lesson/[id]/page.tsx
    Added a "Print notes" link next to the lesson title.

## After copying these in
Nothing to deploy beyond the normal Next.js build — no migration, no
secret, no Edge Function. Test both print pages against real data
before considering this fully verified, given the solutions page's
verification gap noted above.
