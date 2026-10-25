"use client";
// components/showcase/LeadsDemo.tsx
// The interactive demo on the home page: the real Leads and Hooks screens (LeadsWithMarks, MarksPanel, the mark
// builder, Rules) running on the sample site (./sampleSite.ts) inside a sandbox (components/sandbox), with a guided
// tour (components/tour, sequence ./leadsTour.tsx). Because the screens are the real components, a change to them
// shows up here too. What is copied from app/platform and must follow it by hand: each page's outer wrapper (padding,
// the Hooked leads intro line) and the sidebar's look (its pages come from components/nav/sidebarItems.ts).
//
// The app is drawn at a fixed size (DESIGN_W x DESIGN_H) and scaled down to fit narrower screens.
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronsUpDown, Lock, Play, RotateCcw } from "lucide-react";
import { LeadsWithMarks } from "@/components/leads/LeadsWithMarks";
import { Rules } from "@/components/notifications/Rules";
import { HookedLeads } from "@/components/hooks/HookedLeads";
import { TopBar } from "@/components/nav/TopBar";
import { navFor, resolveTab } from "@/components/nav/navRegistry";
import { SIDEBAR_ITEMS } from "@/components/nav/sidebarItems";
import { Sandbox, type SandboxValue } from "@/components/sandbox/sandbox";
import { Tour } from "@/components/tour/Tour";
import { DemoStore } from "./demoStore";
import { leadsTour } from "./leadsTour";

const DESIGN_W = 1240;
const DESIGN_H = 760;
const CHROME_H = 40;
/** the main area's height: the frame, minus the browser bar, minus the inset margins (m-2) */
const MAIN_H = DESIGN_H - CHROME_H - 16;

type Mode = "intro" | "tour" | "free";

