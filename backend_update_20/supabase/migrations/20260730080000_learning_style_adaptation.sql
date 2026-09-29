/*
# SmartClass Zambia — SmartTeach: Learning Style Adaptation

## Purpose
Distinct from (and builds on) the escalating explanation strategies
migration (20260729080000), which is *reactive* — it only changes
approach once a pupil is already confused, cycling through strategies
one at a time. This migration is *proactive*: over time, learn which
kind of explanation tends to actually resolve a given pupil's confusion,
and default to that style from the START of future explanations, before
they've shown any confusion at all — matching the original SmartTeach
design's "SmartTeach should learn the learner's preferred explanation
style over time" section.

Deliberately reuses the same four strategy categories from the
escalation migration (direct, visual, local_example, step_by_step)
rather than inventing a second, competing vocabulary for "learning
style" — a pupil's preference and the escalation sequence are the same
underlying concept (which kind of explanation works for this person),
just applied proactively instead of reactively.

## How "this strategy worked" gets measured
No new signal-collection needed — this reuses the exact confusion
detection already driving escalation. When a pupil stops showing
confusion (topic_explanation_attempts resets to 0) and they *had* an
active escalation with a recorded strategy right before that reset, that
transition itself is the signal: whatever strategy was last used
appears to have helped. Each such transition is logged as one row in
student_learning_style_signals — see the ai-teacher-chat update shipped
alongside this migration for exactly where this gets recorded.

## student_learning_style_signals
One row per resolution event, not an aggregate — keeping the raw signal
means the preference calculation can change later (e.g., weighting
recent signals more heavily) without needing a new migration, and an
admin or future analytics view can see the actual pattern over time, not
just today's snapshot.

## get_preferred_learning_style(student_id)
Returns the strategy with the most resolution signals for that pupil,
but only once there's enough signal to trust it (at least 3 resolved
signals total) — a preference inferred from one lucky topic isn't a
preference yet, and defaulting to it prematurely could actively work
against a pupil whose real pattern hasn't shown itself.

Callable by: the pupil themselves (their own preference, viewable
eventually on their own account page), admins, or the service-role
context (auth.uid() IS NULL) that ai-teacher-chat runs under — the same
three-way check already used in cleanup_old_moderation_flags for a
function called both interactively and from trusted server contexts.

## Security (RLS)
Same shape as topic_explanation_attempts: pupils see only their own
signals, admins see all — a natural companion to school analytics'
"most difficult topics" (which strategies actually help pupils learn is
exactly the kind of thing a school would want visibility into, though
not wired into that UI in this pass).

Idempotent, no destructive operations.
*/

CREATE TABLE IF NOT EXISTS student_learning_style_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  strategy text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_learning_style_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_learning_style_signals" ON student_learning_style_signals;
CREATE POLICY "select_own_learning_style_signals" ON student_learning_style_signals FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "admin_select_all_learning_style_signals" ON student_learning_style_signals;
CREATE POLICY "admin_select_all_learning_style_signals" ON student_learning_style_signals FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_learning_style_signals_student ON student_learning_style_signals(student_id, strategy);

CREATE OR REPLACE FUNCTION get_preferred_learning_style(p_student_id uuid)
RETURNS TABLE (strategy text, signal_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_is_self boolean;
  v_is_scheduled_context boolean;
  v_total_signals bigint;
BEGIN
  v_is_admin := EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
  v_is_self := auth.uid() = p_student_id;
  v_is_scheduled_context := auth.uid() IS NULL;

  IF NOT v_is_admin AND NOT v_is_self AND NOT v_is_scheduled_context THEN
    RAISE EXCEPTION 'Not authorized to view this learning style';
  END IF;

  SELECT count(*) INTO v_total_signals
  FROM student_learning_style_signals WHERE student_id = p_student_id;

  -- Not enough signal to trust a preference yet — a pattern from one or
  -- two resolved topics isn't a real preference, and defaulting to it
  -- too early could actively work against a pupil whose real style
  -- hasn't shown itself. Returns no rows, not an error; the caller
  -- (ai-teacher-chat) treats an empty result as "no strong preference
  -- yet" and proceeds without a style instruction.
  IF v_total_signals < 3 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.strategy, count(*) AS signal_count
  FROM student_learning_style_signals s
  WHERE s.student_id = p_student_id
  GROUP BY s.strategy
  ORDER BY signal_count DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_preferred_learning_style TO authenticated, service_role;
