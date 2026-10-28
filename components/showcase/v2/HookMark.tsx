// components/showcase/v2/HookMark.tsx
// The fish-hook mark of the landing page: an eye, a straight shank, a round bend and a barbed point.
// Drawn as geometry so it stays crisp at any size; colour comes from currentColor.
export function HookMark({ className = "", strokeWidth = 3.2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 30 46" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="5.5" r="3.4" />
      <path d="M20 9 V30 A9 9 0 0 1 2 30 V21" />
      <path d="M2 21 L7.5 26.5" />
    </svg>
  );
}
