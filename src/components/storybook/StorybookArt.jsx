/**
 * Hand-crafted inline SVG illustrations for the "Hành trình đến VSTEP" storybook theme.
 * Original character: Cáo nhỏ lữ khách (a small terracotta fox traveler with a forest backpack).
 * Decorative artwork uses aria-hidden="true" and pointer-events-none so interactions stay clear.
 */

function FoxBody({ scale = 1 }) {
  return (
    <g transform={`scale(${scale})`}>
      {/* Ground shadow */}
      <ellipse cx="0" cy="24" rx="18" ry="4.5" fill="#2b2a33" opacity="0.16" />

      {/* Fluffy tail with cream tip */}
      <path
        d="M -9 14 C -24 14, -30 2, -21 -6 C -15 -10, -10 -1, -8 8 Z"
        fill="#d9603b"
        stroke="#2b2a33"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M -21 -6 C -17 -9, -13 -5, -14 0 C -19 1, -24 -1, -21 -6 Z"
        fill="#fbf7ee"
        stroke="#2b2a33"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Forest green traveler backpack */}
      <rect
        x="-14"
        y="-4"
        width="13"
        height="17"
        rx="5"
        fill="#3f7d58"
        stroke="#2b2a33"
        strokeWidth="2"
      />
      <path d="M -13 2 L -2 2" stroke="#2b2a33" strokeWidth="1.6" />
      <rect x="-11" y="5" width="7" height="5" rx="2" fill="#e0a82e" stroke="#2b2a33" strokeWidth="1.4" />

      {/* Little boots */}
      <rect x="-7" y="16" width="5.5" height="6" rx="2.5" fill="#2b2a33" />
      <rect x="2" y="16" width="5.5" height="6" rx="2.5" fill="#2b2a33" />

      {/* Torso & cream chest */}
      <path
        d="M -8 17 C -9 6, -7 -1, 0 -1 C 7 -1, 9 6, 8 17 Z"
        fill="#d9603b"
        stroke="#2b2a33"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M -3 1 C -4 8, -3 15, 0 16 C 3 15, 4 8, 3 1 Z" fill="#fbf7ee" />

      {/* Ochre traveler scarf */}
      <path
        d="M -8 -2 C -3 2, 4 2, 9 -2 L 7 3 C 3 6, -3 6, -7 3 Z"
        fill="#e0a82e"
        stroke="#2b2a33"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M 4 2 L 9 9 L 4 10 L 1 4 Z"
        fill="#e0a82e"
        stroke="#2b2a33"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Rolled map & walking stick in right paw */}
      <line x1="12" y1="-10" x2="11" y2="22" stroke="#5c3d22" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="-11" r="2.6" fill="#e0a82e" stroke="#2b2a33" strokeWidth="1.6" />
      <path d="M 5 7 L 12 6" stroke="#d9603b" strokeWidth="3.2" strokeLinecap="round" />

      {/* Fox head & pointed ears */}
      <path
        d="M -10 -15 L -13 -28 L -3 -20 Z"
        fill="#d9603b"
        stroke="#2b2a33"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M -10.5 -18 L -11.5 -24.5 L -6 -20.5 Z" fill="#2b2a33" />
      <path
        d="M 10 -15 L 13 -28 L 3 -20 Z"
        fill="#d9603b"
        stroke="#2b2a33"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M 10.5 -18 L 11.5 -24.5 L 6 -20.5 Z" fill="#2b2a33" />

      <ellipse cx="0" cy="-11" rx="13" ry="10.5" fill="#d9603b" stroke="#2b2a33" strokeWidth="2" />
      {/* Cream cheeks */}
      <path
        d="M -12 -9 C -8 -10, -4 -7, 0 -5 C 4 -7, 8 -10, 12 -9 C 10 -2, 5 -0.5, 0 -0.5 C -5 -0.5, -10 -2, -12 -9 Z"
        fill="#fbf7ee"
      />
      {/* Eyes, nose & smile */}
      <circle cx="-4.8" cy="-12" r="1.7" fill="#2b2a33" />
      <circle cx="4.8" cy="-12" r="1.7" fill="#2b2a33" />
      <circle cx="-5.3" cy="-12.6" r="0.55" fill="#ffffff" />
      <circle cx="4.3" cy="-12.6" r="0.55" fill="#ffffff" />
      <ellipse cx="0" cy="-8.2" rx="2.1" ry="1.5" fill="#2b2a33" />
      <path d="M -2.5 -5.8 Q 0 -4 2.5 -5.8" fill="none" stroke="#2b2a33" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

