/*
# SmartClass Zambia — Error Logging & Schools Reference Table

## Purpose
Two independent additions, both closing gaps named explicitly as real,
not hypothetical: (1) genuine error visibility — right now a silent
failure (a broken payment, both AI providers down at once) only
surfaces if someone complains; (2) a real fix for the free-text school
matching problem that's been documented as a known limitation since the
School Analytics migration, rather than left as a permanent caveat.

## 1. app_error_log
Not a replacement for a real third-party error tracking service (Sentry
or similar) — that requires an account this build environment can't set
up. This is the part that's actually buildable and verifiable from
here: a real, queryable record of what broke, when, and for whom,
directly in the same database everything else lives in. A genuine
service like Sentry remains a reasonable next step on top of this, not
instead of it — see the README section shipped alongside this migration
for what that would add.

Write access: `authenticated` only (not `anon`) — pre-auth failures
(failed login attempts, etc.) are already captured in Supabase's own
Auth logs; this table is for errors happening within the app itself,
where a real session exists to log against. Edge Functions write via
the service-role client, which bypasses RLS entirely, so no INSERT
policy is needed for that path.

## 2. schools
Deliberately NOT a foreign-key migration of profiles.school — that
would mean touching every function and query in this project that
currently reads school as plain text (School Analytics, teacher
scoping, the pupil/teacher registration forms), a much larger and
riskier change than this pass attempts. Instead: a reference table that
autocompletes registration forms toward EXISTING school names,
auto-populated by a trigger whenever a genuinely new one is entered —
`profiles.school` stays exactly as it is, still free text, but new
signups are nudged toward consistency instead of typing a fresh
variant every time. Seeded from every distinct school already in
profiles, so nothing existing is lost or need re-entering.

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS app_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  error_message text NOT NULL,
  error_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_error_log" ON app_error_log;
CREATE POLICY "admin_select_error_log" ON app_error_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "authenticated_insert_error_log" ON app_error_log;
CREATE POLICY "authenticated_insert_error_log" ON app_error_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_error_log_created ON app_error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_log_source ON app_error_log(source, created_at DESC);

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_schools" ON schools;
CREATE POLICY "read_schools" ON schools FOR SELECT
  TO anon, authenticated USING (true);

-- Seed from every distinct school already in use — real data, not a
-- fresh empty list that would make autocomplete useless on day one.
INSERT INTO schools (name)
SELECT DISTINCT school FROM profiles WHERE school IS NOT NULL AND trim(school) != ''
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_school_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school IS NOT NULL AND trim(NEW.school) != '' THEN
    INSERT INTO schools (name) VALUES (NEW.school) ON CONFLICT (name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_school_reference ON profiles;
CREATE TRIGGER trg_sync_school_reference
  AFTER INSERT OR UPDATE OF school ON profiles
  FOR EACH ROW
  WHEN (NEW.school IS NOT NULL)
  EXECUTE FUNCTION sync_school_reference();
