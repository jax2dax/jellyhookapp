"use client";
// DEMO with FAKE data: the new mark builder (components/marks/v2). Left: empty (the three buttons). Right: the founder's
// example built in. Server calls (form fields, a page's headings, AI, save) need a signed-in site, so here they come
// back empty or with an error.
import * as React from "react";
import { MarkBuilderV2 } from "@/components/marks/v2/MarkBuilderV2";
import type { BuilderInitial } from "@/components/marks/MarkBuilder";
import type { MarkRuleV2 } from "@/jh-marks/v2/rule";

const base: BuilderInitial = { name: "", description: "", color: "#22c55e", active: true, visibility: "team", sharedWith: [], rule: { v: 2, blocks: [], answers: [], form: [] } };
const example: MarkRuleV2 = {
  v: 2,
  blocks: [
    {
      id: "b1",
      which: { kind: "first" },
      session: [{ id: "s1", kind: "source", value: "google" }],
      pages: null,
      then: [
        {
          id: "b2",
          which: { kind: "later" },
          session: [],
          pages: {
            order: "sequence",
            steps: [
              { id: "p1", path: "/", match: "exact", link: "later", conds: [{ id: "c1", kind: "heading", heading: { key: "k1", text: "What we do", page: "/" }, state: "seen", n: { op: ">", a: 20 } }] },
              { id: "p2", path: "/pricing", match: "exact", link: "next", conds: [{ id: "c2", kind: "heading", heading: { key: "k2", text: "Our offers", page: "/pricing" }, state: "seen", n: { op: ">=", a: 20 } }] },
            ],
          },
          then: [],
        },
      ],
    },
  ],
  answers: [{ id: "a1", field: "custom:field_4", name: "Monthly budget", kind: "number", n: { op: ">", a: 30 } }],
  form: [{ id: "f1", kind: "fieldHesitation", field: "custom:field_4", name: "Monthly budget", n: { op: "<=", a: 3 } }],
};

export default function MarkBuilderDemo() {
  return (
    <div className="space-y-4 p-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-orange-500">Demo, fake data</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <MarkBuilderV2 initial={base} pages={["/", "/pricing", "/contact", "/blogs", "/review"]} team={[]} me="me" onSaved={() => {}} onCancel={() => {}} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <MarkBuilderV2 initial={{ ...base, id: "x", name: "Offer reader", rule: example }} pages={["/", "/pricing", "/contact"]} team={[]} me="me" onSaved={() => {}} onCancel={() => {}} />
        </div>
      </div>
    </div>
  );
}
