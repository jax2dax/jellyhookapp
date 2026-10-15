// app/dev/form-dashboard-demo/fakeData.ts
// FAKE form rows for the dashboard demo: one contact form changed twice. Seeded random, so the page is the same on every
// load. The rows are in the real form_engagement shape; the demo runs them through the real version rule, the real
// dashboard assembly and the real averages, nothing is precomputed here. About 6% of people get stuck on one field
// (six times the usual time), so "unusual" has something to find.
//  - layout 1 (from 08/25): name, email, job title, phone (required), company, budget, message
//  - layout 2 (from 09/03): job title removed
//  - layout 3 (10/11 09:00): phone made optional; layout 3b (10/11 15:00, same day): budget removed too
import type { EngagementRow, FieldTiming, FormFieldDef } from "@/jh-forms/timeline";

const F = (key: string, type: string, required: boolean): FormFieldDef => ({ key, type, required });
const L1 = [F("name", "text", true), F("email", "email", true), F("custom:job_title", "text", false), F("phone", "tel", true), F("custom:company", "text", false), F("custom:budget", "select", false), F("custom:message", "textarea", true)];
const L2 = L1.filter((f) => f.key !== "custom:job_title");
const L3 = L2.map((f) => (f.key === "phone" ? { ...f, required: false } : f));
const L3b = L3.filter((f) => f.key !== "custom:budget");

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = rng(42);
const around = (ms: number) => Math.round(ms * (0.55 + r() * 0.9)); // a spread around a typical value
const iso = (t: number) => new Date(t).toISOString();

/** typical [time in field, before typing] per field and layout era: phone is slow while it is required */
const BASE: Record<string, [number, number]> = {
  name: [5000, 1100], email: [8000, 1500], "custom:job_title": [7000, 2600], phone: [14000, 4200],
  "custom:company": [6000, 1600], "custom:budget": [4000, 0], "custom:message": [28000, 3500],
};
const BASE_OPTIONAL_PHONE: [number, number] = [9000, 2000];

let n = 0;
function makeRow(at: number, layout: FormFieldDef[], status: string): EngagementRow {
  n++;
  const ft: Record<string, FieldTiming> = {};
  const autofill = status !== "viewed" && r() < 0.15;
  const stuckOn = status !== "viewed" && r() < 0.06 ? layout[Math.floor(r() * layout.length)].key : null;
  let lastKey = null as string | null;
  let t = at + around(6000); // the form is on screen, then the first click
  const firstInput = t;
  const used = status === "viewed" ? [] : status === "submitted" ? layout : layout.slice(0, 1 + Math.floor(r() * (layout.length - 1)));
  used.forEach((f, i) => {
    if (!f.required && r() < (f.key === "phone" ? 0.3 : 0.2)) return; // optional fields get skipped
    const auto = autofill && (f.key === "name" || f.key === "email");
    const [focus, hes] = auto ? [300, 0] : f.key === "phone" && !f.required ? BASE_OPTIONAL_PHONE : BASE[f.key];
    const len = auto ? 300 : around(focus) * (f.key === stuckOn ? 6 : 1);
    lastKey = f.key;
    const k = f.type === "select" || auto ? null : Math.min(len - 200, around(hes));
    const visits: [string, string, number][] = [[iso(t), iso(t + len), k === null ? 0 : 1]];
    let total = len;
    t += len;
    if (!auto && f.key === "email" && r() < 0.1) { // came back to fix the email
      const back = t + 1500;
      visits.push([iso(back), iso(back + 2500), 1]);
      total += 2500;
    }
    ft[f.key] = { order: i + 1, totalFocusedMs: total, firstFocusAt: visits[0][0], firstKeydownAt: k === null ? null : iso(Date.parse(visits[0][0]) + k), lastUnfocusAt: visits[visits.length - 1][1], visits, filled: true, edits: 1 };
    t = Math.max(t, Date.parse(visits[visits.length - 1][1]));
    t += r() < 0.35 ? 2000 + Math.round(r() * 6000) : 150 + Math.round(r() * 600); // a pause, or straight on
  });
  return {
    id: "row" + n, session_id: "sess" + n, page_path: n % 4 === 0 ? "/demo" : "/contact", status, form_key: "id:contact",
    last_field_type: lastKey ? (lastKey.startsWith("custom:") ? "custom" : lastKey) : null, last_field_key: lastKey?.startsWith("custom:") ? lastKey.slice(7) : null,
    viewed_at: iso(at), first_input_at: status === "viewed" ? null : iso(firstInput),
    ended_at: status === "submitted" || status === "abandoned" ? iso(t) : null,
    field_timings: ft, form_fields: layout, onscreen_before_start_ms: status === "viewed" ? null : around(4000),
  };
}

/** rows of one era: `started` forms (a share submitted) plus some only seen, spread evenly from `from` to `to` */
function era(from: number, to: number, layout: (i: number) => FormFieldDef[], started: number, submitted: number, viewedOnly: number) {
  const out: EngagementRow[] = [];
  const total = started + viewedOnly;
  const subIdx = new Set<number>();
  while (subIdx.size < submitted) subIdx.add(Math.floor(r() * started));
  for (let i = 0; i < total; i++) {
    const at = from + Math.round(((i + 0.5) / total) * (to - from));
    const status = i >= started ? "viewed" : subIdx.has(i) ? "submitted" : r() < 0.9 ? "abandoned" : "started";
    out.push(makeRow(at, layout(i), status));
  }
  return out.sort((a, b) => Date.parse(a.viewed_at!) - Date.parse(b.viewed_at!));
}

const d = (s: string) => Date.parse(s + "T00:00:00Z");
export const fakeRows: EngagementRow[] = [
  ...era(d("2026-08-25"), d("2026-09-03") - 1, () => L1, 22, 5, 30),
  ...era(d("2026-09-03"), d("2026-10-11"), () => L2, 300, 81, 340),
  ...[0, 1, 2, 3].map((i) => makeRow(d("2026-10-11") + 9 * 3600_000 + i * 3600_000, L3, i === 1 ? "submitted" : "abandoned")),
  ...era(d("2026-10-11") + 15 * 3600_000, d("2026-10-15") + 12 * 3600_000, () => L3b, 146, 47, 150),
];
