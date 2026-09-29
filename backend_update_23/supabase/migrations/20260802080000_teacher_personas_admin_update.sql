/*
# SmartClass Zambia — Admin Write Access to Teacher Personas

## Purpose
teacher_personas has had a SELECT policy since it was created
(migration 20260721080000) but never an UPDATE policy — meaning no
authenticated client, including an admin's own session, could ever
update a persona's liveavatar_avatar_id or liveavatar_voice_id through
the app. The one successful update so far (Chipo's avatar_id) only
worked because it was run directly in the Supabase SQL Editor, which
uses an elevated role that bypasses RLS entirely — not through the app.

This became a real, blocking gap the moment there was a reason to
update this table from the admin panel (wiring up LiveAvatar avatar IDs
for the other four personas) rather than through the SQL Editor by hand
every time.

## Fix
Admin-only UPDATE policy, same role-check pattern used everywhere else
in this project. A full-row policy, not column-restricted — unlike
profiles.role (where a compromised pupil session is the threat model
prevent_self_role_escalation guards against), teacher_personas is
reference/config data no pupil can reach an UPDATE policy for in the
first place; the only sessions that satisfy "is an admin" here are
already fully trusted with this table.

Idempotent, no destructive operations.
*/

DROP POLICY IF EXISTS "admin_update_teacher_personas" ON teacher_personas;
CREATE POLICY "admin_update_teacher_personas" ON teacher_personas FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
