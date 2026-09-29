CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_window timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  minute_count integer NOT NULL DEFAULT 0,
  hour_window timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  hour_count integer NOT NULL DEFAULT 0,
  day_window date NOT NULL DEFAULT current_date,
  day_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_rate_limits
  ADD COLUMN IF NOT EXISTS day_window date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS day_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.consume_ai_rate_limit(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.consume_ai_rate_limit(
  p_user_id uuid,
  p_minute_limit integer DEFAULT 8,
  p_hour_limit integer DEFAULT 60,
  p_day_limit integer DEFAULT 15
)
RETURNS TABLE (allowed boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_time timestamptz := now();
  current_minute timestamptz := date_trunc('minute', request_time);
  current_hour timestamptz := date_trunc('hour', request_time);
  current_day date := (request_time AT TIME ZONE 'Africa/Lusaka')::date;
  current_minute_count integer;
  current_hour_count integer;
  current_day_count integer;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT minute_count, hour_count, day_count
  INTO current_minute_count, current_hour_count, current_day_count
  FROM public.ai_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  UPDATE public.ai_rate_limits
  SET minute_window = current_minute,
      minute_count = CASE WHEN minute_window < current_minute THEN 0 ELSE minute_count END,
      hour_window = current_hour,
      hour_count = CASE WHEN hour_window < current_hour THEN 0 ELSE hour_count END,
      day_window = current_day,
      day_count = CASE WHEN day_window < current_day THEN 0 ELSE day_count END
  WHERE user_id = p_user_id;

  SELECT minute_count, hour_count, day_count
  INTO current_minute_count, current_hour_count, current_day_count
  FROM public.ai_rate_limits
  WHERE user_id = p_user_id;

  IF current_minute_count >= p_minute_limit THEN
    RETURN QUERY SELECT false, 'minute';
    RETURN;
  END IF;
  IF current_hour_count >= p_hour_limit THEN
    RETURN QUERY SELECT false, 'hour';
    RETURN;
  END IF;
  IF current_day_count >= p_day_limit THEN
    RETURN QUERY SELECT false, 'day';
    RETURN;
  END IF;

  UPDATE public.ai_rate_limits
  SET minute_count = minute_count + 1,
      hour_count = hour_count + 1,
      day_count = day_count + 1
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT true, 'allowed';
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_rate_limit(uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_rate_limit(uuid, integer, integer, integer) TO service_role;