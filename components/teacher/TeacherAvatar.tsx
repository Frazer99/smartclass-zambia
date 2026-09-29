'use client';

/**
 * Illustrated avatar for Mr. Chomba, the SmartClass Zambia AI teacher.
 * Pure SVG (no external image assets), so it stays crisp at any size and
 * costs nothing to load. `state` drives which expression/animation shows,
 * meant to be wired to real signals (TTS playback, the AI request in
 * flight, lesson completion) rather than left static — see the lesson page
 * for how `state` is computed from isSpeaking / isThinking / completed.
 */

export type TeacherAvatarState = 'idle' | 'speaking' | 'thinking' | 'encouraging';

interface TeacherAvatarProps {
  state?: TeacherAvatarState;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** True while the teacher is actively adding a line to the smart board — shown as a small chalk badge, independent of (and often simultaneous with) the speaking state, since a real teacher talks and writes at the same time. */
  writing?: boolean;
  className?: string;
  /**
  * Which named persona this is (Linda, Mrs Tembo, Mr Chomba, Mr
   * Banda, or Chipo — see the teacher_personas table). The illustrated
   * art below was drawn specifically for Mr. Chomba; showing that same
   * male illustration under a different — possibly female — teacher's
   * name would misrepresent who's actually teaching. Any persona other
   * than Mr. Chomba renders a plain initials placeholder instead, honest
   * about not having matching art yet, rather than a wrong illustration.
   * Defaults to 'Mr. Chomba' for every existing call site that predates
   * multi-persona support.
   */
  name?: string;
}

const SIZE_MAP: Record<NonNullable<TeacherAvatarProps['size']>, number> = {
  xs: 28,
  sm: 48,
  md: 64,
  lg: 112,
};

function isChombaPersona(name: string): boolean {
  return name.replace('.', '').trim().toLowerCase() === 'mr chomba';
}

/** Plain, honest stand-in for personas without illustrated art yet —
 *  initials on a flat background, no attempt to imply a specific
 *  appearance the way a real illustration would. */
function PlaceholderAvatar({ name, size, className }: { name: string; size: number; className: string }) {
  const initials = name
    .split(' ')
    .filter((w) => w.length > 0 && w.toLowerCase() !== 'mrs' && w.toLowerCase() !== 'madam' && w.toLowerCase() !== 'mr')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || name[0]?.toUpperCase() || '?';

  return (
    <div
      className={`relative shrink-0 rounded-full border-2 border-chalk/20 bg-board-deep flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name}, your AI teacher`}
    >
      <span className="font-display font-bold text-gold" style={{ fontSize: size * 0.32 }}>
        {initials}
      </span>
    </div>
  );
}