/** The scale that fits the design width into the box (never above 1). */
function useFit(ref: React.RefObject<HTMLElement | null>) {
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // a zero width (the box hidden for a moment) is ignored: the last good scale stays
    const ro = new ResizeObserver(() => el.clientWidth > 0 && setScale(Math.min(1, el.clientWidth / DESIGN_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

/** Pages of the platform that are not part of the demo: what they are, in one line. */
const ELSEWHERE: Record<string, string> = {
  "/platform/dashboard": "Visitors online, page views, sessions, leads and conversion rate, with the change against the previous period.",
  "/platform/marks": "Your marks and ready-made marks to add.",
  "/platform/conversions": "The path each converted lead took, from the start of the visit to the form.",
  "/platform/acquisition": "Where visitors and leads came from.",
  "/platform/notifications": "Every notification your hooks sent you.",
  "/platform/integrations": "Connect Slack and webhooks.",
  "/platform/settings": "The tracker, the site and the names of your form fields.",
  "/platform/team": "Invite teammates with roles.",
};

function Elsewhere({ path, onBack }: { path: string; onBack: () => void }) {
  const lead = path.startsWith("/platform/leads/");
  const title = lead ? "Each lead has its own page" : (SIDEBAR_ITEMS.find((i) => path.startsWith(i.url))?.title ?? "This page") + " is not in this demo";
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-md text-center" style={{ animation: "jh-card-in 220ms ease-out both" }}>
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
          <Lock className="size-4 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {lead ? "The visit chart, the pages they read, the time on each one and how they filled the form. A sample lead page is public, no sign-up." : (ELSEWHERE[path.split("?")[0]] ?? "Part of Jellyhook.") + " Sign up free to see it with your own site."}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button type="button" onClick={onBack} className="h-8 rounded-md border px-3 text-sm text-foreground hover:bg-muted">
            Back to Leads
          </button>
          <Link href={lead ? "/demo" : "/sign-up"} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {lead ? "Open a sample lead" : "Start free"} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** The platform sidebar, drawn for the demo (the real one needs a signed-in site). */
function DemoSidebar({ path, unread, onGo }: { path: string; unread: number; onGo: (href: string) => void }) {
  return (
    <aside className="flex w-[216px] shrink-0 flex-col gap-1 px-2 py-2 text-sidebar-foreground" aria-label="Sidebar">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Image src="/jellyhook-nobg.png" alt="" width={22} height={22} className="size-[22px] object-contain" />
        <span className="font-semibold tracking-wide text-primary">Jellyhook</span>
      </div>
      <div className="mx-1 mb-2 flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2 py-1.5">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-semibold text-primary">SS</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium text-foreground">Sample Studio</span>
          <span className="block truncate text-[11px] text-muted-foreground">sample data</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </div>
      <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-sidebar-foreground/60">Platform</div>
      <nav className="flex flex-col gap-0.5">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = path === item.url || path.startsWith(item.url + "/");
          return (
            <button
              key={item.url}
              type="button"
              onClick={() => onGo(item.url)}
              className={
                "relative flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors " +
                (active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
              }
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.title}</span>
              {item.url === "/platform/hooks" && unread > 0 && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-semibold text-black">{unread}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2 rounded-lg px-2 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">Y</span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-medium text-foreground">You</span>
          <span className="block truncate text-[11px] text-muted-foreground">you@studio.example.com</span>
        </span>
      </div>
    </aside>
  );
}

function Screen({ store, pathname, search, visit, onGo }: { store: DemoStore; pathname: string; search: string; visit: number; onGo: (href: string) => void }) {
  const params = new URLSearchParams(search);
  if (pathname === "/platform/leads")
    return (
      <div className="min-h-full bg-background p-6">
        <LeadsWithMarks key={visit} leads={store.leads} siteId="sample" marks={store.marksState()} groups={store.groupsState()} />
      </div>
    );
  if (pathname === "/platform/hooks") {
    const tab = resolveTab(navFor(pathname)!, params.get("tab"), {});
    if (tab === "hooked")
      return (
        <div className="p-6 pt-4">
          <div className="mx-auto w-full max-w-4xl space-y-3">
            <p className="text-sm text-muted-foreground">Every lead one of your hooks caught, newest first. Open one to see what they did before sending the form.</p>
            <HookedLeads key={visit} leads={store.hooked} ready markSeen />
          </div>
        </div>
      );
    return (
      <div className="p-6 pt-4">
        <Rules key={visit} state={store.rulesState()} startMark={params.get("newHook")} newHookOptions={{ source: false, adImage: false, watchButton: false }} />
      </div>
    );
  }
  return <Elsewhere path={pathname} onBack={() => onGo("/platform/leads")} />;
}

export default function LeadsDemo() {
  const [store, setStore] = React.useState(() => new DemoStore());
  const [loc, setLoc] = React.useState({ pathname: "/platform/leads", search: "" });
  const [visit, setVisit] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>("intro");
  const [run, setRun] = React.useState(0);
  const [unread, setUnread] = React.useState(store.hooked.length);
  const box = React.useRef<HTMLDivElement>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const main = React.useRef<HTMLDivElement>(null);
  const scale = useFit(box);

  const navigate = React.useCallback((href: string) => {
    if (/^(https?:|mailto:)/.test(href) || href.startsWith("/docs")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    const u = new URL(href, "https://jellyhook.com");
    // opening Hooked leads clears the sidebar count, as on the platform
    const nav = navFor(u.pathname);
    if (u.pathname === "/platform/hooks" && nav && resolveTab(nav, u.searchParams.get("tab"), {}) === "hooked") setUnread(0);
    setLoc({ pathname: u.pathname, search: u.search });
    setVisit((v) => v + 1);
    main.current?.scrollTo({ top: 0 });
  }, []);

  // like the real Hooks page, the address drops ?newHook= once the editor has opened with that mark
  React.useEffect(() => {
    if (!loc.search.includes("newHook=")) return;
    const p = new URLSearchParams(loc.search);
    p.delete("newHook");
    const t = setTimeout(() => setLoc((l) => ({ ...l, search: p.toString() ? "?" + p.toString() : "" })), 300);
    return () => clearTimeout(t);
  }, [loc.search]);

  const sandbox: SandboxValue = React.useMemo(() => ({ actions: store.actions(), navigate, location: loc }), [store, navigate, loc]);
  const steps = React.useMemo(() => leadsTour(store), [store]);

  const reset = React.useCallback((next: Mode) => {
    const s = new DemoStore();
    setStore(s);
    setUnread(s.hooked.length);
    setLoc({ pathname: "/platform/leads", search: "" });
    setVisit((v) => v + 1);
    setRun((r) => r + 1);
    setMode(next);
  }, []);
  const finish = React.useCallback(() => setMode("free"), []);

  const address = "jellyhook.com" + loc.pathname + loc.search;

  return (
    <div className="w-full">
      <div ref={box} className="relative w-full" style={{ height: DESIGN_H * scale }}>
        <div
          ref={stage}
          className="dark absolute left-0 top-0 origin-top-left overflow-hidden rounded-xl border border-white/10 bg-sidebar font-sans text-foreground antialiased shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)] [color-scheme:dark]"
          style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}
        >
          {/* the browser bar */}
          <div className="flex items-center gap-3 border-b border-white/5 bg-[#0d0d0c] px-4" style={{ height: CHROME_H }}>
            <span className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="size-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="size-2.5 rounded-full bg-[#28c840]/80" />
            </span>
            <span className="mx-auto flex h-6 w-[420px] items-center justify-center gap-1.5 truncate rounded-md bg-white/5 px-3 font-mono text-[11px] text-white/55">
              <Lock className="size-3 shrink-0" />
              {address}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">Sample data</span>
          </div>

          <Sandbox value={sandbox}>
            <div className="flex" style={{ height: DESIGN_H - CHROME_H }}>
              <DemoSidebar path={loc.pathname} unread={unread} onGo={navigate} />
              <div className="m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-sm">
                <React.Suspense fallback={null}>
                  <TopBar flags={{}} />
                </React.Suspense>
                <div ref={main} className="min-h-0 flex-1 overflow-y-auto" style={{ "--jh-vh": MAIN_H - (navFor(loc.pathname) ? 48 : 0) + "px" } as React.CSSProperties}>
                  <div key={visit} className="h-full" style={{ animation: "jh-card-in 200ms ease-out both" }}>
                    <React.Suspense fallback={null}>
                      <Screen store={store} pathname={loc.pathname} search={loc.search} visit={visit} onGo={navigate} />
                    </React.Suspense>
                  </div>
                </div>
              </div>
            </div>
          </Sandbox>

          {mode === "tour" && <Tour key={run} steps={steps} stage={stage} onFinish={finish} onExit={finish} onRestart={() => reset("tour")} finishLabel="Explore the demo" />}

          {mode === "intro" && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <div className="w-[420px] rounded-2xl border border-white/10 bg-[#121211] p-6 text-center shadow-2xl" style={{ animation: "jh-card-in 260ms ease-out both" }}>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8f8d84]">Interactive demo · about 2 minutes</div>
                <h3 className="mt-3 text-xl font-semibold leading-snug text-white">Mark the leads who studied your pricing page. Then get told when the next one arrives.</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#b4b2aa]">These are the real Leads and Hooks screens, running on a sample site. Nothing you do here is saved or sent.</p>
                <div className="mt-6 flex flex-col gap-2">
                  <button type="button" onClick={() => setMode("tour")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#c5ff3d] text-sm font-semibold text-black transition hover:bg-[#d6ff73]">
                    <Play className="size-4" /> Start the guided tour
                  </button>
                  <button type="button" onClick={() => setMode("free")} className="h-10 rounded-lg text-sm text-[#b4b2aa] transition hover:bg-white/5 hover:text-white">
                    Explore on my own
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* under the frame: what this is, and the way out */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">Real screens · sample data · nothing is saved</p>
        <div className="flex items-center gap-2">
          {mode !== "intro" && (
            <button type="button" onClick={() => reset("tour")} className="inline-flex h-9 items-center gap-2 border border-[#2a2a25] px-3 ff-mono text-[10px] uppercase tracking-[0.2em] text-[#d8d6ce] transition-colors hover:border-[#3a3a33] hover:text-white">
              <RotateCcw className="size-3.5" /> Restart the tour
            </button>
          )}
          <Link href="/sign-up" className="inline-flex h-9 items-center gap-2 bg-[var(--lime,#c5ff3d)] px-4 ff-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-black transition-opacity hover:opacity-90">
            Try it on your site <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