export function CompassBadge({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={`${className} shrink-0 pointer-events-none select-none`}
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="15" fill="#fbf7ee" stroke="#2b2a33" strokeWidth="2.2" />
      <circle cx="18" cy="18" r="11" fill="none" stroke="#2b2a33" strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
      <polygon points="18,6 21.5,18 18,15.5 14.5,18" fill="#d9603b" stroke="#2b2a33" strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points="18,30 21.5,18 18,20.5 14.5,18" fill="#3a8fb7" stroke="#2b2a33" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="2.2" fill="#e0a82e" stroke="#2b2a33" strokeWidth="1.4" />
    </svg>
  );
}

export function EmptyTrailScene({ className = 'w-56 h-36' }) {
  return (
    <svg
      viewBox="0 0 260 156"
      className={`${className} mx-auto pointer-events-none select-none`}
      aria-hidden="true"
    >
      {/* Distant hills & sky wash */}
      <path d="M 10 124 Q 70 86 140 112 T 250 118 L 250 148 L 10 148 Z" fill="#ddeee2" />
      <path d="M 18 134 Q 115 112 242 136" fill="none" stroke="#2b2a33" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" opacity="0.55" />

      {/* Soft clouds */}
      <path d="M 38 40 Q 45 28 58 32 Q 66 24 76 32 Q 86 33 84 42 Z" fill="#fffdf8" stroke="#2b2a33" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 176 34 Q 182 24 193 27 Q 202 22 208 30 Q 216 32 213 38 Z" fill="#fffdf8" stroke="#2b2a33" strokeWidth="1.6" strokeLinejoin="round" />

      {/* Wooden signpost */}
      <line x1="184" y1="60" x2="184" y2="128" stroke="#5c3d22" strokeWidth="4" strokeLinecap="round" />
      <path d="M 164 68 L 210 68 L 218 75 L 210 82 L 164 82 Z" fill="#e0a82e" stroke="#2b2a33" strokeWidth="2" strokeLinejoin="round" />
      <path d="M 172 88 L 204 88 L 204 100 L 172 100 L 164 94 Z" fill="#fbf7ee" stroke="#2b2a33" strokeWidth="2" strokeLinejoin="round" />

      {/* Little pine trees */}
      <polygon points="44,116 55,88 66,116" fill="#3f7d58" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="55" y1="116" x2="55" y2="124" stroke="#5c3d22" strokeWidth="2.5" strokeLinecap="round" />
      <polygon points="222,118 231,96 240,118" fill="#3f7d58" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="231" y1="118" x2="231" y2="125" stroke="#5c3d22" strokeWidth="2.5" strokeLinecap="round" />

      {/* Fox traveler waiting at the trailhead */}
      <g transform="translate(116, 102)">
        <FoxBody scale={1.18} />
      </g>
    </svg>
  );
}

const STAGES = [
  { level: 1, x: 108, y: 196, color: '#c8434e', soft: '#f9dfe1', title: 'Trại khởi hành' },
  { level: 2, x: 274, y: 146, color: '#d97736', soft: '#fae8d8', title: 'Đồi làm quen' },
  { level: 3, x: 444, y: 184, color: '#e0a82e', soft: '#f8ecd0', title: 'Rừng đang học' },
  { level: 4, x: 614, y: 126, color: '#216e6e', soft: '#d9f0ef', title: 'Cầu thành thạo' },
  { level: 5, x: 774, y: 92,  color: '#3f7d58', soft: '#ddeee2', title: 'Đỉnh tinh thông' },
];

