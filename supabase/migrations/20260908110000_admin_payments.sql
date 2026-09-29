/* Payment and subscription records for the active application. */

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  plan_type text NOT NULL DEFAULT 'monthly',
  is_bonus_grant boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_paid numeric(10,2),
  currency text NOT NULL DEFAULT 'ZMW',
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscriptions;
CREATE POLICY "select_own_subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_select_all_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_select_all_subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin_profile_user());
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
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

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_payments" ON public.payments;
CREATE POLICY "select_own_payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_select_all_payments" ON public.payments;
CREATE POLICY "admin_select_all_payments" ON public.payments FOR SELECT TO authenticated USING (public.is_admin_profile_user());
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON public.payments(status, created_at);

CREATE OR REPLACE FUNCTION public.get_revenue_summary()
RETURNS TABLE (period text, total_amount numeric, payment_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_profile_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN QUERY
  SELECT to_char(completed_at, 'YYYY-MM-DD'), SUM(amount), count(*)
  FROM public.payments
  WHERE status = 'completed' AND completed_at > now() - interval '30 days'
  GROUP BY to_char(completed_at, 'YYYY-MM-DD')
  ORDER BY 1 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_revenue_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_revenue_summary() TO authenticated;
