/*
# SmartClass Zambia — Subscriptions, Payments & Free-Tier Gating

## Purpose
Real monetization: a daily free quota (15 AI chat messages/day) that
prompts a subscribe flow once exhausted, real payments via DPO Group
(Direct Pay Online — confirmed to support both card and mobile money,
including MTN/Airtel Money, specifically in Zambia and ZMW), admin
visibility into who's paid and daily/monthly revenue, and two kinds of
"free" the admin controls: a per-pupil bonus grant, and a platform-wide
free-mode toggle.

## 1. platform_settings
Simple key-value config rather than a rigid single-purpose table — this
project already has enough precedent for "the exact number is a policy
decision" (see the moderation retention migration) that a flexible
settings table is worth having for exactly this kind of value. Seeded
with two keys pupils and the app both need to read:
  - is_platform_free (boolean): the global promo-mode switch
  - subscription_price_zmw (number): **a placeholder default, not a
    real price** — see the note in the seed data below. This is a
    genuine business decision for ZedCode, the same way the moderation
    retention window was; this migration picks a number so the system
    is functional, not because that number is correct.
Readable by any authenticated user (knowing whether free mode is on, or
what the price is, isn't sensitive); writable by admins only.

## 2. subscriptions
One row per pupil's current subscription state.
- status: 'active' | 'expired' | 'cancelled'
- is_bonus_grant: true when an admin granted this rather than a payment
  funding it — grant_bonus_subscription() below is the only way this
  gets set to true
- granted_by: which admin granted a bonus (null for paid subscriptions)
- expires_at: null means "granted with no expiry" (a permanent bonus),
  otherwise the actual expiry timestamp

## 3. payments
One row per payment attempt (not just successes) — pending/failed
attempts matter for admin visibility ("why didn't this payment go
through") as much as completed ones do.
- provider: 'dpo' (room for another provider later without a schema
  change to every other table)
- provider_token / provider_ref: DPO's own TransToken (created at
  initiation) and TransRef (assigned once actually paid) — used to
  re-verify a payment's real status directly with DPO rather than
  trusting a redirect/callback alone (standard payment security: a
  callback can be spoofed, a server-to-server status check with the
  provider cannot).

## 4. has_active_subscription(user_id) and grant_bonus_subscription(user_id, days)
Two small functions: the first is what ai-teacher-chat calls to decide
whether to apply the free-tier daily quota at all (skipped entirely for
subscribed pupils, and for everyone when platform-wide free mode is on);
the second is the admin-only per-pupil bonus grant, SECURITY DEFINER +
role-gated like every other privileged function in this project.

## Security (RLS)
- platform_settings: read by any authenticated user, write by admins only
- subscriptions: pupils read their own row, admins read/write all — no
  direct pupil INSERT/UPDATE (subscriptions are only ever created by the
  payment webhook or an admin's bonus grant, both running with elevated
  privileges, never directly by a pupil's own client)
- payments: pupils read their own rows, admins read all — same no-direct-
  write reasoning as subscriptions

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_platform_settings" ON platform_settings;
CREATE POLICY "read_platform_settings" ON platform_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_platform_settings" ON platform_settings;
CREATE POLICY "admin_write_platform_settings" ON platform_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Seed defaults. subscription_price_zmw is a PLACEHOLDER (50 ZMW/month) —
-- update this via the admin Billing tab once ZedCode has actually
-- decided on real pricing; nothing about this number is a recommendation.
INSERT INTO platform_settings (key, value) VALUES
  ('is_platform_free', 'false'::jsonb),
  ('subscription_price_zmw', '50'::jsonb),
  ('free_daily_message_limit', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  plan_type text NOT NULL DEFAULT 'monthly',
  is_bonus_grant boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_paid numeric(10,2),
  currency text DEFAULT 'ZMW',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_subscriptions" ON subscriptions;
CREATE POLICY "admin_select_all_subscriptions" ON subscriptions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'ZMW',
  payment_method text NOT NULL CHECK (payment_method IN ('mobile_money', 'card')),
  provider text NOT NULL DEFAULT 'dpo',
  provider_token text,
  provider_ref text,
  company_ref text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON payments;
CREATE POLICY "select_own_payments" ON payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_payments" ON payments;
CREATE POLICY "admin_select_all_payments" ON payments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_company_ref ON payments(company_ref);

CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_free boolean;
BEGIN
  SELECT (value #>> '{}')::boolean INTO v_platform_free
  FROM platform_settings WHERE key = 'is_platform_free';

  IF COALESCE(v_platform_free, false) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION has_active_subscription TO authenticated, service_role;

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
END;
$$;

GRANT EXECUTE ON FUNCTION grant_bonus_subscription TO authenticated;

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
END;
$$;

GRANT EXECUTE ON FUNCTION set_platform_free_mode TO authenticated;

-- Admin revenue reporting: daily and monthly totals from completed
-- payments only (pending/failed attempts don't count as revenue).
CREATE OR REPLACE FUNCTION get_revenue_summary()
RETURNS TABLE (period text, total_amount numeric, payment_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT to_char(completed_at, 'YYYY-MM-DD') AS period, SUM(amount) AS total_amount, count(*) AS payment_count
  FROM payments
  WHERE status = 'completed' AND completed_at > now() - interval '30 days'
  GROUP BY to_char(completed_at, 'YYYY-MM-DD')
  ORDER BY period DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_revenue_summary TO authenticated;
