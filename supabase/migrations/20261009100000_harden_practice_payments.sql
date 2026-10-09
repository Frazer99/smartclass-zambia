/* Harden practice scoring, uploaded-test usage, and payment idempotency. */

DROP POLICY IF EXISTS "read_practice_questions" ON public.practice_questions;
REVOKE SELECT ON public.practice_questions FROM anon, authenticated;

CREATE OR REPLACE VIEW public.practice_questions_public AS
SELECT id, topic_id, question_text, question_type, options, explanation, difficulty
FROM public.practice_questions;

GRANT SELECT ON public.practice_questions_public TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.submit_practice_answer(
  p_question_id uuid,
  p_submitted_answer text
)
RETURNS TABLE (
  is_correct boolean,
  correct_answer text,
  explanation text,
  topic_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_row public.practice_questions%ROWTYPE;
  question_subject_id uuid;
  normalized_submitted text;
  normalized_answer text;
  attempt_count integer;
  correct_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_submitted_answer IS NULL OR length(trim(p_submitted_answer)) = 0 THEN
    RAISE EXCEPTION 'An answer is required';
  END IF;

  SELECT pq.* INTO question_row
  FROM public.practice_questions pq
  WHERE pq.id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
  SELECT t.subject_id INTO question_subject_id
  FROM public.topics t
  WHERE t.id = question_row.topic_id;

  normalized_submitted := lower(regexp_replace(trim(p_submitted_answer), '\s+', ' ', 'g'));
  normalized_answer := lower(regexp_replace(trim(question_row.answer_key), '\s+', ' ', 'g'));

  INSERT INTO public.practice_attempts (user_id, question_id, submitted_answer, is_correct)
  VALUES (auth.uid(), p_question_id, p_submitted_answer, normalized_submitted = normalized_answer);

  INSERT INTO public.student_interactions (
    student_id, subject_id, topic_id, interaction_type, question,
    student_response, ai_response, correct, difficulty
  ) VALUES (
    auth.uid(), question_subject_id, question_row.topic_id, 'practice_question',
    question_row.question_text, p_submitted_answer, question_row.explanation,
    normalized_submitted = normalized_answer, question_row.difficulty
  );

  PERFORM public.recompute_topic_mastery(auth.uid(), question_row.topic_id);

  SELECT count(*)::integer, count(*) FILTER (WHERE pa.is_correct)::integer
  INTO attempt_count, correct_count
  FROM public.practice_attempts pa
  JOIN public.practice_questions pq ON pq.id = pa.question_id
  WHERE pa.user_id = auth.uid() AND pq.topic_id = question_row.topic_id;

  INSERT INTO public.progress_records (
    user_id, topic_id, mastery_percentage, total_attempts, correct_attempts, last_updated
  ) VALUES (
    auth.uid(), question_row.topic_id,
    round((correct_count::numeric / nullif(attempt_count, 0)) * 100),
    attempt_count, correct_count, now()
  )
  ON CONFLICT (user_id, topic_id) DO UPDATE SET
    mastery_percentage = EXCLUDED.mastery_percentage,
    total_attempts = EXCLUDED.total_attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    last_updated = EXCLUDED.last_updated;

  RETURN QUERY SELECT
    normalized_submitted = normalized_answer,
    question_row.answer_key,
    question_row.explanation,
    question_row.topic_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_practice_answer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_practice_answer(uuid, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.uploaded_test_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  request_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.uploaded_test_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.uploaded_test_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_uploaded_test_rate_limit(
  p_user_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz := date_trunc('hour', now());
  stored_window timestamptz;
  current_count integer;
BEGIN
  INSERT INTO public.uploaded_test_rate_limits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT request_count, window_start INTO current_count, stored_window
  FROM public.uploaded_test_rate_limits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF stored_window < current_window THEN
    UPDATE public.uploaded_test_rate_limits
    SET window_start = current_window, request_count = 0
    WHERE user_id = p_user_id;
    current_count := 0;
  END IF;

  IF current_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.uploaded_test_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_uploaded_test_rate_limit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_uploaded_test_rate_limit(uuid, integer) TO service_role;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_token_unique
  ON public.payments(provider_token) WHERE provider_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_subject
  ON public.subscriptions(user_id, subject_id) WHERE status = 'active' AND subject_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
