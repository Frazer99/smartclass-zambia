/*
# SmartClass Zambia — Subscribers by Subject, Warnings & Account Deletion, Audit Log

## Purpose
Three related additions: (1) subscriber counts broken down by subject,
(2) a warning system tied to the existing content-moderation flags, with
escalation to account deletion for repeat violators, and (3) a general
admin-action audit log — partly because warnings/deletion are exactly
the kind of high-stakes action that needs accountability, and partly
because it's the concrete database-level piece of "more security" that
this migration can actually deliver (see the README section this ships
with for what's infrastructure-level rather than schema-level).

## 1. Subscribers by subject
Subscriptions in this schema are platform-wide, not per-subject — a
pupil doesn't subscribe to Mathematics specifically. "Subscribers by
subject" is computed here as: for each subject, how many currently-active
subscribers (paid or bonus) have a Form that subject is offered to
(joining on subjects.grades, the array already used everywhere else in
this project for "which Forms is this subject taught to"). A pupil in
Form 5 with an active subscription counts toward both Mathematics and
Physics, since both are offered to Form 5 — that's correct, not a bug;
subscriptions aren't subject-scoped, so a subscriber counts for every
subject genuinely available to them.

## 2. user_warnings + repeat-violator escalation
- issue_warning(user_id, reason, moderation_flag_id): admin-gated,
  logs a warning visible to the pupil themselves (transparency matters —
  a warning a pupil never sees can't change behavior) and to admins.
- Escalation is a human decision, not automatic: this migration does NOT
  auto-delete anyone after N warnings. An admin sees the warning count
  (surfaced in the Moderation tab) and decides. Automating account
  deletion based on a threshold is a much bigger, riskier decision — a
  false-positive moderation flag, a misunderstanding, or a kid genuinely
  changing their behavior after one warning would all be poorly served
  by an automatic cutoff. A human stays in the loop for anything this
  serious, the same reasoning already applied to the moderation
  retention policy not auto-scheduling itself.

## 3. Account deletion — handled by a new Edge Function, not SQL alone
Deleting a Supabase Auth user (the actual auth.users row, not just the
profiles row) requires the Auth Admin API, which only a service-role
Edge Function can call — a plain Postgres function cannot delete from
auth.users directly. See supabase/functions/delete-user-account/index.ts,
shipped alongside this migration. What this migration provides is the
audit trail that function writes to BEFORE deleting (account_deletions_log)
— capturing who, why, and a snapshot of key info, since that information
is gone once the account actually goes.

## 4. admin_action_log
General audit trail for sensitive admin actions — not just
warnings/deletions, but retrofitted onto the existing free-mode toggle
and bonus-grant functions too, so "who changed what, when" has one place
to look rather than being scattered (or, for several of these actions,
not recorded anywhere at all until now).

## 5. Indexes for scale
profiles.grade and profiles.school are both filtered/joined on on
several admin queries (get_subscribers_by_subject here,
get_school_topic_analytics from a previous migration) with no index
backing either — at a handful of test users this doesn't matter; at real
scale it's a full table scan on every one of those admin queries. Added
here. This is the honest, concrete part of "support 100,000 users" a
migration can actually do — see the README for what's genuinely an
infrastructure/operational question this migration can't answer.

Idempotent, no destructive operations.
*/

CREATE OR REPLACE FUNCTION get_subscribers_by_subject()
RETURNS TABLE (subject_id uuid, subject_name text, subscriber_count bigint, bonus_count bigint, paid_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS subject_id,
    s.name AS subject_name,
    count(DISTINCT sub.user_id) AS subscriber_count,
    count(DISTINCT sub.user_id) FILTER (WHERE sub.is_bonus_grant) AS bonus_count,
    count(DISTINCT sub.user_id) FILTER (WHERE NOT sub.is_bonus_grant) AS paid_count
  FROM subjects s
  JOIN profiles p ON p.grade = ANY(s.grades) AND p.role = 'pupil'
  JOIN subscriptions sub ON sub.user_id = p.id AND sub.status = 'active'
    AND (sub.expires_at IS NULL OR sub.expires_at > now())
  GROUP BY s.id, s.name
  ORDER BY subscriber_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_subscribers_by_subject TO authenticated;

CREATE TABLE IF NOT EXISTS admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_action_log" ON admin_action_log;
CREATE POLICY "admin_select_action_log" ON admin_action_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_action_log_target ON admin_action_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON admin_action_log(created_at DESC);

CREATE TABLE IF NOT EXISTS user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  related_moderation_flag_id uuid REFERENCES moderation_flags(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_warnings" ON user_warnings;
CREATE POLICY "select_own_warnings" ON user_warnings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_warnings" ON user_warnings;
CREATE POLICY "admin_select_all_warnings" ON user_warnings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON user_warnings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_deletions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  warning_count_at_deletion int NOT NULL DEFAULT 0,
  full_name_snapshot text,
  email_snapshot text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE account_deletions_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_deletions_log" ON account_deletions_log;
CREATE POLICY "admin_select_deletions_log" ON account_deletions_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE OR REPLACE FUNCTION issue_warning(p_user_id uuid, p_reason text, p_moderation_flag_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO user_warnings (user_id, issued_by, reason, related_moderation_flag_id)
  VALUES (p_user_id, auth.uid(), p_reason, p_moderation_flag_id);

  INSERT INTO admin_action_log (admin_id, action_type, target_user_id, details)
  VALUES (auth.uid(), 'warn_user', p_user_id, jsonb_build_object('reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION issue_warning TO authenticated;

-- Retrofit audit logging onto existing sensitive functions from the
-- subscriptions migration — same admin-gate logic, now also recorded.
CREATE OR REPLACE FUNCTION grant_bonus_subscription(p_user_id uuid, p_days int DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO subscriptions (user_id, status, plan_type, is_bonus_grant, granted_by, expires_at)
  VALUES (
    p_user_id, 'active', 'bonus', true, auth.uid(),
    CASE WHEN p_days IS NULL THEN NULL ELSE now() + (p_days || ' days')::interval END
  );

  INSERT INTO admin_action_log (admin_id, action_type, target_user_id, details)
  VALUES (auth.uid(), 'grant_bonus', p_user_id, jsonb_build_object('days', p_days));
END;
$$;

CREATE OR REPLACE FUNCTION set_platform_free_mode(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO platform_settings (key, value, updated_at, updated_by)
  VALUES ('is_platform_free', to_jsonb(p_enabled), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();

  INSERT INTO admin_action_log (admin_id, action_type, target_user_id, details)
  VALUES (auth.uid(), 'toggle_free_mode', NULL, jsonb_build_object('enabled', p_enabled));
END;
$$;

-- Scale indexes — see migration header for why these two specifically.
CREATE INDEX IF NOT EXISTS idx_profiles_grade ON profiles(grade);
CREATE INDEX IF NOT EXISTS idx_profiles_school ON profiles(school);