export function JourneyMapSvg({ levelCounts, foxLevel = 1 }) {
  const activeStage = STAGES.find(s => s.level === foxLevel) || STAGES[0];
  const foxOffsetX = foxLevel === 5 ? -44 : 42;
  const foxOffsetY = foxLevel === 5 ? -8 : -16;

  return (
    <svg
      viewBox="0 0 880 280"
      role="img"
      aria-label="Bản đồ hành trình 5 chặng từ vựng L1 đến L5"
      className="w-full h-auto block select-none pointer-events-none"
    >
      {/* Parchment background & subtle hand-drawn border */}
      <rect x="0" y="0" width="880" height="280" rx="18" fill="#fbf7ee" />
      <rect x="8" y="8" width="864" height="264" rx="14" fill="none" stroke="#2b2a33" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.22" />

      {/* Watercolor landscape layers */}
      <path d="M 0 186 Q 150 112 310 156 T 620 132 T 880 118 L 880 280 L 0 280 Z" fill="#efe4cf" opacity="0.7" />
      <path d="M 0 218 Q 210 166 430 202 T 880 170 L 880 280 L 0 280 Z" fill="#ddeee2" opacity="0.85" />
      <path d="M 555 245 Q 685 214 880 232 L 880 280 L 520 280 Z" fill="#dceef6" opacity="0.75" />

      {/* Decorative clouds */}
      <path d="M 155 54 Q 164 40 180 45 Q 190 36 202 46 Q 214 48 210 58 Z" fill="#fffdf8" stroke="#2b2a33" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 505 46 Q 512 35 526 39 Q 535 31 546 40 Q 556 42 553 50 Z" fill="#fffdf8" stroke="#2b2a33" strokeWidth="1.6" strokeLinejoin="round" />

      {/* Distant landmarks: Listening lighthouse & Grammar tower */}
      <g opacity="0.78">
        <path d="M 656 122 L 664 82 L 672 82 L 680 122 Z" fill="#fbf7ee" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="662" y="72" width="12" height="10" fill="#e0a82e" stroke="#2b2a33" strokeWidth="1.6" />
        <polygon points="660,72 668,63 676,72" fill="#d9603b" stroke="#2b2a33" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <g opacity="0.75">
        <rect x="352" y="108" width="20" height="32" rx="2" fill="#ede1f2" stroke="#2b2a33" strokeWidth="1.8" />
        <polygon points="349,108 362,92 375,108" fill="#7a4e8c" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
      </g>

      {/* Pine trees scattered along the hills */}
      {[
        [52, 184, 1],
        [208, 136, 0.85],
        [394, 174, 0.9],
        [536, 152, 0.95],
        [832, 144, 0.9],
      ].map(([tx, ty, sc], idx) => (
        <g key={idx} transform={`translate(${tx}, ${ty}) scale(${sc})`}>
          <polygon points="-10,0 0,-26 10,0" fill="#3f7d58" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#5c3d22" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      ))}

      {/* Compass rose in top-left */}
      <g transform="translate(26, 22)">
        <circle cx="20" cy="20" r="16" fill="#fbf7ee" stroke="#2b2a33" strokeWidth="1.8" />
        <polygon points="20,7 23,20 20,17.5 17,20" fill="#d9603b" stroke="#2b2a33" strokeWidth="1.2" />
        <polygon points="20,33 23,20 20,22.5 17,20" fill="#3a8fb7" stroke="#2b2a33" strokeWidth="1.2" />
        <circle cx="20" cy="20" r="2" fill="#e0a82e" stroke="#2b2a33" strokeWidth="1.2" />
        <text x="20" y="47" textAnchor="middle" fontSize="9" fontWeight="800" fill="#383542">VSTEP</text>
      </g>

      {/* Winding journey trail */}
      <path
        d="M 108 196 C 175 182, 210 152, 274 146 C 340 140, 382 190, 444 184 C 510 178, 550 134, 614 126 C 680 118, 725 98, 774 92"
        fill="none"
        stroke="#e6d6b8"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M 108 196 C 175 182, 210 152, 274 146 C 340 140, 382 190, 444 184 C 510 178, 550 134, 614 126 C 680 118, 725 98, 774 92"
        fill="none"
        stroke="#2b2a33"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        strokeLinecap="round"
        opacity="0.72"
      />

      {/* Summit flag at L5 */}
      <g transform="translate(794, 44)">
        <line x1="0" y1="0" x2="0" y2="36" stroke="#2b2a33" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M 0 2 L 26 9 L 0 17 Z" fill="#d9603b" stroke="#2b2a33" strokeWidth="1.8" strokeLinejoin="round" />
      </g>

      {/* 5 Stage Milestones */}
      {STAGES.map(({ level, x, y, color, soft, title }) => {
        const count = levelCounts[level] ?? 0;
        const isCurrent = level === foxLevel;
        return (
          <g key={level} transform={`translate(${x}, ${y})`}>
            {isCurrent && (
              <circle cx="0" cy="0" r="25" fill="none" stroke={color} strokeWidth="2.4" strokeDasharray="4 3" />
            )}
            <circle cx="2" cy="2" r="19" fill="#2b2a33" />
            <circle cx="0" cy="0" r="19" fill={soft} stroke="#2b2a33" strokeWidth="2.2" />
            <circle cx="0" cy="0" r="13.5" fill={color} stroke="#2b2a33" strokeWidth="1.6" />
            <text x="0" y="4.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff">
              L{level}
            </text>

            {/* Stage name pill */}
            <rect x="-46" y="25" width="92" height="20" rx="8" fill="#fbf7ee" stroke="#2b2a33" strokeWidth="1.6" />
            <text x="0" y="38.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#17161d">
              {title}
            </text>

            {/* Word count badge */}
            <rect x="-26" y="48" width="52" height="17" rx="8.5" fill={soft} stroke="#2b2a33" strokeWidth="1.4" />
            <text x="0" y="59.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#17161d">
              {count} từ
            </text>
          </g>
        );
      })}

      {/* Fox traveler standing beside the active milestone */}
      <g transform={`translate(${activeStage.x + foxOffsetX}, ${activeStage.y + foxOffsetY})`}>
        <FoxBody scale={1.06} />
      </g>
    </svg>
  );
}
