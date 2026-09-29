# Fix: admin bootstrapping was silently impossible

## What was broken
prevent_self_role_escalation (migration 20260719080000) checked
`auth.uid()` to decide whether a role change was allowed. When run in
the Supabase SQL Editor (as the database owner, no JWT session),
auth.uid() is NULL, and `id = NULL` matches no row in SQL — so the
trigger's check was ALWAYS true in that context, and it ALWAYS
reverted any role change, even there. The UPDATE reported success, no
error — role just silently never changed. There was no way, through
any normal means, to create the first admin account on a fresh
deployment.

## Why the fix is safe (verified, not assumed)
update_own_profile RLS only grants UPDATE to authenticated, and only
for auth.uid() = id. An anonymous request can never reach this trigger
at all — RLS blocks it before the trigger runs. The only way
auth.uid() can be NULL while this trigger fires is a context that
already bypasses RLS entirely (SQL Editor, or a service-role client) —
both already fully-privileged by definition. This was confirmed by
reading the actual RLS policy, not assumed.

## The fix
supabase/migrations/20260808080000_fix_admin_bootstrap.sql —
CREATE OR REPLACE FUNCTION prevent_self_role_escalation(), adding an
explicit `auth.uid() IS NOT NULL` condition. No session at all skips
the check and lets the change through. Every other case (an
authenticated non-admin trying to change their own role) is completely
unaffected and still blocked exactly as before.

## New files/changes (3)
supabase/migrations/20260808080000_fix_admin_bootstrap.sql (new)
README.md (documents the bug and the fix, same section style as every
  other fix this session)
DEPLOYMENT.md (new section 1.5 — the actual bootstrapping steps: register
  a pupil account, then a single UPDATE in the SQL Editor now genuinely
  works; migration count updated 36 -> 37)

## After copying these in
Run the new migration in the Supabase SQL editor. No Edge Function
redeploy needed — this is a pure database trigger fix. If you already
used the disable-trigger-then-update workaround to bootstrap an admin
before this fix existed, nothing further is needed; that admin account
is already correctly set.
