/*
# SmartClass Zambia — Moderation Flags: Data Retention

## Purpose
The content moderation migration (20260723080000) deliberately left this
unresolved: "this table can contain a pupil's message during a moment of
real distress... it also deserves an actual data retention policy... that
this codebase doesn't decide." This migration builds the *infrastructure*
for that policy — a cleanup function, an audit trail, and a scheduled
job — with conservative, clearly-labeled defaults. It does NOT assert
those defaults are correct. How long to keep this data, and whether
self-harm-flagged records should ever be deleted at all, is a genuine
policy decision for ZedCode Technologies to make with real legal/child-
safety guidance (Zambian data protection law, the school's own
safeguarding obligations, etc.) — not something an AI-authored migration
should decide unilaterally. Treat every default below as a starting point
to review and explicitly confirm or change, not a finished policy.

## The one opinion this migration DOES take a firm stance on
Self-harm-flagged rows are NEVER touched by the automatic cleanup unless
someone explicitly opts in (p_delete_self_harm => true, which the
scheduled job below does NOT pass). The asymmetry is deliberate: getting
this wrong in the "keep too long" direction is recoverable (delete it
later once a real policy exists); getting it wrong in the "auto-deleted
a potential safeguarding record no one reviewed" direction is not. A
safe default that requires a human to actively loosen it, rather than a
convenient default that requires a human to notice and tighten it.

## 1. moderation_flags_cleanup_log
Audit trail of every cleanup run — counts and a severity breakdown, NOT
the deleted messages themselves (logging the content would defeat the
point of deleting it). Lets an admin answer "were old flags actually
being cleaned up, and how many" without needing the content that was
removed.

## 2. cleanup_old_moderation_flags(days_to_keep, delete_self_harm)
- Only ever deletes rows where reviewed = true — an unreviewed flag,
  however old, is never silently removed; someone has to have actually
  looked at it first.
- Only deletes self-harm severity rows if delete_self_harm is explicitly
  true (default false).
- Logs a summary row to moderation_flags_cleanup_log every time it runs,
  even if it deletes zero rows (so "nothing happened" is itself visible,
  not indistinguishable from "the job never ran").
- SECURITY DEFINER + admin-only gate, same pattern as every other
  privileged function in this project — but ALSO callable by the
  scheduled cron job below, which runs as postgres (already trusted).

## 3. Scheduled job (commented out, not auto-enabled)
Per the same reasoning as above, this migration does NOT automatically
schedule the cleanup to run — that would mean a policy decision (90 days,
non-self-harm only) silently took effect the moment this migration ran,
before anyone at ZedCode explicitly agreed to it. The exact cron.schedule
call is included as a comment, ready to uncomment and run once a real
decision has been made.

Idempotent (CREATE OR REPLACE, CREATE TABLE IF NOT EXISTS), no
destructive operations from running this migration itself — it adds the
capability to delete data later, under explicit conditions, not a
standing deletion that starts immediately.
*/

CREATE TABLE IF NOT EXISTS moderation_flags_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT now(),
  days_to_keep int NOT NULL,
  self_harm_included boolean NOT NULL,
  rows_deleted int NOT NULL,
  severity_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  oldest_deleted_created_at timestamptz,
  newest_deleted_created_at timestamptz
);

ALTER TABLE moderation_flags_cleanup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_cleanup_log" ON moderation_flags_cleanup_log;
CREATE POLICY "admin_select_cleanup_log" ON moderation_flags_cleanup_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION cleanup_old_moderation_flags(
  p_days_to_keep int DEFAULT 90,
  p_delete_self_harm boolean DEFAULT false
)
RETURNS TABLE (rows_deleted int, severity_breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count int;
  v_breakdown jsonb;
  v_oldest timestamptz;
  v_newest timestamptz;
  v_is_admin boolean;
  v_is_scheduled_context boolean;
BEGIN
  -- Callable two ways: an authenticated admin testing it manually via
  -- RPC, or the scheduled cron job (which runs with no auth.uid() at
  -- all, as the postgres role directly) — auth.uid() is NULL in that
  -- second case, which is what tells them apart here.
  v_is_admin := EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
  v_is_scheduled_context := auth.uid() IS NULL;

  IF NOT v_is_admin AND NOT v_is_scheduled_context THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT
    count(*),
    jsonb_object_agg(severity, sev_count),
    min(created_at),
    max(created_at)
  INTO v_deleted_count, v_breakdown, v_oldest, v_newest
  FROM (
    SELECT severity, count(*) AS sev_count, min(created_at) AS created_at
    FROM moderation_flags
    WHERE reviewed = true
      AND created_at < now() - (p_days_to_keep || ' days')::interval
      AND (p_delete_self_harm OR severity != 'self_harm')
    GROUP BY severity
  ) sub;

  DELETE FROM moderation_flags
  WHERE reviewed = true
    AND created_at < now() - (p_days_to_keep || ' days')::interval
    AND (p_delete_self_harm OR severity != 'self_harm');

  INSERT INTO moderation_flags_cleanup_log
    (days_to_keep, self_harm_included, rows_deleted, severity_breakdown, oldest_deleted_created_at, newest_deleted_created_at)
  VALUES
    (p_days_to_keep, p_delete_self_harm, COALESCE(v_deleted_count, 0), COALESCE(v_breakdown, '{}'::jsonb), v_oldest, v_newest);

  RETURN QUERY SELECT COALESCE(v_deleted_count, 0), COALESCE(v_breakdown, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_moderation_flags TO authenticated, service_role;

-- ============================================================
-- NOT enabled automatically — see the migration header. Once ZedCode has
-- actually decided on a retention window, run this (adjust the interval
-- and p_days_to_keep to match whatever was decided):
--
--   SELECT cron.schedule(
--     'smartclass-moderation-cleanup',
--     '0 8 1 * *', -- 1st of each month, 08:00 UTC / 10:00 Zambia time
--     $cron$ SELECT cleanup_old_moderation_flags(90, false); $cron$
--   );
--
-- Uses the same pg_net/pg_cron setup as the weekly digest — see
-- migration 20260720080000's header for the app.settings prerequisites,
-- though this particular job doesn't need pg_net at all (it calls the
-- function directly, no HTTP request to an Edge Function needed).
-- ============================================================
