// Pupil's preferred explanation mode: a full "video teacher" experience
// (Mr. Chomba's avatar + voice + smart board) or a quiet text-only
// explanation (same underlying AI response, just rendered as plain text,
// no avatar/TTS). Persisted locally since it's a device/session
// preference, not account data — promote to a `profiles` column later if
// it should sync across devices.

export type TeachingMode = 'video' | 'text';

const KEY = 'smartclass_teaching_mode';

export function loadTeachingMode(): TeachingMode {
  if (typeof window === 'undefined') return 'video';
  const raw = window.localStorage.getItem(KEY);
  return raw === 'text' ? 'text' : 'video';
}

export function saveTeachingMode(mode: TeachingMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, mode);
}
