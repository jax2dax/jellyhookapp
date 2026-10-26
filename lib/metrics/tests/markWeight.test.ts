// lib/metrics/tests/markWeight.test.ts - how heavy a mark is (lib/metrics/markWeight.ts). Run: npm run test:tracking
import { markWeight } from "../markWeight";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const n = { op: ">=" as const, a: 30 };
const simple = { v: 2, blocks: [{ id: "b1", which: { kind: "converting" }, session: [], pages: { order: "any", steps: [{ id: "s1", path: "/pricing", match: "exact", conds: [], link: "next" }] }, then: [] }], answers: [], form: [] };
const w1 = markWeight(simple);
ok(w1.visits === 1 && w1.pages === 1 && w1.conditions === 1, "the simplest mark (visited /pricing): 1 visit, 1 page, 1 condition");

const heavy = {
  v: 2,
  blocks: [
    {
      id: "b1",
      which: { kind: "any" },
      session: [{ id: "c1", kind: "duration", n }, { id: "c2", kind: "pages", n }],
      pages: {
        order: "sequence",
        steps: [
          { id: "s1", path: "/", match: "exact", conds: [{ id: "p1", kind: "time", n }], link: "next" },
          { id: "s2", path: "/pricing", match: "exact", conds: [{ id: "p2", kind: "seen", n }, { id: "p3", kind: "views", n }], link: "later" },
        ],
      },
      then: [{ id: "b2", which: { kind: "later" }, session: [{ id: "c3", kind: "duration", n }], pages: null, then: [] }],
    },
  ],
  answers: [{ id: "a1", field: "budget", name: "Budget", kind: "number", n }],
  form: [{ id: "f1", kind: "fillTime", n }, { id: "f2", kind: "errors", n }],
};
const w2 = markWeight(heavy);
ok(w2.visits === 2 && w2.pages === 2 && w2.conditions === 2 + 2 + 1 + 2 + 1 + 1 + 2, `a heavy mark: ${w2.visits} visits, ${w2.pages} pages, ${w2.conditions} conditions`);

const old = { chips: [{ kind: "page", path: "/pricing" }, { kind: "time", op: ">=", value: 30 }] };
ok(markWeight(old).conditions === 2, "an older mark: its conditions are counted");
ok(markWeight(null).conditions === 0 && markWeight("x").conditions === 0, "no rule: nothing");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
