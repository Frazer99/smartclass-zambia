# Pupil-facing privacy self-service — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite. No
migration, no new secret — reuses tables and RLS policies already in
place from earlier updates.

## Important: this changes delete-user-account's behavior
Previously this function explicitly REFUSED self-deletion ("You cannot
delete your own account this way"). That's now inverted — a caller can
always delete their own account (no admin role needed), while deleting
someone ELSE's account still requires admin + a reason, exactly as
before. If anything in your admin UI relied on that old refusal
behavior, it no longer applies.

## New file (1)
lib/exportUserData.ts
    exportAllUserData() + downloadJson(). Pulls profile, progress,
    mastery, subscriptions, payments, practice/past-paper attempts, and
    chat/interaction history into one JSON file. RLS already scopes
    every query to the caller's own rows, so no extra authorization
    logic needed. Deliberately excludes moderation_flags/user_warnings —
    a separate product decision, not made by this function.

    Verified by actually triggering the download in a real browser and
    inspecting the resulting file, not just confirming the button exists.

## Modified files (2)
supabase/functions/delete-user-account/index.ts
    Now serves both admin-initiated deletion (existing behavior,
    unchanged: requires admin role + a reason) and genuine self-service
    deletion (new: any caller can delete their own account, reason
    optional). Self-deletions are NOT written to admin_action_log (no
    admin acted) but DO get a full snapshot in account_deletions_log
    either way — deleted_by === deleted_user_id is how you can tell it
    was self-service when reading that log later.
    Redeploy: supabase functions deploy delete-user-account

app/(app)/account/page.tsx
    Two new cards: "Your Data" (download button) and "Delete My
    Account" (same "type DELETE to confirm" pattern already used in the
    admin Moderation tab, consistent rather than inventing a new pattern
    for pupils specifically).

README.md
    New "Pupil-Facing Privacy Self-Service" section.

## After copying these in
1. supabase functions deploy delete-user-account
2. No new secrets, no migration — everything reuses tables/RLS/columns
   from earlier updates (subscriptions, payments migration; student
   learning profile migration)
