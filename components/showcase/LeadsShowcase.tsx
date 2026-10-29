"use client";
// components/showcase/LeadsShowcase.tsx
// The home page's slot for the interactive demo (./LeadsDemo.tsx). The demo's code (the real Leads and Hooks screens)
// is loaded only when the slot comes near the screen, so the rest of the home page stays light. Until then, and on
// screens too narrow to use it, a placeholder of the same size holds its place. Once loaded, the demo stays (a window
// made narrower later only scales it down), so nobody loses their progress.
import * as React from "react";
import dynamic from "next/dynamic";
import { Monitor } from "lucide-react";

const LeadsDemo = dynamic(() => import("./LeadsDemo"), { ssr: false, loading: () => <Placeholder /> });

/** narrower than this, the screens would be too small to read */
const MIN_WIDTH = 720;

function Placeholder() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0c]" style={{ aspectRatio: "1240 / 760" }}>
      <div className="flex h-[5.3%] items-center gap-1.5 border-b border-white/5 px-4">
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
        <span className="size-2 rounded-full bg-white/15" />
      </div>
      <div className="absolute inset-0 top-[5.3%] flex">
        <div className="w-[17.4%] space-y-2 p-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-white/[0.04]" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
          ))}
        </div>
        <div className="m-2 ml-0 flex-1 rounded-xl bg-white/[0.02]" />
      </div>
    </div>
  );
}

export function LeadsShowcase() {
  const slot = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);
  const [wide, setWide] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  if (near && wide && !loaded) setLoaded(true);

  React.useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const fit = () => el.clientWidth > 0 && setWide(el.clientWidth >= MIN_WIDTH);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={slot} className="w-full">
      {loaded ? (
        <LeadsDemo />
      ) : !wide ? (
        <div className="border border-[#1b1b18] bg-[#0a0a09] p-6">
          <Monitor className="h-5 w-5 text-[var(--lime)]" strokeWidth={1.5} />
          <p className="mt-4 ff-display text-2xl leading-snug text-[#f4f2ea]">The interactive demo needs a wider screen.</p>
          <p className="mt-2 ff-body text-[14px] leading-relaxed text-[#8b8980]">Open this page on a computer to open sample leads, build a mark and turn it into a hook.</p>
        </div>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
