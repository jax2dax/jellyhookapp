// components/marketing/MarketingTheme.tsx
// The visual system shared by the public marketing pages (/pricing, /about, /terms, /privacy, /demo, /docs, sign-in):
// the home page's magazine look since 2026-10-28 (white paper, ink, one green; app/landing.css). The old dark palette's
// colours were swapped for these tokens; --lime keeps its name and now holds the green, so older classes still work.
// Scoped to .jh-mkt (the MarketingPage shell) so the interactive demo on the home page, which uses the same
// styles inside a dark band, keeps its own dark colours.
export function MarketingThemeStyles() {
  return (
    <style>{`
        .jh-mkt {
            --paper: #ffffff;
            --paper-2: #eef2ec;
            --ink: #111111;
            --ink-2: #2c2f2b;
            --ink-soft: #4f544e;
            --ink-mute: #646962;
            --rule: #111111;
            --info: #0b6aa2;
            --danger: #b42318;
            --danger-rule: #e9b8b2;
            --spot: #0f7a3d;

            --lime:        #0f7a3d;
            --lime-bright: #13924a;
            --lime-dim:    #0b5e2f;
            --lime-glow:   rgba(15, 122, 61, 0.18);
            --lime-fade:   rgba(15, 122, 61, 0.35);
        }
        :root {
            --lime:        hsl(78 100% 62%);
            --lime-bright: hsl(78 100% 78%);
            --lime-dim:    hsl(78 85% 46%);
            --lime-glow:   hsl(78 100% 62% / 0.28);
            --lime-fade:   hsl(78 55% 55% / 0.45);
        }
        .jh-mkt ::selection { background: #0f7a3d; color: #fff; }
        .jh-mkt :focus-visible { outline: 2px solid #0f7a3d; outline-offset: 3px; }
        .jh-mkt .ff-display { font-family: var(--font-v2-serif), Georgia, serif; font-style: normal; }
        .jh-mkt .ff-body { font-family: var(--font-v2-sans), system-ui, sans-serif; }
        .jh-mkt h1, .jh-mkt h2, .jh-mkt h3 { text-wrap: balance; }

        .ff-display { font-family: var(--font-display), Georgia, 'Times New Roman', serif; }
        .ff-body    { font-family: var(--font-body), system-ui, sans-serif; }
        .ff-mono    { font-family: var(--font-mono), ui-monospace, monospace; }

        /* ---------- rope hook idle animation ---------- */
        /* The rope is anchored ABOVE the section's top edge (the wrapper sits at -top-12), so its end is always
           hidden under the header. At rest the hook is pulled up (contracted); it lowers to its old resting
           position and the rope is still attached the whole way, never showing a cut end. */
        @keyframes jh-rope-bob {
            0%, 68%, 100% { transform: translateY(-24px); }
            78%, 90%      { transform: translateY(0); }
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

        /* ---------- ambient glow pulse (auth cards, pricing table) ---------- */
        @keyframes jh-glow-pulse {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50%      { opacity: 0.6; transform: scale(1.06); }
        }
        .jh-glow-pulse { animation: jh-glow-pulse 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
            .jh-glow-pulse { animation: none; opacity: 0.45; }
        }

        /* ---------- step transition (auth card form -> verify) ---------- */
        @keyframes jh-step-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .jh-step-in { animation: jh-step-in 0.35s ease-out; }
        @media (prefers-reduced-motion: reduce) {
            .jh-step-in { animation: none; }
        }
    `}</style>
  );
}

export function GrainOverlay() {
  return <div className="jh-grain pointer-events-none fixed inset-0 z-[100] opacity-[0.05] mix-blend-overlay" />;
}

export const primaryBtn =
  "group relative inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 bg-[var(--lime)] px-7 text-white ff-body text-[12px] font-bold uppercase tracking-[0.16em] transition-colors duration-200 hover:bg-[var(--ink)] active:bg-[var(--lime-dim)]";

export const ghostBtn =
  "inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 border-2 border-[var(--ink)] px-7 ff-body text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--ink)] transition-colors duration-200 hover:border-[var(--lime)] hover:text-[var(--lime)]";

export const avatarAppearance = {
  elements: {
    avatarBox: "w-8 h-8 rounded-none border border-[#2b2b25]",
  },
};

