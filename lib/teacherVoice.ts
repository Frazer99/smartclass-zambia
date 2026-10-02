export type TeacherVoiceProfile = {
  name: string;
  locale: string;
  accent: string;
  gender: 'male' | 'female' | 'neutral';
  tone: string;
  rate: number;
};

export const DEFAULT_TEACHER_VOICE: TeacherVoiceProfile = {
  name: 'Mr. Chomba',
  locale: 'en-ZM',
  accent: 'Zambian English',
  gender: 'male',
  tone: 'patient and methodical',
  rate: 0.95,
};

export function voiceProfileForPersona(
  name: string,
  gender?: string | null,
  profile?: Partial<Omit<TeacherVoiceProfile, 'name'>>,
): TeacherVoiceProfile {
  const normalizedName = name.replace('.', '').trim().toLowerCase();
  const tone = normalizedName === 'mr banda'
    ? 'precise and practical'
    : normalizedName === 'chipo'
      ? 'warm and precise'
      : normalizedName === 'mrs tembo'
        ? 'enthusiastic and encouraging'
        : normalizedName === 'linda'
          ? 'warm and patient'
          : 'patient and methodical';

  return {
    name,
    locale: profile?.locale || 'en-ZM',
    accent: profile?.accent || 'Zambian English',
    gender: profile?.gender || (gender === 'female' || gender === 'male' ? gender : 'neutral'),
    tone: profile?.tone || tone,
    rate: profile?.rate || (normalizedName === 'mr banda' ? 0.92 : 0.95),
  };
}

export function selectBrowserVoice(
  voices: SpeechSynthesisVoice[],
  profile: TeacherVoiceProfile,
): SpeechSynthesisVoice | undefined {
  const locale = profile.locale.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === locale)
    || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-gb'))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-'));
}