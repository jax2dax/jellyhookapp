// components/marketing/MarketingTheme.tsx
// The lime/dark visual system shared by every public marketing page. Pulled
// out of app/page.tsx verbatim (colors, fonts-as-classes, rope-bob keyframes,
// marquee keyframes, grid + grain textures) so /pricing, /about, /terms,
// /docs and /privacy all read as the same site instead of drifting.
export function MarketingThemeStyles() {
  return (
    <style>{`
        /* ===================================================
           🎨 LIME / GREEN THEME — TWEAK THESE 3 VALUES
           ===================================================
           --lime-h : hue        (lower = more yellow-green, higher = more blue-green)
           --lime-s : saturation (0% = grey, 100% = full intensity)
           --lime-l : lightness  (0% = black,  100% = white)
        */
        :root {
            --lime-h: 78;
            --lime-s: 100%;
            --lime-l: 62%;

            --lime:        hsl(var(--lime-h) var(--lime-s) var(--lime-l));
            --lime-bright: hsl(var(--lime-h) var(--lime-s) 78%);
            --lime-dim:    hsl(var(--lime-h) 85% 46%);
            --lime-glow:   hsl(var(--lime-h) var(--lime-s) var(--lime-l) / 0.28);
            --lime-fade:   hsl(var(--lime-h) 55% 55% / 0.45);
        }

        .ff-display { font-family: var(--font-display), Georgia, 'Times New Roman', serif; }
        .ff-body    { font-family: var(--font-body), system-ui, sans-serif; }
        .ff-mono    { font-family: var(--font-mono), ui-monospace, monospace; }

        /* ---------- rope hook idle animation ---------- */
        @keyframes jh-rope-bob {
            0%, 68%, 100% { transform: translateY(0); }
            78%, 90%      { transform: translateY(18px); }
        }
        .jh-rope {
            animation: jh-rope-bob 9s ease-in-out infinite;
            will-change: transform;
            transform-origin: top center;
        }
        @media (prefers-reduced-motion: reduce) {
            .jh-rope { animation: none; }
        }

        /* ---------- marquee ---------- */
        @keyframes jh-marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
        }
        .jh-marquee { animation: jh-marquee 32s linear infinite; }

        .jh-grid {
            background-image: linear-gradient(to right, #151512 1px, transparent 1px);
            background-size: calc(100% / 6) 100%;
        }

        .jh-grain {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
        }
    `}</style>
  );
}

export function GrainOverlay() {
  return <div className="jh-grain pointer-events-none fixed inset-0 z-[100] opacity-[0.05] mix-blend-overlay" />;
}

export const primaryBtn =
  "group relative inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 bg-[var(--lime)] px-7 text-black ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors duration-200 hover:bg-[var(--lime-bright)] active:bg-[var(--lime-dim)]";

export const ghostBtn =
  "inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 border border-[#2b2b25] px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cac8bf] transition-colors duration-200 hover:border-[var(--lime)] hover:text-[var(--lime)]";

export const avatarAppearance = {
  elements: {
    avatarBox: "w-8 h-8 rounded-none border border-[#2b2b25]",
  },
};
