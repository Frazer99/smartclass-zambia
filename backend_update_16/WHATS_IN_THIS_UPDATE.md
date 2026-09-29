# Subscribers by subject, warnings/deletion, audit log — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Read the README section "Subscribers by Subject, Warnings, Account
## Deletion & Audit Log" before deploying — it has an honest breakdown of
## what "100,000 users" and "more security" actually got solved at the
## database level vs. what's a business/infrastructure decision outside
## a migration's control (Supabase plan tier, pagination gaps in a few
## admin lists that still just do .limit(200)). Worth reading in full,
## not just the file list below.

## New files (2)
supabase/migrations/20260728080000_subscribers_by_subject_warnings.sql
    - get_subscribers_by_subject(): subscriber counts per subject (a
      pupil counts toward every subject their Form offers, since
      subscriptions aren't subject-scoped — this overlaps by design)
    - user_warnings table + issue_warning() function — visible to the
      warned pupil, not just admins
    - admin_action_log table — general audit trail, also retrofitted
      onto grant_bonus_subscription() and set_platform_free_mode()
    - account_deletions_log table — snapshot captured before deletion
    - Two new indexes (profiles.grade, profiles.school) for queries that
      had none before this

supabase/functions/delete-user-account/index.ts
    Real, irreversible account deletion. Has to be an Edge Function, not
    a plain SQL function — deleting the actual auth.users row needs the
    Auth Admin API, which only a service-role server context can call.
    Deploy: supabase functions deploy delete-user-account

## Modified files (3)
app/admin/(protected)/tabs/billing-tab.tsx
    New "Subscribers by Subject" section.

app/admin/(protected)/tabs/moderation-tab.tsx
    "Warn pupil" button on each flagged message, a standalone warning
    form, and a Delete Account form that requires typing "DELETE" to
    enable the button — not a single click for something permanent.

app/admin/(protected)/page.tsx
    Wires all of the above in: state, fetchBilling extended with
    subscribers-by-subject, handleIssueWarning, handleDeleteAccount
    (calls the new Edge Function).

README.md
    New section with the honest scale/security breakdown mentioned above.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. supabase functions deploy delete-user-account
3. No new secrets needed
4. Read the honest scale/security note in the README before assuming
   "100,000 users" is fully solved — the indexes are real and concrete;
   a few admin list queries still don't paginate, which is a real,
   named gap, not a hidden one
