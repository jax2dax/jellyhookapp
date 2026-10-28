"use client";
// components/showcase/SlackDesktopShowcase.tsx
// The home page's notification showcase: a Windows PC where a Slack notification slides in each time a sample lead
// matches a hook. Drawn in CSS (no screenshots), on sample data. Says only what a hook does: a new lead with the hook's
// marks is posted to the chosen Slack channel with a short summary of the visit (marketing/claims-ledger.md row 24).
// It never says how fast: delivery goes through a queue.
// Each cycle: the toast slides in, the screen zooms in on it, a pointer presses its HubSpot button (the button a hook
// shows when the site has HubSpot connected), the screen zooms back out and the toast leaves.
import * as React from "react";
import Image from "next/image";
import { Battery, Bell, ChevronUp, Search, Volume2, Wifi } from "lucide-react";
import { HubSpotLogo, SlackLogo } from "@/components/notifications/Brand";

interface Toast {
  name: string;
  title: string;
  body: string;
  marks: string[];
}

// The first line is the hook's subject: whatever the team writes in the hook. Sample people, sample site.
const TOASTS: Toast[] = [
  { name: "Anna Kebede", title: "🔥 Hot lead: Anna Kebede just filled out a form", body: "Read /pricing for 1m 12s, then sent the form on /contact. Budget: $20k+.", marks: ["Pricing reader", "Big budget"] },
  { name: "Marco Bianchi", title: "🔥 Hot lead: Marco Bianchi just filled out a form", body: "Came back for a 3rd visit. Saw 92% of /pricing and filled the form in 2 minutes.", marks: ["Came back", "Pricing reader"] },
  { name: "Lina Haddad", title: "🔥 Hot lead: Lina Haddad just filled out a form", body: 'Came from a Facebook ad. 51s on "Best deals", then went straight to /contact.', marks: ["From an ad", "Best deals reader"] },
];

// the timeline of one cycle, in ms from the toast arriving
const ZOOM_AT = 1000;
const PRESS_AT = 2900;
const UNZOOM_AT = 5400;
const SHOW_MS = 6500;
const CYCLE_MS = 8000;

function useClock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts in the browser only (no server mismatch)
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Windows' four-pane logo. */
function WinLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="1" y="1" width="8.5" height="8.5" rx="1" fill="#4cc2ff" />
      <rect x="10.5" y="1" width="8.5" height="8.5" rx="1" fill="#4cc2ff" />
      <rect x="1" y="10.5" width="8.5" height="8.5" rx="1" fill="#4cc2ff" />
      <rect x="10.5" y="10.5" width="8.5" height="8.5" rx="1" fill="#4cc2ff" />
    </svg>
  );
}

