/*
# SmartClass Zambia — Fix: Admin Bootstrapping Was Silently Impossible

## Purpose
`prevent_self_role_escalation` (migration 20260719080000) correctly
stops an authenticated pupil session from promoting itself to admin.
But it never accounted for the one context that has to be allowed to
set the very first admin: a superuser SQL Editor session, or a
service-role client — neither of which has an `auth.uid()` at all.

The trigger's check was `NOT EXISTS (SELECT 1 FROM profiles WHERE id =
auth.uid() AND role = 'admin')`. When `auth.uid()` is NULL (no JWT
session — exactly the SQL Editor's situation), `id = NULL` matches no
row in SQL, so this check was ALWAYS true, and the trigger ALWAYS
reverted the role change — even when run directly in the SQL Editor as
the database owner. The UPDATE would report success with no error, but
`role` would silently stay whatever it was. There was no way, through
any normal means, to ever create the first admin account.

## Why allowing `auth.uid() IS NULL` here is safe, not a new hole
The `update_own_profile` RLS policy (original schema,
20260710150823) only grants UPDATE to the `authenticated` role, and
even then only for `auth.uid() = id` — a user's own row. An anonymous
request can never reach an UPDATE on `profiles` at all; RLS blocks it
before this trigger ever runs. The *only* way `auth.uid()` can be NULL
while this trigger is executing is a context that already bypasses RLS
entirely — the SQL Editor (running as the database owner) or a
service-role client. Both are already fully-privileged by definition;
a service-role key is a secret only trusted backend code should ever
hold. Allowing the NULL case through doesn't open a new path through
the app or its API — it only unblocks the legitimate bootstrapping
scenario that was accidentally blocked too.

## Fix
Add an explicit `auth.uid() IS NOT NULL` condition to the check — if
there's no session at all, skip the escalation check entirely and let
the change through. Every other case (an authenticated non-admin
trying to change their own role) is unaffected and still blocked
exactly as before.

Idempotent (CREATE OR REPLACE), no destructive operations.
*/

CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
