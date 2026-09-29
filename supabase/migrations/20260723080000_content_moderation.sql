CREATE TABLE IF NOT EXISTS moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid,
  message text NOT NULL,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'other',
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_moderation_flags" ON moderation_flags;
CREATE POLICY "admin_select_moderation_flags" ON moderation_flags FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "admin_update_moderation_flags" ON moderation_flags;
CREATE POLICY "admin_update_moderation_flags" ON moderation_flags FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_moderation_flags_created ON moderation_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_unreviewed ON moderation_flags(reviewed) WHERE reviewed = false;
CREATE INDEX IF NOT EXISTS idx_moderation_flags_severity ON moderation_flags(severity) WHERE severity = 'self_harm';