export function SlackDesktopShowcase() {
  const [k, setK] = React.useState(-1);
  const [shown, setShown] = React.useState(false);
  const [zoomed, setZoomed] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const now = useClock();

  // runs only while the screen is in view; each cycle brings the next lead
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    let timers: number[] = [];
    let running = false;
    const cycle = () => {
      setK((x) => x + 1);
      setShown(true);
      setUnread((u) => Math.min(9, u + 1));
      setPressed(false);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        timers.push(window.setTimeout(() => setZoomed(true), ZOOM_AT));
        timers.push(window.setTimeout(() => setPressed(true), PRESS_AT));
        timers.push(window.setTimeout(() => setZoomed(false), UNZOOM_AT));
      }
      timers.push(window.setTimeout(() => setShown(false), SHOW_MS));
      timers.push(window.setTimeout(cycle, CYCLE_MS));
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        timers.push(window.setTimeout(cycle, 900));
      } else if (!e.isIntersecting && running) {
        running = false;
        timers.forEach((t) => window.clearTimeout(t));
        timers = [];
        setShown(false);
        setZoomed(false);
      }
    }, { threshold: 0.35 });
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const toast = TOASTS[((k % TOASTS.length) + TOASTS.length) % TOASTS.length];
  const time = now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  const date = now ? now.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" }) : "";

  return (
    <div ref={box} className="mx-auto w-full max-w-[1040px]">
      {/* the monitor */}
      <div className="rounded-[18px] border border-[#2a2a25] bg-[#0c0c0b] p-2.5 shadow-[0_50px_120px_-40px_rgba(0,0,0,.9)] sm:p-3.5">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[8px] font-sans [container-type:inline-size]" aria-label="A Windows desktop where Slack notifications from Jellyhook arrive" role="img">
          {/* everything on the screen, so the camera can zoom in on the notification */}
          <div
            className="absolute inset-0 transition-transform duration-[1100ms] ease-[cubic-bezier(.65,0,.35,1)] motion-reduce:transition-none"
            // origin chosen so the toast (centre near 79% / 75% of the screen) lands in the middle at 2x
            style={{ transformOrigin: "108% 100%", transform: zoomed ? "scale(2)" : "scale(1)" }}
          >
          {/* wallpaper */}
          <div className="absolute inset-0 bg-[#060b1a]" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_95%,#1f5fd6_0%,#173f9e_30%,transparent_70%),radial-gradient(40%_50%_at_28%_70%,#3b82f6aa_0%,transparent_70%),radial-gradient(45%_55%_at_72%_72%,#60a5fa88_0%,transparent_70%)]" />
          <div className="absolute left-1/2 top-[52%] h-[46%] w-[34%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,#93c5fd55,transparent)] blur-2xl" />

          {/* a window the person is working in */}
          <div className="absolute left-[7%] top-[8%] h-[66%] w-[58%] overflow-hidden rounded-[6px] border border-white/10 bg-[#1f1f1f]/95 shadow-2xl">
            <div className="flex h-[7%] min-h-5 items-center justify-between bg-[#2b2b2b] px-3 text-[clamp(7px,1cqw,11px)] text-white/70">
              <span>Q4 pipeline - Excel</span>
              <span className="tracking-[0.4em] text-white/40">—  ▢  ✕</span>
            </div>
            <div className="grid h-[93%] grid-cols-6 grid-rows-[repeat(12,minmax(0,1fr))]">
              {Array.from({ length: 72 }).map((_, i) => (
                <div key={i} className={"border-b border-r border-white/[0.05] " + (i < 6 ? "bg-white/[0.04]" : "")}>
                  {i % 6 !== 5 && i > 5 && i % 5 !== 3 && <div className="m-[18%] h-[22%] rounded-sm bg-white/[0.08]" style={{ width: `${30 + ((i * 37) % 55)}%` }} />}
                </div>
              ))}
            </div>
          </div>

          {/* the notification */}
          <div
            className={
              "absolute bottom-[calc(8%+12px)] right-[1.6%] w-[min(380px,40%)] rounded-[8px] border border-white/10 bg-[#202020]/95 p-[1.4cqw] text-white shadow-[0_16px_40px_rgba(0,0,0,.55)] backdrop-blur-xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.9,.25,1)] " +
              (shown ? "translate-x-0 opacity-100" : "translate-x-[115%] opacity-0")
            }
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-[clamp(8px,1.05cqw,12px)] text-white/70">
              <SlackLogo className="size-[1.4cqw] min-h-3 min-w-3" />
              <span>Slack</span>
              <span className="ml-auto tracking-widest text-white/40">···  ✕</span>
            </div>
            <div className="mt-[1cqw] flex gap-[1cqw]">
              <span className="relative flex size-[3.4cqw] min-h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-[#0d0d0c]">
                <Image src="/jellyhook-nobg.png" alt="" width={28} height={28} className="size-[70%] object-contain" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[clamp(9px,1.15cqw,13px)] font-semibold">
                  Jellyhook <span className="font-normal text-white/60">in #sales-leads</span>
                </div>
                <div className="mt-0.5 text-[clamp(9px,1.15cqw,13px)] font-semibold leading-snug">{toast.title}</div>
                <div className="mt-0.5 text-[clamp(8px,1.05cqw,12px)] leading-snug text-white/70">{toast.body}</div>
                <div className="mt-[0.8cqw] flex flex-wrap gap-1">
                  {toast.marks.map((m) => (
                    <span key={m} className="rounded-full border border-white/15 px-1.5 py-px text-[clamp(7px,0.9cqw,11px)] text-white/80">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="relative mt-[1cqw] inline-flex">
                  <span
                    className={
                      "inline-flex items-center gap-[0.5cqw] rounded-[4px] bg-[#ff7a59] px-[1cqw] py-[0.45cqw] text-[clamp(8px,1.05cqw,12px)] font-semibold text-white shadow-sm transition-[transform,filter,box-shadow] duration-150 " +
                      (pressed ? "scale-95 brightness-90 shadow-[0_0_0_3px_rgba(255,122,89,.35)]" : "")
                    }
                  >
                    <HubSpotLogo color="#ffffff" className="size-[1.3cqw] min-h-2.5 min-w-2.5" />
                    Contact lead
                  </span>
                  {/* the pointer that presses it */}
                  <svg
                    viewBox="0 0 16 22"
                    aria-hidden
                    className="pointer-events-none absolute left-[62%] top-[55%] h-[1.9cqw] min-h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,.6)] transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ opacity: zoomed ? 1 : 0, transform: zoomed ? (pressed ? "translate(0,0) scale(0.9)" : "translate(0,0)") : "translate(260%, 180%)" }}
                  >
                    <path d="M1 1v16.5l4.2-4 2.9 6.6 2.6-1.1-2.8-6.5H14L1 1z" fill="#fff" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* the taskbar */}
          <div className="absolute inset-x-0 bottom-0 flex h-[8%] min-h-7 items-center border-t border-white/5 bg-[#1c1c1c]/90 px-[1.2cqw] text-white backdrop-blur-xl">
            <div className="mx-auto flex h-full items-center gap-[0.9cqw]">
              <WinLogo className="size-[2cqw] min-h-3.5 min-w-3.5" />
              <span className="hidden h-[60%] items-center gap-1.5 rounded-full bg-white/10 px-[1cqw] text-[clamp(7px,1cqw,11px)] text-white/60 sm:flex">
                <Search className="size-[1.2cqw] min-h-2.5 min-w-2.5" /> Search
              </span>
              <span className="size-[2cqw] min-h-3.5 min-w-3.5 rounded-[3px] bg-[linear-gradient(135deg,#ffd75e,#e8a33d)]" />
              <span className="size-[2cqw] min-h-3.5 min-w-3.5 rounded-full bg-[conic-gradient(#ea4335_0_33%,#fbbc05_0_66%,#34a853_0)] p-[0.45cqw]">
                <span className="block size-full rounded-full bg-[#4285f4] ring-2 ring-white" />
              </span>
              <span className="size-[2cqw] min-h-3.5 min-w-3.5 rounded-[3px] bg-[#107c41]" />
              <span className="relative flex size-[2.6cqw] min-h-4 min-w-4 items-center justify-center rounded-md bg-white/10">
                <SlackLogo className="size-[1.9cqw] min-h-3 min-w-3" />
                {unread > 0 && (
                  <span key={unread} className="jh-badge-pop absolute -right-1 -top-1 flex size-[1.5cqw] min-h-3 min-w-3 items-center justify-center rounded-full bg-[#e01e5a] text-[clamp(6px,0.85cqw,10px)] font-bold">
                    {unread}
                  </span>
                )}
                <span className="absolute -bottom-[0.35cqw] left-1/2 h-[2px] w-[35%] -translate-x-1/2 rounded-full bg-white/70" />
              </span>
            </div>
            <div className="absolute right-[1.2cqw] flex items-center gap-[0.8cqw] text-[clamp(7px,0.95cqw,11px)] text-white/80">
              <ChevronUp className="hidden size-[1.2cqw] min-h-2.5 min-w-2.5 sm:block" />
              <Wifi className="size-[1.2cqw] min-h-2.5 min-w-2.5" />
              <Volume2 className="size-[1.2cqw] min-h-2.5 min-w-2.5" />
              <Battery className="size-[1.3cqw] min-h-2.5 min-w-2.5" />
              <span className="hidden text-right leading-tight sm:block">
                {time}
                <br />
                {date}
              </span>
              <span className="relative">
                <Bell className="size-[1.2cqw] min-h-2.5 min-w-2.5" />
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[#4cc2ff]" />}
              </span>
            </div>
          </div>
          </div>
        </div>
      </div>
      {/* the stand */}
      <div className="mx-auto h-10 w-[14%] bg-[linear-gradient(#141412,#0c0c0b)]" />
      <div className="mx-auto h-2 w-[30%] rounded-t-md bg-[#1a1a17]" />

      {/* what just happened, in words */}
      <p className="mx-auto mt-6 max-w-2xl text-center ff-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-[#77756d]" aria-live="polite">
        {k < 0 ? (
          "Waiting for the next lead..."
        ) : (
          <>
            <span className="text-[#e9e7e0]">{toast.name}</span> sent the form <span className="text-[#5f5d57]">→</span> matched{" "}
            <span className="text-[var(--lime)]">{toast.marks.join(" + ")}</span> <span className="text-[#5f5d57]">→</span> posted to{" "}
            <span className="text-[#e9e7e0]">#sales-leads</span>
          </>
        )}
      </p>
    </div>
  );
}
