/*
# SmartClass Zambia — Account Management: Close a Role-Escalation Gap

## Purpose
Building self-service account editing (pupils updating their own name,
school, and Form) surfaced a real, pre-existing gap: profiles' RLS UPDATE
policies (`update_own_profile` from the original schema, and
`admin_update_profiles` added later) both permit `auth.uid() = id` — a
user updating their own row — with no restriction on *which* columns can
change. Neither policy stops a pupil from calling
`supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)`
directly and promoting themselves. This was exploitable today via any
Supabase client, not something the new account page introduces — it just
made building self-service editing the moment to actually fix it.

## Fix
RLS policies can't cleanly express "this column may change, but only for
privileged callers" — WITH CHECK only sees the NEW row, not OLD, so
comparing "did role change" isn't expressible in a plain policy without
an awkward self-referencing subquery. A BEFORE UPDATE trigger is the
standard, correct tool for exactly this: it runs after RLS has already
permitted the row-level UPDATE, and can inspect both OLD and NEW.

If `role` is changing and the calling user (`auth.uid()`) is not
themselves an admin, the trigger silently resets `NEW.role` back to
`OLD.role` — the rest of the update (name/school/grade, or whatever else
was included) still goes through. Silently reverting rather than raising
an exception means a legitimate self-update that happens to resubmit the
unchanged role value (as a naive "update my whole profile object" call
might) doesn't fail outright; only an actual attempted change is blocked.
Admins remain able to change any profile's role, including their own,
since the check is "is the *caller* currently an admin," not "is this the
caller's own row."

No RLS policies are removed — the existing ones still govern which rows
can be touched at all; this trigger adds column-level protection on top.

Idempotent (CREATE OR REPLACE, DROP TRIGGER IF EXISTS), no destructive
operations, no data loss.
*/

CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_self_role_escalation();
