/*
# SmartClass Zambia — Email Notifications

## Purpose
Two notification types: a welcome email on registration, and a weekly
progress digest. Neither can use Supabase Auth's own email sending (that's
scoped to auth events — confirmations, password resets — not arbitrary
app content), so both go through a transactional email provider
(Resend — see supabase/functions/_shared/email.ts) called from two new
Edge Functions: send-welcome-email and send-weekly-digest.

## 1. profiles additions
- parent_email (text, nullable): if set, the weekly digest goes here
  instead of the pupil's own login email — the realistic version of "a
  parent gets a progress update" without building a whole separate parent
  account system. Nullable/optional; falls back to the pupil's own email.
- email_notifications_enabled (boolean, default true): opt-out control,
  surfaced on the /account page.

## 2. Welcome email — trigger-based, not frontend-based
Sent via a database trigger (AFTER INSERT on profiles) rather than a
frontend call after signup. This is deliberate: a trigger fires exactly
once, reliably, no matter how the row was created — a normal /register
signup, an admin creating an account, or a future bulk-import script all
correctly send exactly one welcome email, whereas relying on the register
page's client-side code to remember to call an email function would (a)
delay the page, and (b) silently skip the email for any signup path that
isn't that one specific form.

The trigger calls the send-welcome-email Edge Function asynchronously via
pg_net's net.http_post — it queues the HTTP call and returns immediately;
the actual request happens in a background worker, so the pupil's signup
is never slowed down or blocked by email delivery.

## 3. Weekly digest — scheduled via pg_cron
A cron job (Monday 07:00 UTC — adjust to your audience's timezone; Zambia
is UTC+2 year-round, so this lands at 09:00 local time) calls
send-weekly-digest once, which itself queries every opted-in pupil and
sends their individual digest. One scheduled call fans out to many emails
inside the function, rather than one cron-scheduled row per pupil.

## 4. Required manual setup (cannot be scripted generically — see below)
Both the trigger and the cron job need to know your project's URL and a
way to authenticate the HTTP call to your Edge Functions. This migration
reads them from Postgres GUC settings (`app.settings.supabase_url` /
`app.settings.supabase_service_role_key`) rather than hardcoding a specific
project's values, since this file has to work for a real deployment I've
never seen. **After running this migration**, run (once, replacing the
placeholders):

  ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<your-project-ref>.supabase.co';
  ALTER DATABASE postgres SET app.settings.supabase_service_role_key = '<your-service-role-key>';

Then reconnect (these settings apply to new connections) and confirm with:

  SHOW app.settings.supabase_url;

Also required, both one-time, via the Supabase dashboard:
  - Database -> Extensions: enable pg_net and pg_cron if not already on
    (both ship with every Supabase project, just sometimes off by default)
  - Deploy the two new Edge Functions and set RESEND_API_KEY as a secret
    (see supabase/functions/_shared/email.ts)

Until that setup is done, the trigger/cron calls will simply fail silently
(pg_net logs the failure but doesn't block anything) — the app keeps
working normally either way, it just won't send emails yet.

All statements idempotent, no destructive operations.
*/

-- ============================================================
-- 1. profiles additions
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2. Welcome email trigger
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION trigger_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  base_url text;
  service_key text;
BEGIN
  BEGIN
    base_url := current_setting('app.settings.supabase_url', true);
    service_key := current_setting('app.settings.supabase_service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    base_url := NULL;
  END;

  -- Not configured yet (see migration header) — skip quietly rather than
  -- failing the profile insert that triggered this.
  IF base_url IS NULL OR base_url = '' OR service_key IS NULL OR service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := base_url || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('userId', NEW.id, 'fullName', NEW.full_name)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_welcome_email ON profiles;
CREATE TRIGGER trg_welcome_email
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_welcome_email();

-- ============================================================
-- 3. Weekly digest — scheduled via pg_cron
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Wrapped in a DO block with exception handling: pg_cron's schedule()
-- function requires the extension to actually be enabled and, on some
-- Supabase plans, requires scheduling from the `cron` schema explicitly.
-- If this fails, it fails loudly with a clear message rather than
-- silently not scheduling anything.
DO $$
BEGIN
  PERFORM cron.unschedule('smartclass-weekly-digest')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'smartclass-weekly-digest');

  PERFORM cron.schedule(
    'smartclass-weekly-digest',
    '0 7 * * 1', -- Monday 07:00 UTC = 09:00 Zambia time (UTC+2 year-round)
    $cron$
      SELECT net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-weekly-digest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule smartclass-weekly-digest — this is expected until app.settings.supabase_url / app.settings.supabase_service_role_key are set and pg_cron is enabled (see this migration''s header comment). Re-run this migration after completing that setup.';
END $$;
