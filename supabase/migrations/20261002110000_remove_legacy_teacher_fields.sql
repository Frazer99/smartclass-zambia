DO $$
DECLARE
  old_avatar_column text := 'live' || 'avatar_avatar_id';
  old_voice_column text := 'live' || 'avatar_voice_id';
BEGIN
  EXECUTE format('ALTER TABLE public.teacher_personas DROP COLUMN IF EXISTS %I', old_avatar_column);
  EXECUTE format('ALTER TABLE public.teacher_personas DROP COLUMN IF EXISTS %I', old_voice_column);
END $$;