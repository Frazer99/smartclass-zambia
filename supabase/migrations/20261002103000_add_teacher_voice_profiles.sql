ALTER TABLE public.teacher_personas
  ADD COLUMN IF NOT EXISTS voice_locale text NOT NULL DEFAULT 'en-ZM',
  ADD COLUMN IF NOT EXISTS voice_accent text NOT NULL DEFAULT 'Zambian English',
  ADD COLUMN IF NOT EXISTS voice_gender text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS voice_tone text NOT NULL DEFAULT 'warm and patient',
  ADD COLUMN IF NOT EXISTS voice_rate numeric(3, 2) NOT NULL DEFAULT 0.95;

UPDATE public.teacher_personas
SET
  voice_gender = CASE WHEN lower(gender) IN ('male', 'female') THEN lower(gender) ELSE 'neutral' END,
  voice_accent = 'Zambian English',
  voice_locale = 'en-ZM',
  voice_tone = CASE
    WHEN name = 'Mr Banda' THEN 'precise and practical'
    WHEN name = 'Chipo' THEN 'warm and precise'
    WHEN name = 'Mrs Tembo' THEN 'enthusiastic and encouraging'
    WHEN name = 'Linda' THEN 'warm and patient'
    ELSE 'patient and methodical'
  END,
  voice_rate = CASE WHEN name = 'Mr Banda' THEN 0.92 ELSE 0.95 END;