export function TeacherAvatar({ state = 'idle', size = 'md', writing = false, className = '', name = 'Mr. Chomba' }: TeacherAvatarProps) {
  const px = SIZE_MAP[size];

  if (!isChombaPersona(name)) {
    return <PlaceholderAvatar name={name} size={px} className={className} />;
  }

  return (
    <div
      className={`relative shrink-0 rounded-full border-2 border-chalk/20 bg-paper overflow-visible ${className}`}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 100 100"
        width={px}
        height={px}
        className="block rounded-full"
        role="img"
        aria-label={`${name}, your AI teacher (${state})`}
      >
        <defs>
          <clipPath id="chomba-clip">
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>

        <g clipPath="url(#chomba-clip)">
          {/* background */}
          <rect width="100" height="100" fill="#EDE3CE" />
          {/* shoulders / shirt */}
          <path d="M14 100 C14 78 30 68 50 68 C70 68 86 78 86 100 Z" fill="#3E7C6B" />
          <path d="M40 71 L50 82 L60 71 L54 68 L46 68 Z" fill="#2f5f52" />
          {/* collar dot trim, a small nod to chitenge print */}
          <circle cx="41" cy="74" r="1.6" fill="#E8B94B" />
          <circle cx="59" cy="74" r="1.6" fill="#E8B94B" />

          {/* neck */}
          <rect x="43" y="58" width="14" height="16" rx="4" fill="#8B5A34" />

          {/* head */}
          <ellipse cx="50" cy="42" rx="24" ry="26" fill="#9C6B3E" />
          {/* ears */}
          <ellipse cx="25" cy="44" rx="3.2" ry="5" fill="#9C6B3E" />
          <ellipse cx="75" cy="44" rx="3.2" ry="5" fill="#9C6B3E" />

          {/* hair (short, close-cropped) */}
          <path
            d="M25 34 C25 16 34 8 50 8 C66 8 75 16 75 34 C75 26 68 20 50 20 C32 20 25 26 25 34 Z"
            fill="#161311"
          />
          <path d="M25 34 C24 30 25 22 30 17 C27 22 26 29 27 36 Z" fill="#161311" />
          <path d="M75 34 C76 30 75 22 70 17 C73 22 74 29 73 36 Z" fill="#161311" />

          {/* glasses (thin gold frame — reads "teacher" without being a caricature) */}
          <g stroke="#C79A44" strokeWidth="1.6" fill="none">
            <rect x="30" y="38" width="15" height="11" rx="5" />
            <rect x="55" y="38" width="15" height="11" rx="5" />
            <line x1="45" y1="43" x2="55" y2="43" />
          </g>

          {/* eyebrows — swap by state */}
          {state === 'thinking' ? (
            <>
              <path d="M31 34 Q38 30 44 33" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M56 33 Q62 30 69 33.5" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
            </>
          ) : state === 'encouraging' ? (
            <>
              <path d="M31 33 Q38 28.5 44 32" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M56 32 Q62 28.5 69 33" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M31 34.5 Q38 32 44 34" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M56 34 Q62 32 69 34.5" stroke="#161311" strokeWidth="2" fill="none" strokeLinecap="round" />
            </>
          )}

          {/* eyes */}
          {state === 'thinking' ? (
            <>
              <circle cx="37.5" cy="43" r="2.1" fill="#161311" className="chomba-eye-look" />
              <circle cx="62.5" cy="43" r="2.1" fill="#161311" className="chomba-eye-look" />
            </>
          ) : (
            <>
              <circle cx="37.5" cy="43.5" r="2.3" fill="#161311" className="chomba-eye-blink" />
              <circle cx="62.5" cy="43.5" r="2.3" fill="#161311" className="chomba-eye-blink" />
            </>
          )}

          {/* mouth — swap by state */}
          {state === 'speaking' ? (
            <ellipse cx="50" cy="57" rx="6" ry="4" fill="#5c2a1a" className="chomba-mouth-talk" />
          ) : state === 'encouraging' ? (
            <path d="M38 55 Q50 66 62 55 Q50 62 38 55 Z" fill="#5c2a1a" />
          ) : state === 'thinking' ? (
            <path d="M41 58 Q50 58 58 56" stroke="#5c2a1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M40 56 Q50 62 60 56" stroke="#5c2a1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          )}
        </g>
      </svg>

      {/* thinking dots */}
      {state === 'thinking' && (
        <div className="absolute -top-1.5 -right-1 flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gold chomba-dot" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-gold chomba-dot" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-gold chomba-dot" style={{ animationDelay: '300ms' }} />
        </div>
      )}

      {/* speaking indicator */}
      {state === 'speaking' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal border-2 border-board-deep animate-pulse" />
      )}

      {/* encouraging sparkle */}
      {state === 'encouraging' && (
        <span className="absolute -top-1 -right-1 text-gold chomba-sparkle" style={{ fontSize: px * 0.28 }}>
          ✦
        </span>
      )}

      {/* writing-on-the-board badge — independent of expression state */}
      {writing && (
        <span
          className="absolute -bottom-1 -left-1 flex items-center justify-center rounded-full border-2 border-board-deep bg-chalk chomba-write-badge"
          style={{ width: px * 0.34, height: px * 0.34, fontSize: px * 0.18 }}
          title="Writing on the smart board"
        >
          ✎
        </span>
      )}

      <style jsx>{`
        .chomba-mouth-talk {
          transform-origin: 50px 57px;
          animation: chomba-talk 0.42s ease-in-out infinite;
        }
        @keyframes chomba-talk {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.35); }
        }
        .chomba-eye-blink {
          transform-origin: center;
          animation: chomba-blink 4.5s ease-in-out infinite;
        }
        @keyframes chomba-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.1); }
        }
        .chomba-dot {
          animation: chomba-dot-bounce 1s ease-in-out infinite;
        }
        @keyframes chomba-dot-bounce {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
        .chomba-sparkle {
          animation: chomba-twinkle 1.6s ease-in-out infinite;
        }
        @keyframes chomba-twinkle {
          0%, 100% { opacity: 0.5; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.15) rotate(15deg); }
        }
        .chomba-write-badge {
          animation: chomba-write-wiggle 0.6s ease-in-out infinite;
        }
        @keyframes chomba-write-wiggle {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
