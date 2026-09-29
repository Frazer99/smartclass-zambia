# Moderation flags data retention — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Read this before deploying — this one is NOT self-activating
This migration builds the ABILITY to auto-delete old, reviewed
moderation flags. It does NOT turn that on. The cron.schedule() call
that would actually enable automatic deletion is left as a COMMENT in
the migration file — on purpose. This is genuinely a policy decision
(how long to keep flagged content, whether self-harm-flagged rows should
ever be auto-deleted at all) that needs real legal/safeguarding input
from your team, not something an AI-authored migration should decide
for you by defaulting it to "on."

## New file (1)
supabase/migrations/20260726080000_moderation_flags_retention.sql
    - moderation_flags_cleanup_log table: audit trail of cleanup runs
      (counts + severity breakdown only, never the deleted message
      content — logging that would defeat the point of deleting it)
    - cleanup_old_moderation_flags(days_to_keep, delete_self_harm)
      function: only deletes rows that are reviewed = true; self-harm
      rows are never touched unless delete_self_harm is explicitly true
    - The actual cron.schedule(...) call to enable automatic runs is a
      COMMENT at the bottom of the file, not executed by this migration

## Modified files (2)
app/admin/(protected)/tabs/moderation-tab.tsx
    New "Data Retention" panel: explains that cleanup isn't scheduled,
    shows the run history (empty by default).
app/admin/(protected)/page.tsx
    Fetches moderation_flags_cleanup_log alongside the existing
    moderation_flags fetch, passes it to the tab.

README.md
    New "Data Retention for Flagged Content" section.

## After copying this in
1. Run the migration in the Supabase SQL editor — this alone does NOT
   start deleting anything, it just adds the capability
2. Decide, as an actual team decision: how many days to keep reviewed,
   non-self-harm flags, and whether self-harm-flagged rows should ever
   be auto-deleted (my strong suggestion: no, or only after a much
   longer, separately-considered period)
3. Once decided, uncomment and run the cron.schedule(...) block at the
   bottom of the migration file, with your actual chosen numbers
4. Until step 3, you can still test the function manually as an admin:
   SELECT cleanup_old_moderation_flags(90, false); — this is safe to run
   any time to see what it WOULD do, without anything being scheduled
