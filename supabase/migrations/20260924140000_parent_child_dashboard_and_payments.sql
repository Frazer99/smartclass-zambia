-- Parent dashboard access is mediated by the existing parent_child_links relationship.
-- Child-owned tables remain private to the child; these RPCs expose only dashboard data.

CREATE OR REPLACE FUNCTION public.get_parent_child_activity(p_child_id uuid)
RETURNS TABLE (
  lesson_sessions bigint,
  completed_lessons bigint,
  active_days bigint,
  last_attended timestamptz,
  practice_attempts bigint,
  practice_correct bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s activity';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.lesson_sessions WHERE user_id = p_child_id),
    (SELECT count(*) FROM public.lesson_sessions WHERE user_id = p_child_id AND status = 'completed'),
    (SELECT count(DISTINCT started_at::date) FROM public.lesson_sessions WHERE user_id = p_child_id),
    (SELECT max(COALESCE(completed_at, started_at)) FROM public.lesson_sessions WHERE user_id = p_child_id),
    (SELECT count(*) FROM public.practice_attempts WHERE user_id = p_child_id),
    (SELECT count(*) FROM public.practice_attempts WHERE user_id = p_child_id AND is_correct);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parent_child_activity(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_child_results(p_child_id uuid)
RETURNS TABLE (
  result_id uuid,
  result_type text,
  title text,
  subject_name text,
  topic_name text,
  submitted_answer text,
  is_correct boolean,
  occurred_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s results';
  END IF;

  RETURN QUERY
  SELECT pa.id, 'practice'::text, 'Practice task'::text, s.name, t.name,
    pa.submitted_answer, pa.is_correct, pa.created_at
  FROM public.practice_attempts pa
  JOIN public.practice_questions q ON q.id = pa.question_id
  JOIN public.topics t ON t.id = q.topic_id
  JOIN public.subjects s ON s.id = t.subject_id
  WHERE pa.user_id = p_child_id
  UNION ALL
  SELECT ppa.id, 'past_paper'::text, pp.title, s.name, NULL::text,
    ppa.submitted_answer, ppa.is_correct, ppa.created_at
  FROM public.past_paper_attempts ppa
  JOIN public.past_paper_questions ppq ON ppq.id = ppa.question_id
  JOIN public.past_papers pp ON pp.id = ppq.past_paper_id
  JOIN public.subjects s ON s.id = pp.subject_id
  WHERE ppa.user_id = p_child_id
  ORDER BY occurred_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parent_child_results(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_child_billing(p_child_id uuid)
RETURNS TABLE (
  record_type text,
  status text,
  amount numeric,
  currency text,
  plan_type text,
  payment_method text,
  provider text,
  reference text,
  started_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s billing';
  END IF;

  RETURN QUERY
  SELECT 'subscription'::text, s.status, s.amount_paid, s.currency, s.plan_type,
    NULL::text, NULL::text, NULL::text, s.started_at, s.expires_at, NULL::timestamptz
  FROM public.subscriptions s WHERE s.user_id = p_child_id
  UNION ALL
  SELECT 'payment'::text, p.status, p.amount, p.currency, NULL::text,
    p.payment_method, p.provider, COALESCE(p.provider_ref, p.company_ref),
    p.created_at, NULL::timestamptz, p.completed_at
  FROM public.payments p WHERE p.user_id = p_child_id
  ORDER BY started_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parent_child_billing(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_pending_payment(p_child_id uuid)
RETURNS TABLE (provider_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.parent_child_links WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s payment';
  END IF;
  RETURN QUERY
  SELECT p.provider_token
  FROM public.payments p
  WHERE p.user_id = p_child_id AND p.status = 'pending'
  ORDER BY p.created_at DESC
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_parent_pending_payment(uuid) TO authenticated;
