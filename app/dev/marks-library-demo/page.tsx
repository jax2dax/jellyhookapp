// app/dev/marks-library-demo/page.tsx
// DEMO with FAKE data: the marks library (/platform/marks): My marks (own, copy, connected) and Browse. Adding,
// connecting, turning on and saving need a signed-in site and fail here.
import { MarksLibrary } from "@/components/marks/MarksLibrary";
import { catalogMark } from "@/jh-marks/catalog";
import { compileRule, describeRule, validateRule } from "@/jh-marks/rule";
import type { MarksState, MarkView } from "@/lib/actions/marks.action";

const base = { visibility: "private" as const, sharedWith: [], templateKey: null, mine: true, createdByEmail: "you@example.com", createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z", evaluatedAt: null, vars: [], varValues: {}, locked: false };
const own = validateRule({ v: 1, scope: "any", rows: [{ cards: [{ path: "/case-studies", minSeconds: 45 }] }], lead: [] });
const pr = catalogMark("pricing-reader")!;
const prMade = pr.make({ vars: { pricing: "/plans" }, stats: { sessionHighMs: null } });
const marks: MarkView[] = [
  { ...base, id: "a", name: "Case study readers", description: "Read a case study properly: they want proof it works for people like them. Send them a similar story.", color: "#22c55e", active: true, rule: own, spec: compileRule(own), reads: describeRule(own), source: "own", sourceKey: null, matchCount: 6 },
  { ...base, id: "b", name: "Came back", description: catalogMark("came-back")!.purpose, color: "#a855f7", active: false, rule: validateRule({ v: 1, scope: "any", rows: [], lead: [{ kind: "visits", min: 2 }] }), spec: null, reads: "Before sending the form, they visited 2 or more times.", source: "copy", sourceKey: "came-back", matchCount: 11 },
  { ...base, id: "c", name: pr.name, description: pr.purpose, color: pr.color, active: true, rule: "rule" in prMade ? prMade.rule : null, spec: null, reads: "rule" in prMade ? describeRule(prMade.rule) : null, source: "connected", sourceKey: pr.key, vars: pr.vars ?? [], varValues: { pricing: "/plans" }, matchCount: 4 },
];
marks.push({ ...base, id: "d", name: "Big budget", description: "Asked for a quote over 10k.", color: "#f59e0b", active: true, rule: own, spec: null, reads: null, source: "own", sourceKey: null, matchCount: 3, mine: false, createdByEmail: "sara@example.com" });
const state: MarksState = { ok: true, ready: true, me: "user_me", marks, leadMarks: [], team: [], pages: ["/", "/plans", "/contact", "/case-studies"], limit: 5, totalLimit: 15 };

export default function MarksLibraryDemo() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <h1 className="text-lg font-semibold">Marks</h1>
      <MarksLibrary state={state} />
    </div>
  );
}
