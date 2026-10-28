"use client";
// components/showcase/v2/HubSpotCardShowcase.tsx
// Landing page scene: a HubSpot contact record (example data) with the Jellyhook card in the middle column, drawn the
// way hubspot/src/app/cards/JellyhookCard.jsx lays it out (stats, Short/Moderate/Long, the lead tile, visit summary,
// Open visit chart). The card is outlined in green so it reads as Jellyhook's. On a loop while in view: the card lights
// up, the view zooms in on it and its summary lines are underlined one by one, the view zooms out, the pointer goes to
// Call and a call starts. Everything here is made up and labelled as an example. Reduced motion: the still record.
import * as React from "react";
import { Bell, Building2, Calendar, CheckSquare, Home, Mail, MoreHorizontal, NotebookPen, Phone, PhoneOff, Search, Settings, Users } from "lucide-react";
import { HubSpotLogo } from "@/components/notifications/Brand";

const W = 1120;
const H = 660;

type Phase = "idle" | "glow" | "zoom" | "out" | "point" | "click" | "call";
const TIMELINE: [Phase, number][] = [
  ["idle", 0],
  ["glow", 1100],
  ["zoom", 2100],
  ["out", 7600],
  ["point", 8500],
  ["click", 9900],
  ["call", 10300],
];
const LOOP_MS = 14500;

const SUMMARY = [
  "Their 4th visit: / (12s) → /pricing (2m 40s) → /case-studies/regional-fleets (3m 5s) → /pricing (1m 12s) → /contact (48s).",
  "Most of the time on /case-studies/regional-fleets (3m 5s).",
  "Read 92% of /pricing, most on “Fleet plan” (1m 30s).",
  "Left the site and came back 3 times in 6 days.",
];

