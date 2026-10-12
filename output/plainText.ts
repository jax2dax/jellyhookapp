// output/plainText.ts
// The result of a hook as plain text, for pasting into a chat or a bug report. For every session it lists, per
// page visit, the RAW numbers the tracker recorded (enter and leave times, page and viewport height, every scroll
// sample, form status) and the numbers the chart derived from them (seen range, enter and exit position, outcome).
// Nothing here is drawn from the picture: it is the data behind it, so "where did this visit get in and out" can be
// answered from text. Pure functions, no network.
import { deriveVisitGeometry } from "../framePlate/geometry/deriveVisitGeometry";
import type { PageVisitRaw } from "../framePlate/types";
import { formatDate, formatValue } from "./format";
import type { CanvasView, SessionCard } from "./types";

const pct = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : (n * 100).toFixed(1) + "%");

function visitText(v: PageVisitRaw, i: number, deviceType: string | null, highlighted: boolean): string[] {
  const dur = Math.max(0, new Date(v.leftAt).getTime() - new Date(v.enteredAt).getTime());
  const out = [
    `  visit ${i + 1}: ${v.pagePath}${highlighted ? "   [matched the hook]" : ""}`,
    `    entered ${v.enteredAt}   left ${v.leftAt}   (${(dur / 1000).toFixed(1)} s)${v.isOpen ? "   still open" : ""}`,
    `    page height ${v.pageHeightPx} px   viewport height ${v.viewportHeightPx ?? "not recorded"}${v.viewportHeightPx ? "" : " (estimated)"}`,
    `    converted ${v.converted ? "yes" : "no"}   form: ${v.formStatus ?? "none seen"}${v.formFieldCount != null ? `, ${v.formFieldCount} field(s) focused` : ""}${v.formTopY != null ? `, form at ${v.formTopY}-${v.formBottomY} px` : ""}${v.abandonedForm ? ", ABANDONED" : ""}`,
  ];
  const trace = v.scrollTrace ?? [];
  out.push(`    scroll samples (${trace.length}) as [ms since entry, scroll 0-1 of the scrollable range]: ${trace.length ? trace.map((s) => `[${Math.round(s.t)},${+s.y.toFixed(3)}]`).join(" ") : "none recorded"}`);
  try {
    const g = deriveVisitGeometry(v, deviceType === "mobile" ? 800 : 900);
    out.push(
      `    derived: entered at ${pct(g.enterY)} of the page, left at ${pct(g.exitY)}, deepest viewport top ${pct(g.maxScrollY)}, saw ${pct(g.seenOnceTop)} to ${pct(g.seenBottom)}` +
        `${g.seenTwiceTop !== null ? `, saw twice from ${pct(g.seenTwiceTop)}` : ""}${g.viewportEstimated ? " (viewport estimated)" : ""}, outcome ${g.outcome}`,
    );
  } catch {
    out.push("    derived: could not be computed for this visit");
  }
  if (v.headers?.length) out.push(`    headings: ${v.headers.map((h) => `${JSON.stringify(h.text)}@${pct(h.y)}`).join("  ")}`);
  return out;
}

export function sessionText(card: SessionCard, n?: number): string {
  const s = card.session;
  const hl = new Set(card.highlight);
  const head = `${n ? `Session ${n}: ` : "Session: "}${formatDate(s.startedAt)}   device ${card.deviceType ?? "unknown"}   ${s.visits.length} page visit(s)   ${s.endedAt ? `ended ${s.endedAt}` : "still open"}`;
  const lines = [head, `  started ${s.startedAt}   session id ${s.id}   visitor id ${s.visitorId}`];
  if (card.reason) lines.push(`  why it is here: ${card.reason}`);
  s.visits.forEach((v, i) => lines.push(...visitText(v, i, card.deviceType, hl.has(v.id))));
  return lines.join("\n");
}

/** The whole answer of a hook as text. */
export function canvasText(view: CanvasView, hookSentence?: string): string {
  const head = hookSentence ? [`Hook: ${hookSentence}`] : [];
  switch (view.kind) {
    case "number":
      return [...head, `Answer: ${formatValue(view.value, view.type)}`, view.sentence].join("\n");
    case "ranking":
    case "timeSeries":
      return [...head, view.sentence, ...view.rows.map((r) => `${r.key ?? "(none)"}: ${r.value}`)].join("\n");
    case "values":
      return [...head, view.sentence, ...view.values].join("\n");
    case "sessions":
      return [...head, `${view.total} session(s). ${view.sentence}`, "", ...view.items.map((c, i) => sessionText(c, i + 1) + "\n")].join("\n");
    case "leads":
      return [
        ...head,
        `${view.total} lead(s). ${view.sentence}`,
        "",
        ...view.items.map((l, i) => [`Lead ${i + 1}: ${l.name ?? ""} ${l.email ?? ""} submitted ${l.submittedAt ?? "?"} on ${l.page ?? "?"}`, ...l.sessions.map((c) => sessionText(c))].join("\n") + "\n"),
      ].join("\n");
    case "visitors":
      return [
        ...head,
        `${view.total} visitor(s). ${view.sentence}`,
        "",
        ...view.items.map((v, i) => [`Visitor ${i + 1}: ${v.device ?? "?"} ${v.browser ?? ""} first seen ${v.firstSeen ?? "?"} last seen ${v.lastSeen ?? "?"} sessions ${v.sessionsCount}`, ...v.sessions.map((c) => sessionText(c))].join("\n") + "\n"),
      ].join("\n");
    case "pages":
      return [...head, view.sentence, ...view.items.map((p) => `${p.path}: ${p.views} view(s), ${p.submissions} submission(s)`)].join("\n");
    case "forms":
      return [...head, view.sentence, ...view.items.map((f) => `${f.page ?? "?"}: ${f.status ?? "?"}, last field ${f.lastField ?? "?"}, fields touched ${f.fieldsTouched}, fill ${f.fillMs ?? "?"} ms, viewed ${f.viewedAt ?? "?"}`)].join("\n");
    case "formFields":
      return [...head, view.sentence, ...view.items.map((f) => `${f.page ?? "?"} / ${f.field} (${f.fieldType}): focused ${f.focusedMs ?? "?"} ms, typed ${f.typed ? "yes" : "no"}${f.lastTouched ? ", last touched" : ""}, form ${f.formStatus ?? "?"}`)].join("\n");
    case "compare":
      return [...head, `A: ${view.a.sentence} = ${view.a.value}`, `B: ${view.b.sentence} = ${view.b.value}`, `${view.resultLabel}: ${view.result}`].join("\n");
  }
}
