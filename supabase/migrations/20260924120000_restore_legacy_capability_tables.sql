-- Restore useful non-school capability tables from the historical backend.
-- The separate schools reference table is intentionally excluded.

CREATE TABLE IF NOT EXISTS public.moderation_flags_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT now(),
  days_to_keep int NOT NULL,
  self_harm_included boolean NOT NULL,
  rows_deleted int NOT NULL,
  severity_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  oldest_deleted_created_at timestamptz,
  newest_deleted_created_at timestamptz
);
ALTER TABLE public.moderation_flags_cleanup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_cleanup_log" ON public.moderation_flags_cleanup_log;
CREATE POLICY "admin_select_cleanup_log" ON public.moderation_flags_cleanup_log FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  target_user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_action_log" ON public.admin_action_log;
CREATE POLICY "admin_select_action_log" ON public.admin_action_log FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_admin_action_log_target ON public.admin_action_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_log_created ON public.admin_action_log(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  related_moderation_flag_id uuid REFERENCES public.moderation_flags(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_warnings" ON public.user_warnings;
CREATE POLICY "select_own_warnings" ON public.user_warnings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_select_all_warnings" ON public.user_warnings;
CREATE POLICY "admin_select_all_warnings" ON public.user_warnings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.account_deletions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  warning_count_at_deletion int NOT NULL DEFAULT 0,
  full_name_snapshot text,
  email_snapshot text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.account_deletions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_deletions_log" ON public.account_deletions_log;
CREATE POLICY "admin_select_deletions_log" ON public.account_deletions_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS public.student_learning_style_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  strategy text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.student_learning_style_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_learning_style_signals" ON public.student_learning_style_signals;
CREATE POLICY "select_own_learning_style_signals" ON public.student_learning_style_signals FOR SELECT TO authenticated USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "admin_select_all_learning_style_signals" ON public.student_learning_style_signals;
CREATE POLICY "admin_select_all_learning_style_signals" ON public.student_learning_style_signals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_learning_style_signals_student ON public.student_learning_style_signals(student_id, strategy);

CREATE TABLE IF NOT EXISTS public.app_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  error_message text NOT NULL,
  error_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.app_error_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_select_error_log" ON public.app_error_log;
CREATE POLICY "admin_select_error_log" ON public.app_error_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "authenticated_insert_error_log" ON public.app_error_log;
CREATE POLICY "authenticated_insert_error_log" ON public.app_error_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_app_error_log_created ON public.app_error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_error_log_source ON public.app_error_log(source, created_at DESC);
