CREATE OR REPLACE FUNCTION recompute_topic_mastery(p_student_id uuid, p_topic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts int;
  v_correct int;
  v_score numeric(5,2);
  v_confidence text;
  v_status text;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE correct)
  INTO v_attempts, v_correct
  FROM student_interactions
  WHERE student_id = p_student_id AND topic_id = p_topic_id AND correct IS NOT NULL;

  IF v_attempts = 0 THEN RETURN; END IF;

  v_score := ROUND((v_correct::numeric / v_attempts) * 100, 2);
  v_confidence := CASE WHEN v_attempts >= 10 THEN 'high' WHEN v_attempts >= 4 THEN 'medium' ELSE 'low' END;
  v_status := CASE WHEN v_score >= 90 THEN 'mastered' WHEN v_score >= 80 THEN 'proficient' WHEN v_score >= 60 THEN 'good_progress' WHEN v_score >= 40 THEN 'developing' ELSE 'needs_support' END;

  INSERT INTO student_topic_mastery (student_id, topic_id, mastery_score, attempts, correct_attempts, last_attempt, confidence, status)
  VALUES (p_student_id, p_topic_id, v_score, v_attempts, v_correct, now(), v_confidence, v_status)
  ON CONFLICT (student_id, topic_id) DO UPDATE SET
    mastery_score = EXCLUDED.mastery_score, attempts = EXCLUDED.attempts,
    correct_attempts = EXCLUDED.correct_attempts, last_attempt = EXCLUDED.last_attempt,
    confidence = EXCLUDED.confidence, status = EXCLUDED.status;
END;
$$;

GRANT EXECUTE ON FUNCTION recompute_topic_mastery TO authenticated, service_role;