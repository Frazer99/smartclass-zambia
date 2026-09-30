/* Scope paid subscriptions and payment attempts to one subject. */

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_subject_status
  ON public.subscriptions(user_id, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_user_subject_created
  ON public.payments(user_id, subject_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid, p_subject_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  platform_free boolean;
BEGIN
  SELECT (value #>> '{}')::boolean INTO platform_free
  FROM public.platform_settings
  WHERE key = 'is_platform_free';

  IF COALESCE(platform_free, false) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND (subject_id = p_subject_id OR (is_bonus_grant AND subject_id IS NULL))
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, uuid)
  TO authenticated, service_role;