function useInView<T extends Element>(ref: React.RefObject<T | null>) {
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

export function HubSpotCardShowcase() {
  const frame = React.useRef<HTMLDivElement>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const card = React.useRef<HTMLDivElement>(null);
  const call = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [reduced, setReduced] = React.useState(false);
  const [geo, setGeo] = React.useState({ ox: 580, oy: 150, cx: 140, cy: 250 });
  const inView = useInView(frame);

  // fit the fixed-size record to the column
  React.useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return () => ro.disconnect();
  }, []);

  // where to zoom (the card's top middle) and where the pointer goes (the Call button), in record pixels
  React.useEffect(() => {
    const r = root.current;
    const c = card.current;
    const b = call.current?.firstElementChild;
    if (!r || !c || !b) return;
    const o = r.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    setGeo({
      ox: (cr.left + cr.width / 2 - o.left) / scale,
      oy: (cr.top - o.top) / scale + 40,
      cx: (br.left + br.width / 2 - o.left) / scale,
      cy: (br.top + br.height / 2 - o.top) / scale,
    });
  }, [scale]);

  React.useEffect(() => {
    if (!inView || reduced) {
      setPhase("idle");
      return;
    }
    let timers: number[] = [];
    const run = () => {
      timers = TIMELINE.map(([p, at]) => window.setTimeout(() => setPhase(p), at));
      timers.push(window.setTimeout(run, LOOP_MS));
    };
    run();
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduced]);

  const zoomed = phase === "zoom";
  const lit = phase !== "idle";
  const pointer = phase === "point" || phase === "click" || phase === "call";

  return (
    <div ref={frame} className="relative w-full overflow-hidden rounded-[10px] border-2 border-[var(--ink)] bg-[#f5f8fa] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]" style={{ height: H * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <div
          ref={root}
          className="relative h-full w-full font-[system-ui] text-[#33475b] transition-transform duration-[1300ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transformOrigin: `${geo.ox}px ${geo.oy}px`, transform: zoomed ? "scale(1.62)" : "none" }}
        >
          {/* top bar */}
          <div className="absolute inset-x-0 top-0 flex h-11 items-center gap-4 bg-[#1f2b38] px-4 text-white">
            <HubSpotLogo className="h-6 w-6" />
            <div className="flex h-7 w-[380px] items-center justify-between rounded-full bg-white/10 px-4 text-[13px] text-white/80">
              Search <Search className="h-3.5 w-3.5" />
            </div>
            <div className="ml-auto flex items-center gap-5 text-white/80">
              <Phone className="h-4 w-4" />
              <Settings className="h-4 w-4" />
              <Bell className="h-4 w-4" />
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ff7a59] text-[11px] font-bold text-white">MB</span>
            </div>
          </div>
          {/* left rail */}
          <div className="absolute bottom-0 left-0 top-11 flex w-14 flex-col items-center gap-6 bg-[#1f2b38] pt-5 text-white/70">
            <Home className="h-5 w-5" />
            <Users className="h-5 w-5 text-white" />
            <Building2 className="h-5 w-5" />
            <Calendar className="h-5 w-5" />
          </div>

          {/* contact column */}
          <div className="absolute left-[72px] top-[60px] w-[262px] space-y-3">
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4">
              <div className="text-[12px] text-[#7c98b6]">‹ Contacts</div>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[#00a4bd] text-[15px] font-bold text-white">DO</span>
                <div>
                  <div className="text-[17px] font-semibold leading-tight text-[#2d3e50]">Daniel Okafor</div>
                  <div className="text-[12px]">Head of Operations, Northline Freight</div>
                </div>
              </div>
              <div className="mt-2 text-[12px] text-[#0091ae]">d.okafor@northlinefreight.co</div>
              <div className="mt-4 flex justify-between">
                {[
                  ["Note", NotebookPen],
                  ["Email", Mail],
                  ["Call", Phone],
                  ["Task", CheckSquare],
                  ["More", MoreHorizontal],
                ].map(([label, Icon]) => {
                  const I = Icon as typeof Phone;
                  const isCall = label === "Call";
                  return (
                    <div key={label as string} ref={isCall ? call : undefined} className="flex flex-col items-center gap-1 text-[11px]">
                      <span className={"grid h-9 w-9 place-items-center rounded-full border transition-colors duration-200 " + (isCall && (phase === "click" || phase === "call") ? "border-[#0f7a3d] bg-[#0f7a3d] text-white" : "border-[#cbd6e2] bg-white")}>
                        <I className="h-4 w-4" />
                      </span>
                      {label as string}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-[#dfe3eb] bg-white p-4 text-[12px]">
              <div className="text-[13px] font-semibold text-[#2d3e50]">About this contact</div>
              {[
                ["Contact owner", "Maya Brennan"],
                ["Phone number", "+1 (617) 555-0148"],
                ["Lead status", "Open"],
                ["Company", "Northline Freight"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[#7c98b6]">{k}</div>
                  <div className="text-[#2d3e50]">{v}</div>
                </div>
              ))}
              <div>
                <div className="text-[#7c98b6]">Lifecycle stage</div>
                <span className="mt-0.5 inline-block rounded bg-[#ffe8e1] px-2 py-0.5 font-semibold text-[#c93700]">Lead</span>
              </div>
            </div>
          </div>

          {/* middle column: tabs and the Jellyhook card */}
          <div className="absolute left-[350px] top-[60px] w-[470px]">
            <div className="flex rounded-t-lg border border-b-0 border-[#dfe3eb] bg-white text-[13px]">
              <div className="flex-1 border-b-2 border-[#2d3e50] py-2.5 text-center font-semibold text-[#2d3e50]">Overview</div>
              <div className="flex-1 py-2.5 text-center">Activities</div>
            </div>
            <div
              ref={card}
              className={"relative rounded-b-lg border-2 bg-white p-4 transition-[box-shadow,border-color] duration-700 " + (lit ? "border-[#0f7a3d] shadow-[0_0_0_6px_rgba(15,122,61,0.16),0_18px_40px_-18px_rgba(15,122,61,0.55)]" : "border-[#dfe3eb]")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-bold text-[#0f7a3d]">Jellyhook</span>
                <span className="rounded-full bg-[#e6f4ec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0f7a3d]">Before the form</span>
              </div>
              <div className="mt-3 grid grid-cols-2 text-center">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider">Hooks that caught them</div>
                  <div className="text-[26px] font-light text-[#2d3e50]">1</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider">Marks</div>
                  <div className="text-[26px] font-light text-[#2d3e50]">3</div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                Summary
                {["Short", "Moderate", "Long"].map((v) => (
                  <span key={v} className={"rounded-full border px-2.5 py-0.5 " + (v === "Moderate" ? "border-[#0f7a3d] bg-[#e6f4ec] text-[#0f7a3d]" : "border-[#cbd6e2]")}>
                    {v}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-[#dfe3eb] p-3">
                <div className="flex justify-between text-[11px] text-[#7c98b6]">
                  <span>/contact · fleetwise.app</span>
                  <span>Demo request form</span>
                </div>
                <div className="mt-1 flex justify-between text-[12px]">
                  <span className="font-semibold text-[#2d3e50]">Form sent today, 9:41 AM</span>
                  <span className="text-[#7c98b6]">4 min ago</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px]">
                  <span className="rounded bg-[#e6f4ec] px-1.5 py-0.5 font-semibold text-[#0f7a3d]">Hooked: Ready to talk</span>
                  {["Pricing reader", "Came back", "Read a case study"].map((m) => (
                    <span key={m} className="rounded bg-[#e5f5f8] px-1.5 py-0.5 text-[#00708a]">{m}</span>
                  ))}
                </div>
                <div className="my-2 h-px bg-[#dfe3eb]" />
                <div className="text-[11.5px]">Came from: Google · Ads · Fleet software search</div>
                <div className="mt-1.5 space-y-1 text-[11.5px] leading-snug">
                  {SUMMARY.map((line, i) => (
                    <p key={i} className={i === 0 ? "font-semibold text-[#2d3e50]" : ""}>
                      <span
                        className="bg-no-repeat transition-[background-size] duration-700 ease-out"
                        style={{
                          backgroundImage: "linear-gradient(rgba(15,122,61,0.18), rgba(15,122,61,0.18))",
                          backgroundSize: zoomed ? "100% 100%" : "0% 100%",
                          transitionDelay: zoomed ? `${900 + i * 650}ms` : "0ms",
                        }}
                      >
                        {line}
                      </span>
                    </p>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11.5px]">
                  <span className="rounded-full bg-[#0f7a3d] px-3 py-1 font-semibold text-white">Open visit chart</span>
                  <span className="font-semibold text-[#0f7a3d]">Open in Jellyhook ↗</span>
                </div>
              </div>
            </div>
          </div>

          {/* right column: CRM data around it */}
          <div className="absolute left-[836px] top-[60px] w-[268px] space-y-3 text-[12px]">
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4">
              <div className="text-[13px] font-semibold text-[#2d3e50]">Companies (1)</div>
              <div className="mt-2 font-semibold text-[#0091ae]">Northline Freight</div>
              <div>northlinefreight.co · 85 employees</div>
              <div>Logistics · Columbus, OH</div>
            </div>
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4">
              <div className="text-[13px] font-semibold text-[#2d3e50]">Deals (1)</div>
              <div className="mt-2 font-semibold text-[#0091ae]">Northline: fleet plan</div>
              <div>Amount: $24,000</div>
              <div>Stage: Appointment scheduled</div>
              <div>Close date: Dec 12</div>
            </div>
            <div className="rounded-lg border border-[#dfe3eb] bg-white p-4">
              <div className="text-[13px] font-semibold text-[#2d3e50]">Tickets (0)</div>
              <div className="mt-1 text-[#7c98b6]">No tickets on this contact.</div>
            </div>
          </div>

          {/* the call starting */}
          <div
            className={"absolute bottom-6 left-[72px] w-[300px] rounded-xl bg-[#2d3e50] p-4 text-white shadow-2xl transition-[opacity,transform] duration-500 " + (phase === "call" ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}
          >
            <div className="text-[11px] uppercase tracking-wider text-white/60">Calling</div>
            <div className="mt-1 text-[16px] font-semibold">Daniel Okafor</div>
            <div className="text-[12px] text-white/70">+1 (617) 555-0148</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] text-[#7fd1a3]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#7fd1a3]" /> Ringing
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f2545b]">
                <PhoneOff className="h-4 w-4" />
              </span>
            </div>
          </div>

          {/* the pointer */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute h-7 w-7 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] transition-[left,top,opacity,transform] duration-[1200ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            style={{
              left: pointer ? geo.cx - 4 : geo.ox + 60,
              top: pointer ? geo.cy - 2 : geo.oy + 300,
              opacity: pointer ? 1 : 0,
              transform: phase === "click" ? "scale(0.85)" : "none",
            }}
          >
            <path d="M4 2 L4 20 L9 15 L12.5 22 L15.5 20.5 L12 13.5 L19 13.5 Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span className="absolute bottom-2 right-3 rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#55524b]">Example data</span>
    </div>
  );
}
