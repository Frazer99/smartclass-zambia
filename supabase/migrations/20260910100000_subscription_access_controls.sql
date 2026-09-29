/* Admin-controlled global free mode and per-pupil bonus access. */

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_platform_settings" ON public.platform_settings;
CREATE POLICY "read_platform_settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_write_platform_settings" ON public.platform_settings;
CREATE POLICY "admin_write_platform_settings" ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_admin_profile_user())
  WITH CHECK (public.is_admin_profile_user());

INSERT INTO public.platform_settings (key, value) VALUES
  ('is_platform_free', 'false'::jsonb),
  ('free_daily_message_limit', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  plan_type text NOT NULL DEFAULT 'monthly',
  is_bonus_grant boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscriptions;
CREATE POLICY "select_own_subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_select_all_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_select_all_subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_admin_profile_user());
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  platform_free boolean;
BEGIN
  SELECT (value #>> '{}')::boolean INTO platform_free
  FROM public.platform_settings WHERE key = 'is_platform_free';
  IF COALESCE(platform_free, false) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_platform_free_mode(p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_profile_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('is_platform_free', to_jsonb(p_enabled), now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_platform_free_mode(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_bonus_subscription(p_user_id uuid, p_days integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_profile_user() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  INSERT INTO public.subscriptions (user_id, status, plan_type, is_bonus_grant, granted_by, expires_at)
  VALUES (p_user_id, 'active', 'bonus', true, auth.uid(),
    CASE WHEN p_days IS NULL THEN NULL ELSE now() + make_interval(days => p_days) END);
END;
$$;
GRANT EXECUTE ON FUNCTION public.grant_bonus_subscription(uuid, integer) TO authenticated;
