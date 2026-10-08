// jh-ai/normalize.ts
// What the model says is untrusted text. This file turns it into a real HookSpec, or says exactly why not.
// It adds what the model should not have to spend tokens on (the version, a unique id per condition), drops
// anything the engine does not read (names, layout, a manual order), and leaves every VALUE untouched:
// whether an operator fits a field is the engine's call (jh-ai/check.ts), not guessed at here.
import type { Condition, HookSpec, Output } from "../jh-hook/types";
import { SPEC_VERSION } from "../jh-hook/types";
import type { ModelAnswer } from "./types";

export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** The model's reply text -> its envelope. Tolerates code fences and text around the JSON. */
export function parseAnswer(text: string): ModelAnswer {
  let raw: unknown;
  const t = text.trim();
  try {
    raw = JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a === -1 || b <= a) throw new AiParseError("the reply was not JSON");
    try {
      raw = JSON.parse(t.slice(a, b + 1));
    } catch {
      throw new AiParseError("the reply was not valid JSON");
    }
  }
  if (!isObj(raw)) throw new AiParseError("the reply was not a JSON object");
  if (raw.status === "ok") {
    if (!isObj(raw.spec)) throw new AiParseError('status "ok" needs a "spec" object');
    const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.filter((x): x is string => typeof x === "string").map((s) => s.slice(0, 200)).slice(0, 5) : undefined;
    return { status: "ok", spec: raw.spec, assumptions };
  }
  if (raw.status === "clarify") {
    if (typeof raw.question !== "string" || !raw.question.trim()) throw new AiParseError('status "clarify" needs a "question"');
    return { status: "clarify", question: raw.question.trim().slice(0, 300) };
  }
  if (raw.status === "unsupported") {
    if (typeof raw.reason !== "string" || !raw.reason.trim()) throw new AiParseError('status "unsupported" needs a "reason"');
    return { status: "unsupported", reason: raw.reason.trim().slice(0, 400) };
  }
  throw new AiParseError('"status" must be "ok", "clarify" or "unsupported"');
}

/** A model-written spec -> a HookSpec with ids and version. Throws AiParseError on a malformed shape. */
export function normalizeSpec(raw: unknown): HookSpec {
  const counter = { n: 0 };
  return normSpec(raw, counter, "query");
}

function normSpec(raw: unknown, counter: { n: number }, where: string): HookSpec {
  if (!isObj(raw)) throw new AiParseError(`${where} must be an object`);
  if (typeof raw.entity !== "string") throw new AiParseError(`${where} needs an "entity"`);
  if (!isObj(raw.output)) throw new AiParseError(`${where} needs an "output"`);
  const whereList = raw.where === undefined ? [] : raw.where;
  if (!Array.isArray(whereList)) throw new AiParseError(`${where}: "where" must be a list`);
  return {
    v: SPEC_VERSION as HookSpec["v"],
    entity: raw.entity as HookSpec["entity"],
    where: whereList.map((c) => normCond(c, counter, where)),
    output: normOutput(raw.output),
  };
}

const pick = (o: Obj, keys: string[]): Obj => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

function normOutput(o: Obj): Output {
  const out = pick(o, ["kind", "field", "agg", "p", "bucket", "sort", "limit"]);
  if (isObj(o.measure)) out.measure = pick(o.measure, ["agg", "field", "p"]);
  return out as unknown as Output;
}

function normValue(v: unknown, counter: { n: number }, where: string): unknown {
  if (isObj(v) && "hook" in v) return { hook: normSpec(v.hook, counter, `${where} sub-query`) };
  return v;
}

function normCond(c: unknown, counter: { n: number }, where: string): Condition {
  if (!isObj(c)) throw new AiParseError(`${where}: a condition must be an object`);
  const id = `c${++counter.n}`;
  const kind = c.kind ?? (c.relation !== undefined ? "related" : c.mode !== undefined ? "group" : c.field !== undefined ? "field" : undefined);
  if (kind === "field") {
    const out: Obj = { id, kind: "field", field: c.field, op: c.op };
    if (c.value !== undefined) out.value = normValue(c.value, counter, where);
    if (c.value2 !== undefined) out.value2 = normValue(c.value2, counter, where);
    return out as unknown as Condition;
  }
  if (kind === "related") {
    const inner = c.where === undefined ? [] : c.where;
    if (!Array.isArray(inner)) throw new AiParseError(`${where}: "where" must be a list`);
    const out: Obj = { id, kind: "related", relation: c.relation, where: inner.map((x) => normCond(x, counter, where)) };
    if (isObj(c.measure)) out.measure = pick(c.measure, ["agg", "field", "p"]);
    if (c.op !== undefined) out.op = c.op;
    if (c.value !== undefined) out.value = normValue(c.value, counter, where);
    if (c.value2 !== undefined) out.value2 = normValue(c.value2, counter, where);
    return out as unknown as Condition;
  }
  if (kind === "group") {
    const inner = c.where === undefined ? [] : c.where;
    if (!Array.isArray(inner)) throw new AiParseError(`${where}: "where" must be a list`);
    const out: Obj = { id, kind: "group", mode: c.mode, where: inner.map((x) => normCond(x, counter, where)) };
    if (c.not === true) out.not = true;
    return out as unknown as Condition;
  }
  throw new AiParseError(`${where}: a condition needs kind "field", "related" or "group"`);
}

/** A spec as the model sees it: no version, no ids, no names or layout. Fewer tokens in, fewer to copy back. */
export function stripForModel(spec: HookSpec | Obj): unknown {
  const s = spec as Obj;
  const strip = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(strip);
    if (isObj(x)) {
      const out: Obj = {};
      for (const [k, v] of Object.entries(x)) {
        if (k === "id" || k === "v" || k === "meta" || k === "ui" || k === "order") continue;
        out[k] = strip(v);
      }
      return out;
    }
    return x;
  };
  return strip(s);
}
