// components/showcase/v2/CoverArt.tsx
// The home page's band between sections: water that keeps moving, and every few seconds the hook drops on its line,
// catches a green fish and pulls it up (keyframes v2-wave-*, v2-hook-drop, v2-fish in app/landing.css). Flat shapes only.
// Reduced motion: the still scene, hook above the water, fish below.

/** A wave across the band and one period beyond it, so sliding it by one period loops without a seam. */
function wave(y: number, amp: number, period = 200, from = -400, to = 1700) {
  let d = `M ${from} ${y} q ${period / 4} ${-amp} ${period / 2} 0`;
  for (let x = from + period / 2; x < to; x += period / 2) d += ` t ${period / 2} 0`;
  return d + ` V 340 H ${from} Z`;
}

export function CoverArt() {
  return (
    <svg viewBox="0 0 1300 340" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="1300" height="340" fill="var(--paper-2)" />
      {/* the far wave, then the near water, drifting the other way */}
      <path className="v2-wave-back" d={wave(196, 16, 260)} fill="#cfe2d5" />
      <path className="v2-wave-front" d={wave(214, 12, 200)} fill="var(--ink)" />

      {/* the fish waiting under the hook */}
      <g className="v2-fish">
        <g transform="translate(902 280)">
          <ellipse cx="0" cy="0" rx="30" ry="14" fill="var(--spot)" />
          <path d="M 26 0 L 48 -14 L 44 0 L 48 14 Z" fill="var(--spot)" />
          <circle cx="-16" cy="-3" r="3" fill="var(--ink)" />
        </g>
      </g>

      {/* the hook on its line */}
      <g className="v2-hook-drop" fill="none" stroke="var(--spot)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 940 -300 V 46" strokeWidth="4" />
        <circle cx="940" cy="60" r="13" strokeWidth="9" />
        <path d="M 940 73 V 170 A 30 30 0 0 1 880 170 V 140" strokeWidth="11" />
        <path d="M 880 140 L 899 160" strokeWidth="11" />
      </g>
    </svg>
  );
}
