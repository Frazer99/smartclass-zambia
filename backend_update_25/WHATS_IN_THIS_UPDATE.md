# Parent & teacher accounts — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite. This is
the largest single feature built this session — read this whole file,
not just the list, before deploying.

## Read this first: a real security-trigger conflict, and how it was resolved
profiles.role has been protected since migration 20260719080000
(prevent_self_role_escalation) — it silently reverts any role change
attempted via UPDATE by a non-admin session. That's correct for stopping
a pupil from self-promoting to admin, but it would ALSO have blocked a
legitimate parent/teacher signup from ever getting their role set
correctly, since that's exactly the kind of self-initiated role change
the trigger is designed to block.

The fix: role is now set at INSERT time, inside handle_new_user()
itself, reading raw_user_meta_data->>'role' — allowlisted to ONLY
'pupil', 'parent', or 'teacher'. 'admin' can never be set this way, no
matter what a signup request's metadata claims. prevent_self_role_escalation
only fires on UPDATE, so it never sees this INSERT-time role assignment
happen at all — no conflict. Every existing pupil signup is completely
unaffected: it never sent a role in its metadata before this migration,
and still doesn't, so it still defaults to 'pupil' exactly as before.

## New files (7)
supabase/migrations/20260803080000_parent_teacher_accounts.sql
    - Extends handle_new_user() as described above
    - parent_child_links table + auto-linking trigger (works in either
      order: parent signs up first, or child sets parent_email first)
    - get_my_children(), get_child_progress(child_id) — real
      server-side access control, not just UI filtering
    - Extends (not duplicates) get_school_topic_analytics() and
      get_common_misconceptions() to also allow an approved teacher,
      strictly scoped to their own school, checked inside the function

app/register/parent/page.tsx
app/register/teacher/page.tsx
    New registration flows. Teacher signup shows a clear "pending admin
    approval" screen — NOT immediate access, by design (see below).

app/parent/page.tsx
app/teacher/page.tsx
    Standalone dashboards (deliberately NOT part of the (app) pupil
    layout — that layout's nav and Form/grade assumptions don't apply
    to either role). Verified with a real screenshot: parent dashboard
    showing two linked children, one expanded with real per-topic
    mastery data, correctly color-coded.

## Modified files (4)
app/login/page.tsx
    Now role-aware: after sign-in, looks up the real role directly
    (not relying on possibly-stale context state) and routes to
    /dashboard, /parent, or /teacher accordingly. An unapproved teacher
    is signed back out immediately with a clear message, not left in a
    confusing half-logged-in state.

app/register/page.tsx
    Small discovery links added: "Parent account" / "Teacher account".

app/admin/(protected)/tabs/users-tab.tsx
app/admin/(protected)/page.tsx
    New "pending teacher approval" section in the Users tab — teacher
    accounts are DELIBERATELY NOT self-service. teacher_approved
    defaults to false; an admin has to approve before a teacher account
    can see anything, since teacher access exposes aggregated
    performance data across a whole school's real pupils.

lib/supabase-client.ts
    Profile type gains teacher_approved.

README.md
    New "Parent & Teacher Accounts" section — long, on purpose, given
    the scope and the security-trigger conflict this surfaced.

## A known, real caveat (already true elsewhere in this project)
Teacher school-matching relies on the teacher's profiles.school string
matching pupils' profiles.school EXACTLY (spelling/capitalization) —
the same free-text school limitation already documented for School
Analytics. The teacher registration form warns about this directly.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. No new Edge Function, no new secret
3. Test the full loop: register a pupil, add a parent email in that
   pupil's /account, then register a parent with that same email —
   confirm the child shows up on /parent. Also register a teacher,
   confirm they're blocked from /teacher until you approve them from
   the admin Users tab.
