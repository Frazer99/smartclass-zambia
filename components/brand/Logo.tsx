/**
 * SmartClass Zambia brand mark: an open book (gold + chalk pages) with a
 * rising spark above it — education grounded in something real, with an
 * AI spark on top. The spark reuses the exact 4-point shape Mr. Chomba's
 * avatar shows in its "encouraging" state (components/teacher/TeacherAvatar.tsx),
 * so the mark and the AI teacher's own expressions read as the same
 * hand-drawn chalk language rather than two unrelated design systems.
 *
 * `LogoMark` is the icon alone (nav bar, favicon-style spots).
 * `Wordmark` is the full icon + "SmartClass Zambia" lockup used on
 * auth screens and the landing page.
 */

const SIZES = {
  sm: { icon: 28, text: 'text-lg', gap: 'gap-1.5' },
  md: { icon: 36, text: 'text-xl', gap: 'gap-2' },
  lg: { icon: 44, text: 'text-2xl', gap: 'gap-2.5' },
  hero: { icon: 60, text: 'text-4xl sm:text-5xl', gap: 'gap-3' },
} as const;

export type LogoSize = keyof typeof SIZES;

export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="SmartClass Zambia"
    >
      <rect x="2" y="2" width="44" height="44" rx="13" fill="#0F2620" stroke="#E8B94B" strokeWidth="2" />
      <path d="M24 30 C17 26 11 27 8 31 L8 20 C11 16 17 15 24 19 Z" fill="#E8B94B" />
      <path d="M24 30 C31 26 37 27 40 31 L40 20 C37 16 31 15 24 19 Z" fill="#F6F3EA" />
      <line x1="24" y1="19" x2="24" y2="30" stroke="#0F2620" strokeWidth="1.2" />
      <path d="M24 2 L26 7 L31 9 L26 11 L24 16 L22 11 L17 9 L22 7 Z" fill="#E8B94B" />
    </svg>
  );
}

export function Wordmark({ size = 'md', className = '' }: { size?: LogoSize; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <LogoMark size={s.icon} className="shrink-0" />
      <div className={`flex items-baseline gap-1.5 font-display ${s.text}`}>
        <span className="font-semibold text-gold">SmartClass</span>
        <span className="font-normal text-chalk">Zambia</span>
      </div>
    </div>
  );
}
