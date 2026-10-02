// main-chart/hooks/useSessionsOnlineNow.ts
//
// For anywhere OUTSIDE the chart itself that wants the exact same "how many
// sessions are open right now" number — e.g. a dashboard stat tile — without
// duplicating the chart's live-polling logic or drifting out of sync with it.
//
// Reads from the SAME per-site store MainChart uses (storeFor is a module-
// level singleton keyed by siteId), so if MainChart is also mounted on the
// page, the two numbers are the literal same computation over the literal
// same data — never just "close." This hook also calls ensureRange itself,
// so it works standalone even if MainChart isn't mounted anywhere on the
// page; when both are mounted, the store's "already covered" check (see
// spanStore.ts) means this never causes a second network fetch.
"use client";

import * as React from "react";
import { storeFor } from "../data/spanStore";
import { valueAt } from "../engine/computeSeries";

/** How far back this hook asks for on its own — just enough to seed live polling. */
const SELF_LOAD_WINDOW_MS = 5 * 60_000;

export function useSessionsOnlineNow(siteId: string): number | null {
  const store = React.useMemo(() => storeFor(siteId), [siteId]);
  const [, setTick] = React.useState(0);

  React.useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);

  React.useEffect(() => {
    store.ensureRange(store.now() - SELF_LOAD_WINDOW_MS, Infinity);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [store]);

  if (store.firstSessionAt === undefined) return null; // still loading
  return valueAt(store.timeline(), store.now());
}
