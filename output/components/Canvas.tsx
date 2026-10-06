// output/components/Canvas.tsx
// The results canvas: draws whatever view the output engine chose
// (output/plan.ts, output/server/render.ts). People, sessions, pages and
// numbers, never raw ids. List views load more from sealed tokens
// (no re-run, no credits). Session replays are FramePlate charts with the
// visits that matched the hook highlighted and the rest dimmed.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FramePlateChart } from "@/framePlate";
import type { FieldType } from "@/jh-hook/schema";
import type { HookSpec } from "@/jh-hook/types";
import { hookLog } from "@/jh-hook/debug";
import { loadMoreCanvas } from "@/lib/actions/canvas.action";
import { formatDate, formatValue } from "../format";
import type { CanvasView, FieldRow, FormCard, LeadCard, ListKind, PageCard, SessionCard, VisitorCard } from "../types";
import { FORMULA_LABEL } from "../types";

// FramePlate's own "converted" yellow, the same as the conversions page.
const CONVERTED_YELLOW = "#eab308";

type Announce = (tone: "info" | "success" | "error", text: string) => void;

export function Canvas({ view, spec, announce }: { view: CanvasView; spec: HookSpec; announce?: Announce }) {
  switch (view.kind) {
    case "number":
      return (
        <section aria-label="Answer" className="space-y-1">
          <div className="text-4xl font-semibold">{formatValue(view.value, view.type)}</div>
          {view.base && (
            <p className="text-sm text-muted-foreground">
              {view.base.share !== null
                ? `out of ${formatValue(view.base.value, view.type)} ${view.base.label} (${+(view.base.share * 100).toFixed(1)}%)`
                : `${view.base.label}: ${formatValue(view.base.value, view.type)}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{view.sentence}</p>
        </section>
      );
    case "ranking":
      return <Ranking rows={view.rows} keyType={view.keyType} valueType={view.valueType} sentence={view.sentence} />;
    case "timeSeries":
      return <TimeSeries rows={view.rows} valueType={view.valueType} bucket={view.bucket} sentence={view.sentence} />;
    case "values":
      return (
        <section aria-label="Values" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {view.values.length.toLocaleString()}
            {view.truncated ? "+" : ""} values · {view.sentence}
          </p>
          <div className="flex max-h-72 flex-wrap gap-1.5 overflow-auto">
            {view.values.map((v, i) => (
              <span key={`${v}-${i}`} className="rounded-full border px-2 py-0.5 text-xs">{formatValue(v, view.type)}</span>
            ))}
          </div>
        </section>
      );
    case "compare":
      return (
        <section aria-label="Comparison" className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((k) => (
              <div key={k} className="rounded-lg border p-3">
                <div className="text-xs font-medium text-muted-foreground">Hook {k.toUpperCase()}</div>
                <div className="text-2xl font-semibold">{formatValue(view[k].value, view[k].type)}</div>
                <p className="text-xs text-muted-foreground">{view[k].sentence}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="text-xs font-medium text-muted-foreground">{FORMULA_LABEL[view.formula]}</div>
            <div className="text-3xl font-semibold">{view.result === null ? "n/a" : view.resultLabel}</div>
            {view.result === null && <p className="text-xs text-muted-foreground">{view.resultLabel}</p>}
          </div>
        </section>
      );
    default:
      return <ListCanvas view={view} spec={spec} announce={announce} />;
  }
}

// ── lists with "Show more" ──────────────────────────────────────────────
type ListViewOf = Extract<CanvasView, { kind: ListKind }>;

function ListCanvas({ view, spec, announce }: { view: ListViewOf; spec: HookSpec; announce?: Announce }) {
  const [extra, setExtra] = useState<unknown[]>([]);
  const [rest, setRest] = useState<string[]>(view.more);
  const [loading, setLoading] = useState(false);
  const items = useMemo(() => [...view.items, ...extra], [view.items, extra]);

  const more = async () => {
    const batch = rest.slice(0, view.pageSize);
    if (!batch.length) return;
    setLoading(true);
    try {
      const res = await loadMoreCanvas(spec, view.kind, batch);
      if (res.ok) {
        setExtra((x) => [...x, ...res.items]);
        setRest((r) => r.slice(batch.length));
      } else {
        announce?.("error", res.error);
        hookLog.warn("load more refused", res);
      }
    } catch (e) {
      announce?.("error", "Couldn't load more. Check your connection.");
      hookLog.error("load more unreachable", e);
    } finally {
      setLoading(false);
    }
  };

  const noun = { sessions: "sessions", leads: "leads", visitors: "visitors", pages: "pages", forms: "forms", formFields: "fields" }[view.kind];
  return (
    <section aria-label={`Matching ${noun}`} className="space-y-3">
      <div>
        <p className="text-sm">
          <span className="text-2xl font-semibold">{view.total.toLocaleString()}</span>
          {view.truncated ? "+" : ""} {noun}
        </p>
        <p className="text-xs text-muted-foreground">{view.sentence}</p>
        {view.note && <p className="mt-1 text-xs text-muted-foreground">{view.note}</p>}
      </div>
      {view.total === 0 && <p className="text-sm text-muted-foreground">Nothing matches this hook.</p>}
      {view.kind === "sessions" && <div className="space-y-3">{(items as SessionCard[]).map((s) => <SessionView key={s.session.id} card={s} />)}</div>}
      {view.kind === "leads" && <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{(items as LeadCard[]).map((l) => <LeadView key={l.href} lead={l} />)}</div>}
      {view.kind === "visitors" && <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{(items as VisitorCard[]).map((v, i) => <VisitorView key={i} v={v} />)}</div>}
      {view.kind === "pages" && <PagesView pages={items as PageCard[]} />}
      {view.kind === "forms" && <FormsView forms={items as FormCard[]} />}
      {view.kind === "formFields" && <FieldsView rows={items as FieldRow[]} />}
      {rest.length > 0 && (
        <Button variant="outline" size="sm" onClick={more} disabled={loading}>
          {loading ? "Loading..." : `Show ${Math.min(view.pageSize, rest.length)} more (${rest.length} left)`}
        </Button>
      )}
    </section>
  );
}

// ── one session: a FramePlate with the matching visits highlighted ─────
function SessionView({ card, compact = false }: { card: SessionCard; compact?: boolean }) {
  const highlight = useMemo(() => new Set(card.highlight), [card.highlight]);
  const s = card.session;
  const converted = s.visits.some((v) => v.converted);
  return (
    <article className="rounded-lg border bg-card/50 p-3">
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{formatDate(s.startedAt)}</span>
        <span>
          {s.visits.length} page{s.visits.length === 1 ? "" : "s"}
        </span>
        {card.deviceType && <span>{card.deviceType}</span>}
        {converted && <span style={{ color: CONVERTED_YELLOW }}>converted</span>}
        {!s.endedAt && <span className="text-cyan-600 dark:text-cyan-400">still open</span>}
        {card.highlight.length > 0 && (
          <span>
            {card.highlight.length} matching visit{card.highlight.length === 1 ? "" : "s"} highlighted
          </span>
        )}
        {card.reason && <span>{card.reason}</span>}
      </header>
      <div className="w-full min-w-0 overflow-hidden">
        <FramePlateChart session={s} deviceType={card.deviceType} highlightIds={highlight} className={compact ? "w-full min-w-0 text-[0.9em]" : "w-full min-w-0"} />
      </div>
    </article>
  );
}

// ── one lead: mini profile, raw form answers behind a toggle, evidence ──
function LeadView({ lead }: { lead: LeadCard }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={lead.href} className="font-semibold hover:underline" style={{ color: CONVERTED_YELLOW }}>
            {lead.name || lead.email || "Unnamed lead"}
          </Link>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {lead.email && <span>{lead.email}</span>}
            {lead.phone && <span>{lead.phone}</span>}
          </div>
        </div>
        {lead.qualified !== null && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${lead.qualified ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {lead.qualified ? "qualified" : "not qualified"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span>Submitted {formatDate(lead.submittedAt)}</span>
        {lead.page && <span>on {lead.page}</span>}
      </div>
      {lead.fields.length > 0 && (
        <div>
          <button type="button" className="text-xs underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide form answers" : `Show form answers (${lead.fields.length})`}
          </button>
          {open && (
            <dl className="mt-1 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
              {lead.fields.map((f) => (
                <div key={f.key} className="contents">
                  <dt className="truncate text-muted-foreground">{f.key}</dt>
                  <dd className="break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      {lead.sessions.map((s) => <SessionView key={s.session.id} card={s} compact />)}
      <Link href={lead.href} className="inline-block text-xs underline">
        Open the lead
      </Link>
    </article>
  );
}

function VisitorView({ v }: { v: VisitorCard }) {
  return (
    <article className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {v.lead ? (
          <Link href={v.lead.href} className="font-semibold hover:underline" style={{ color: CONVERTED_YELLOW }}>
            {v.lead.name || v.lead.email || "Lead"}
          </Link>
        ) : (
          <span className="font-semibold">Anonymous visitor</span>
        )}
        <span className="text-xs text-muted-foreground">
          {v.sessionsCount} session{v.sessionsCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {[v.device, v.browser, v.os].filter(Boolean).join(" · ") || "device unknown"}
        <span>first seen {formatDate(v.firstSeen)}</span>
        <span>last seen {formatDate(v.lastSeen)}</span>
      </div>
      {v.sessions.map((s) => <SessionView key={s.session.id} card={s} compact />)}
    </article>
  );
}

function PagesView({ pages }: { pages: PageCard[] }) {
  const max = Math.max(1, ...pages.map((p) => p.views));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 font-normal">Page</th>
          <th className="w-full py-1 font-normal">Views</th>
          <th className="py-1 text-right font-normal">Form submissions</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p) => (
          <tr key={p.path} className="border-t">
            <td className="whitespace-nowrap py-1 pr-3">{p.path}</td>
            <td className="py-1">
              <div className="flex items-center gap-2">
                <div className="h-2 rounded bg-primary/60" style={{ width: `${(100 * p.views) / max}%` }} />
                <span className="text-xs">{p.views.toLocaleString()}</span>
              </div>
            </td>
            <td className="py-1 text-right">{p.submissions.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STATUS_STYLE: Record<string, string> = { submitted: "text-yellow-600 dark:text-yellow-400", abandoned: "text-orange-600 dark:text-orange-400" };

function FormsView({ forms }: { forms: FormCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {forms.map((f, i) => (
        <article key={i} className="rounded-lg border bg-card p-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{f.page ?? "unknown page"}</span>
            <span className={STATUS_STYLE[f.status ?? ""] ?? "text-muted-foreground"}>{f.status}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground">
            <span>seen {formatDate(f.viewedAt)}</span>
            {f.fillMs !== null && <span>filling took {formatValue(f.fillMs, "duration")}</span>}
            <span>{f.fieldsTouched} field{f.fieldsTouched === 1 ? "" : "s"} touched</span>
            {f.lastField && <span>last field: {f.lastField}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function FieldsView({ rows }: { rows: FieldRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.focusedMs ?? 0));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 font-normal">Field</th>
          <th className="py-1 font-normal">Page</th>
          <th className="w-full py-1 font-normal">Time in the field</th>
          <th className="py-1 font-normal">Typed</th>
          <th className="py-1 font-normal">Stopped here</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            <td className="whitespace-nowrap py-1 pr-3">{r.field}</td>
            <td className="whitespace-nowrap py-1 pr-3 text-xs text-muted-foreground">{r.page}</td>
            <td className="py-1">
              <div className="flex items-center gap-2">
                <div className="h-2 rounded bg-amber-500/70" style={{ width: `${(100 * (r.focusedMs ?? 0)) / max}%` }} />
                <span className="whitespace-nowrap text-xs">{formatValue(r.focusedMs, "duration")}</span>
              </div>
            </td>
            <td className="py-1 text-xs">{r.typed ? "yes" : "no"}</td>
            <td className={`py-1 text-xs ${r.lastTouched && r.formStatus === "abandoned" ? "text-orange-600 dark:text-orange-400" : ""}`}>{r.lastTouched ? (r.formStatus === "abandoned" ? "gave up here" : "yes") : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── breakdowns ──────────────────────────────────────────────────────────

function Ranking({ rows, keyType, valueType, sentence }: { rows: { key: string | null; value: number | string | null }[]; keyType: FieldType; valueType: FieldType; sentence: string }) {
  const max = Math.max(1, ...rows.map((r) => (typeof r.value === "number" ? r.value : 0)));
  return (
    <section aria-label="Breakdown" className="space-y-2">
      <p className="text-xs text-muted-foreground">{sentence}</p>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b">
                <td className="whitespace-nowrap py-1 pr-3">{row.key == null ? "(empty)" : formatValue(row.key, keyType)}</td>
                <td className="w-full py-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded bg-primary/60" style={{ width: `${(100 * (typeof row.value === "number" ? row.value : 0)) / max}%` }} />
                    <span className="whitespace-nowrap">{formatValue(row.value, valueType)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TimeSeries({ rows, valueType, bucket, sentence }: { rows: { key: string | null; value: number | string | null }[]; valueType: FieldType; bucket: string; sentence: string }) {
  const vals = rows.map((r) => (typeof r.value === "number" ? r.value : 0));
  const max = Math.max(1, ...vals);
  const W = Math.max(300, rows.length * 18);
  const H = 160;
  const bw = W / Math.max(1, rows.length);
  const label = (k: string | null) => {
    if (!k) return "";
    const d = new Date(k);
    if (Number.isNaN(d.getTime())) return k;
    return bucket === "hour" ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" }) : bucket === "month" ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  return (
    <section aria-label={`Per ${bucket}`} className="space-y-2">
      <p className="text-xs text-muted-foreground">{sentence}</p>
      <div className="overflow-x-auto">
        <svg width={W} height={H + 34} role="img" aria-label={`Bars per ${bucket}`}>
          {rows.map((r, i) => {
            const h = (H * vals[i]) / max;
            return (
              <g key={i}>
                <title>{`${label(r.key)}: ${formatValue(r.value, valueType)}`}</title>
                <rect x={i * bw + 2} y={H - h} width={Math.max(2, bw - 4)} height={h} rx={2} className="fill-primary/70" />
                {(rows.length <= 16 || i % Math.ceil(rows.length / 16) === 0) && (
                  <text x={i * bw + bw / 2} y={H + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                    {label(r.key)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
