// lib/ai/ledger.ts
// The AI request ledger and the limits built on it. Server only; service role (the table has no policy, so
// the browser can never read it). See mds/migrations/2026-10-08-ai-requests.sql and
// mds/build/ai-hook-translate/ledger-and-limits.md.
//
// Limits are read from the ledger itself, so they hold across servers and restarts:
//   AI_DAILY_QUESTIONS  questions per person per UTC day (default 20)
//   AI_DAILY_USD_CAP    dollars the whole product may spend on AI per UTC day (default 25): the wallet guard
// If the ledger cannot be read, the answer is "not available" and the model is NOT called: an unmetered AI
// call is how a bill runs away, so the feature fails closed.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { TranslateTrace } from "@/jh-ai/types";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const DAILY_QUESTIONS = () => positive(process.env.AI_DAILY_QUESTIONS, 20);
export const DAILY_USD_CAP = () => positive(process.env.AI_DAILY_USD_CAP, 25);

function positive(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const startOfUtcDay = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString();

export type Quota =
  | { ok: true; usedToday: number; limitToday: number }
  | { ok: false; reason: "user_limit" | "product_cap" | "unavailable"; usedToday: number; limitToday: number };

export async function checkQuota(userId: string): Promise<Quota> {
  const limit = DAILY_QUESTIONS();
  const since = startOfUtcDay();
  const [mine, spend] = await Promise.all([
    admin.from("ai_requests").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    admin.from("ai_requests").select("cost_usd").gte("created_at", since).limit(50_000),
  ]);
  if (mine.error || spend.error) {
    console.error("[ai] ledger unreadable, refusing the request:", (mine.error ?? spend.error)?.message);
    return { ok: false, reason: "unavailable", usedToday: 0, limitToday: limit };
  }
  const used = mine.count ?? 0;
  const usd = (spend.data ?? []).reduce((s, r) => s + Number((r as { cost_usd: number }).cost_usd || 0), 0);
  if (usd >= DAILY_USD_CAP()) return { ok: false, reason: "product_cap", usedToday: used, limitToday: limit };
  if (used >= limit) return { ok: false, reason: "user_limit", usedToday: used, limitToday: limit };
  return { ok: true, usedToday: used, limitToday: limit };
}

export interface LedgerRow {
  userId: string;
  siteId: string | null;
  status: "ok" | "clarify" | "unsupported" | "failed" | "error";
  trace: TranslateTrace | null;
  model: string;
  credits: number;
  questionChars: number;
  /** Only stored when AI_LOG_PAIRS=1. */
  question?: string;
  spec?: unknown;
}

/** Writes one row. Never throws: a ledger hiccup must not turn a good answer into an error (it is logged loudly). */
export async function recordRequest(r: LedgerRow): Promise<void> {
  const logPairs = process.env.AI_LOG_PAIRS === "1";
  const { error } = await admin.from("ai_requests").insert({
    user_id: r.userId,
    site_id: r.siteId,
    feature: "hook_translate",
    model: r.model,
    status: r.status,
    attempts: r.trace?.attempts ?? 0,
    input_tokens: r.trace?.usage.inputTokens ?? 0,
    cached_tokens: r.trace?.usage.cachedTokens ?? 0,
    output_tokens: r.trace?.usage.outputTokens ?? 0,
    cost_usd: r.trace?.costUsd ?? 0,
    credits: r.credits,
    latency_ms: r.trace?.latencyMs ?? null,
    question_chars: r.questionChars,
    first_error: r.trace?.firstError?.slice(0, 300) ?? null,
    ...(logPairs ? { question: r.question?.slice(0, 600) ?? null, spec: r.spec ?? null } : {}),
  });
  if (error) console.error("[ai] could not write the ledger row:", error.message);
}
