// lib/metrics/markWeight.ts
// How heavy a mark is, for the control room: how many visits, pages and conditions it asks about. Pure. A v2 mark
// (jh-marks/v2/rule.ts) is counted exactly; an older mark by the condition-like objects in its rule. This is a
// description of the rule, not its measured cost: the measured cost is in pipeline_runs (lib/metrics/runs.ts).
import { isRuleV2, type Block, type MarkRuleV2 } from "../../jh-marks/v2/rule";

export interface MarkWeight {
  /** visit blocks, "then" blocks included */
  visits: number;
  /** page steps across the visits */
  pages: number;
  /** every condition: on visits, on pages, on answers, on the form */
  conditions: number;
}

function blocks(bs: Block[], w: MarkWeight): void {
  for (const b of bs) {
    w.visits += 1;
    w.conditions += b.session.length;
    for (const s of b.pages?.steps ?? []) {
      w.pages += 1;
      w.conditions += 1 + s.conds.length; // the page itself is a condition, then its own
    }
    blocks(b.then, w);
  }
}

export function markWeight(rule: unknown): MarkWeight {
  const w: MarkWeight = { visits: 0, pages: 0, conditions: 0 };
  if (isRuleV2(rule)) {
    const r = rule as MarkRuleV2;
    blocks(r.blocks, w);
    w.conditions += r.answers.length + r.form.length;
    return w;
  }
  // an older rule: count the objects that carry a condition (anything with an op, a kind or a path)
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("op" in o || "kind" in o || "path" in o) w.conditions += 1;
      Object.values(o).forEach(walk);
    }
  };
  walk(rule);
  return w;
}
