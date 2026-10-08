// silhouette/components/SilhouettePanel.tsx
// The silhouette preview: the hook being built, drawn as FramePlate shapes
// that fill in as the hook says more. Faint at rest; every edit makes it
// pulse once and the exact shapes that changed glow (both off under
// "reduce motion").
//
// Cost: the model is derived from the hook in memory on every edit (pure
// function, no request). The only network call is the site's page list,
// once per mount, for "N+" headers. A failure in here never breaks the
// builder: an error boundary swaps in a quiet message and logs the cause.
"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { hookLog } from "@/jh-hook/debug";
import type { HookSpec } from "@/jh-hook/types";
import { listSitePages } from "@/lib/actions/hook.action";
import { deriveSilhouette } from "../derive";
import type { Figure, Item, SilhouetteModel } from "../types";
import { SilhouetteFigure } from "./SilhouetteFigure";

/** Stable per-shape signatures, to tell which shapes an edit changed. */
function signatures(m: SilhouetteModel | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!m) return out;
  for (const f of m.figures) {
    const items: Item[] = f.kind === "page" ? [f.item] : f.items;
    for (const it of items) {
      const { source: _source, ...rest } = it;
      void _source;
      out.set(it.key, JSON.stringify(rest));
    }
  }
  return out;
}

function SilhouetteContent({ spec }: { spec: HookSpec }) {
  const model = useMemo<SilhouetteModel | null>(() => {
    try {
      return deriveSilhouette(spec);
    } catch (e) {
      hookLog.error("silhouette derive failed", e);
      return null;
    }
  }, [spec]);
  const sigs = useMemo(() => signatures(model), [model]);

  // One pulse per edit, and a glow on the shapes that changed. Derived
  // from the previous render's signatures (React's "adjust state when a
  // prop changes" pattern: no effect, no extra commit).
  const [prev, setPrev] = useState<{ sigs: Map<string, string>; pulse: number; changed: Set<string> }>({ sigs, pulse: 0, changed: new Set() });
  if (prev.sigs !== sigs) {
    const changed = new Set<string>();
    for (const [k, v] of sigs) if (prev.sigs.get(k) !== v) changed.add(k);
    setPrev({ sigs, pulse: prev.pulse + 1, changed });
  }

  const [sitePaths, setSitePaths] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    listSitePages()
      .then((rows) => {
        if (live) setSitePaths(rows.map((r) => r.path));
      })
      .catch((e) => hookLog.warn("silhouette: site pages unavailable", e));
    return () => {
      live = false;
    };
  }, []);

  if (!model) return <p className="text-xs text-muted-foreground">The preview couldn&apos;t be drawn for this hook. The hook itself is unaffected.</p>;
  if (!model.figures.length) {
    return (
      <p className="text-xs text-muted-foreground">
        A preview appears here as soon as your hook describes a session, a page view, a page or a form. For example: add a condition on
        sessions, or look at a lead&apos;s session.
      </p>
    );
  }
  const main = model.figures.filter((f) => f.scale === "main");
  const subs = model.figures.filter((f) => f.scale === "sub");
  return (
    <div key={prev.pulse} className={prev.pulse > 0 ? "jh-silhouette-pulse space-y-4" : "space-y-4"}>
      {main.map((f) => <FigureCard key={f.key} f={f} sitePaths={sitePaths} changed={prev.changed} />)}
      {subs.length > 0 && (
        <div className="space-y-3 border-t border-dashed pt-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sub-hooks, flowing in through tunnels</p>
          {subs.map((f) => <FigureCard key={f.key} f={f} sitePaths={sitePaths} changed={prev.changed} />)}
        </div>
      )}
      {model.notes.map((n, i) => <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400">{n}</p>)}
    </div>
  );
}

function FigureCard({ f, sitePaths, changed }: { f: Figure; sitePaths: string[]; changed: ReadonlySet<string> }) {
  return (
    <figure className="space-y-1">
      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className={`font-medium ${f.excluded ? "text-red-500" : ""}`}>{f.excluded ? `Not this: ${f.title}` : f.title}</span>
        {f.kind === "session" && f.pagesLabel && <span className="text-muted-foreground">{f.pagesLabel}</span>}
        {f.kind === "session" && f.converted === false && <span className="text-muted-foreground">did not convert</span>}
        {f.feeds && <span className="text-muted-foreground">flows into {f.feeds}</span>}
      </figcaption>
      <div className="overflow-x-auto pb-1">
        <SilhouetteFigure figure={f} sitePaths={sitePaths} changed={changed} />
      </div>
      {f.chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {f.chips.slice(0, 8).map((c) => (
            <span key={c.key} className="max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground" title={c.text}>
              {c.text}
            </span>
          ))}
          {f.chips.length > 8 && <span className="text-[10px] text-muted-foreground">+{f.chips.length - 8} more</span>}
        </div>
      )}
    </figure>
  );
}

class SilhouetteBoundary extends Component<{ children: ReactNode; resetKey: unknown }, { failed: boolean; key: unknown }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromProps(props: { resetKey: unknown }, state: { failed: boolean; key: unknown }) {
    // a new hook gets a fresh chance to draw
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    hookLog.error("silhouette render failed", error);
  }
  render() {
    return this.state.failed ? <p className="text-xs text-muted-foreground">The preview hit a problem and was paused. Your hook is unaffected.</p> : this.props.children;
  }
}

const LEGEND: [string, string][] = [
  ["dashed white plate", "any page, not chosen yet (hover the label for the site's pages)"],
  ["solid plate", "a specific page"],
  ["yellow frame", "converted on this page"],
  ["orange frame", "a form was abandoned"],
  ["purple bar", "away from the site"],
  ["faint, ?", "may or may not exist (inside a range)"],
  ["+", "and possibly more"],
  ["green / dark green band", "share seen / seen 2x+"],
  ["red diagonal lines", "excluded: must NOT look like this"],
  ["cyan ring", "the page view the hook returns"],
];

export function SilhouettePanel({ spec }: { spec: HookSpec }) {
  return (
    <aside aria-label="Preview of what the hook describes" className="jh-silhouette rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Preview</h2>
        <div className="group relative">
          <button type="button" aria-label="What the shapes mean" className="flex h-5 w-5 items-center justify-center rounded-full border text-[11px] italic text-muted-foreground hover:bg-muted focus:bg-muted">
            i
          </button>
          <ul className="invisible absolute right-0 top-7 z-20 w-72 space-y-0.5 rounded-md border bg-popover p-3 text-[11px] leading-relaxed text-muted-foreground shadow-md group-focus-within:visible group-hover:visible">
            {LEGEND.map(([k, v]) => (
              <li key={k}>
                <span className="font-medium text-foreground">{k}</span>: {v}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SilhouetteBoundary resetKey={spec}>
        <SilhouetteContent spec={spec} />
      </SilhouetteBoundary>
    </aside>
  );
}
