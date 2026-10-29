"use client";
// app/demo/DemoApp.tsx
// /demo: the interactive demo at full width (components/showcase/LeadsDemo.tsx), the same real Leads, lead pages and
// Hooks screens as the home page's demo, on the sample site, with the optional guided tour. Loaded in the browser only.
// Phones get a short note: the screens need a computer-sized window to be readable.
import * as React from "react";
import dynamic from "next/dynamic";
import { Monitor } from "lucide-react";

const LeadsDemo = dynamic(() => import("@/components/showcase/LeadsDemo"), {
  ssr: false,
  loading: () => <div className="w-full animate-pulse rounded-xl border bg-[#0d0d0c]" style={{ aspectRatio: "1240 / 760" }} />,
});

const MIN_WIDTH = 720;

export function DemoApp() {
  const box = React.useRef<HTMLDivElement>(null);
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.clientWidth > 0 && setWide(el.clientWidth >= MIN_WIDTH);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="w-full">
      {wide ? (
        <div className="bg-[#070706] p-3 text-[#e9e7e0] sm:p-5">
          <LeadsDemo />
        </div>
      ) : (
        <div className="border-2 border-[var(--ink)] p-6">
          <Monitor className="h-5 w-5 text-[var(--lime)]" strokeWidth={1.5} />
          <p className="mt-4 ff-display text-2xl leading-snug text-[var(--ink)]">The demo needs a wider screen.</p>
          <p className="mt-2 ff-body text-[15px] leading-relaxed text-[var(--ink-soft)]">Open this page on a computer to open sample leads, build a mark and turn it into a hook.</p>
        </div>
      )}
    </div>
  );
}
