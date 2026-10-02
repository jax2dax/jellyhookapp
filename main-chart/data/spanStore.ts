// main-chart/data/spanStore.ts
//
// Everything the browser has loaded for one site's main chart: session
// spans and marker-layer events, each keyed by id so overlapping loads and
// live refreshes just overwrite each other. Lives at module level, one store
// per site: switching dashboard pages and coming back reuses what's already
// loaded instead of refetching it. See main-chart/docs/data-flow.md for the
// full fetch lifecycle.
import { getLiveSpanUpdates, getMarkerEvents, getSessionBounds, getSessionSpans, type SpanResponse } from "@/lib/actions/mainChart.action";
import { buildTimeline } from "../engine/buildTimeline";
import type { EventTimeline, MarkerEvent, MarkerLayer, MarkerPayload, SessionSpan, SpanPayload } from "../types";

/** Overlap between consecutive live polls, so nothing touched near the boundary slips between them. */
const POLL_OVERLAP_MS = 30_000;
/** How far past "now" a live load asks for, so a session started a moment after the request still lands in it. */
const LIVE_FETCH_AHEAD_MS = 60 * 60 * 1000;

type Range = [number, number];

/** Parts of [from, to) not yet inside `covered` (sorted, non-overlapping). */
function missingIn(covered: Range[], from: number, to: number): Range[] {
  const out: Range[] = [];
  let cursor = from;
  for (const [a, b] of covered) {
    if (b <= cursor) continue;
    if (a >= to) break;
    if (a > cursor) out.push([cursor, Math.min(a, to)]);
    cursor = Math.max(cursor, b);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push([cursor, to]);
  return out;
}

function withRange(covered: Range[], range: Range): Range[] {
  const all = [...covered, range].sort((x, y) => x[0] - y[0]);
  const merged: Range[] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

function toEvents(payload: MarkerPayload): MarkerEvent[] {
  return payload.ids.map((id, i) => ({ id, t: payload.times[i], label: payload.labels[i] }));
}

export class SpanStore {
  readonly siteId: string;
  private spans = new Map<string, SessionSpan>();
  /** started_at ranges fully loaded, sorted, non-overlapping. A range ending at Infinity is kept current by polling. */
  private covered: Range[] = [];
  /**
   * Left edge of everything that exists. undefined = not asked yet. A site
   * with no sessions at all gets "now", so live polling still starts and
   * its first visitor shows up without a reload.
   */
  firstSessionAt: number | undefined = undefined;
  /** when the most recent session started (kept current by polls); undefined = not asked yet or no sessions */
  lastSessionAt: number | undefined = undefined;
  /** serverClock - browserClock, from the latest response */
  clockSkewMs = 0;
  /** server time the next live poll asks "touched since" (minus overlap) */
  private liveCursor: number | null = null;

  // Marker layers: same idea as spans, kept completely separate from them.
  private markers: Record<MarkerLayer, Map<string, MarkerEvent>> = { conversions: new Map(), teamJoins: new Map() };
  private markerCovered: Record<MarkerLayer, Range[]> = { conversions: [], teamJoins: [] };
  /** per layer: server time its last live update covered up to. Absent = not live (yet). */
  private markerCursor: Partial<Record<MarkerLayer, number>> = {};
  private markerMemo: Partial<Record<MarkerLayer, MarkerEvent[]>> = {};

  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private timelineMemo: { version: number; timeline: EventTimeline } | null = null;
  /** bumps on ANY change, including a request starting/finishing (drives re-renders) */
  version = 0;
  /** bumps only when spans actually change (drives the expensive timeline rebuild) */
  private dataVersion = 0;
  pending = 0;
  error: string | null = null;

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  /** The browser's clock, corrected to the server's. */
  now(): number {
    return Date.now() + this.clockSkewMs;
  }

  timeline(): EventTimeline {
    if (this.timelineMemo?.version !== this.dataVersion) {
      this.timelineMemo = { version: this.dataVersion, timeline: buildTimeline(this.spans.values()) };
    }
    return this.timelineMemo.timeline;
  }

  /** A layer's loaded events, sorted by time. */
  markerEvents(layer: MarkerLayer): MarkerEvent[] {
    let list = this.markerMemo[layer];
    if (!list) {
      list = [...this.markers[layer].values()].sort((a, b) => a.t - b.t);
      this.markerMemo[layer] = list;
    }
    return list;
  }

  /**
   * Start of the loaded stretch that reaches `t`, i.e. the earliest time the
   * chart can draw correctly when its right edge is at `t`. Null if `t`
   * itself isn't loaded yet.
   */
  dataFromFor(t: number): number | null {
    // Before the first session nothing exists, so there's nothing left to load.
    if (this.firstSessionAt !== undefined && t < this.firstSessionAt) return -Infinity;
    for (const [a, b] of this.covered) {
      // Nothing exists before the first session, so a stretch starting there is complete all the way left.
      if (t >= a && t < b) return this.firstSessionAt !== undefined && a <= this.firstSessionAt ? -Infinity : a;
    }
    return null;
  }

  /** True when [from, to) is fully loaded (clamped to the site's first session). */
  isCovered(from: number, to: number): boolean {
    if (this.firstSessionAt === undefined) return false;
    return missingIn(this.covered, Math.max(from, this.firstSessionAt), to).length === 0;
  }

  get size(): number {
    return this.spans.size;
  }

  openIds(): string[] {
    const ids: string[] = [];
    for (const [id, s] of this.spans) if (s.end === null) ids.push(id);
    return ids;
  }

  isLive(): boolean {
    return this.liveCursor !== null;
  }

  private merge(payload: SpanPayload) {
    let changed = false;
    for (let i = 0; i < payload.ids.length; i++) {
      if (this.lastSessionAt === undefined || payload.starts[i] > this.lastSessionAt) this.lastSessionAt = payload.starts[i];
      const prev = this.spans.get(payload.ids[i]);
      if (prev && prev.start === payload.starts[i] && prev.end === payload.ends[i]) continue;
      this.spans.set(payload.ids[i], { start: payload.starts[i], end: payload.ends[i] });
      changed = true;
    }
    // A poll that returns only rows we already have (the usual case on a
    // quiet site) must not trigger a full timeline rebuild.
    if (changed) this.dataVersion++;
  }

  private mergeMarkers(layer: MarkerLayer, payload: MarkerPayload, replace: boolean) {
    if (replace) this.markers[layer] = new Map();
    for (const e of toEvents(payload)) this.markers[layer].set(e.id, e);
    delete this.markerMemo[layer];
  }

  private noteServerTime(res: { serverNow: number }) {
    this.clockSkewMs = res.serverNow - Date.now();
  }

  /** Jobs run one at a time, so overlapping requests never fetch the same range twice. */
  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    this.pending++;
    this.emit();
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run.finally(() => {
      this.pending--;
      this.emit();
    });
  }

  private fail(err: unknown) {
    console.error(`[main-chart] load failed for site ${this.siteId}:`, err);
    this.error = (err as Error)?.message || "Failed to load sessions";
  }

  private async loadBounds() {
    if (this.firstSessionAt !== undefined) return;
    const res = await getSessionBounds(this.siteId);
    this.noteServerTime(res);
    this.firstSessionAt = res.firstSessionAt ?? res.serverNow;
    if (res.lastSessionAt !== null && (this.lastSessionAt === undefined || res.lastSessionAt > this.lastSessionAt)) this.lastSessionAt = res.lastSessionAt;
  }

  /** First and latest session times, fetched once (the chart needs them to pick its opening view). */
  ensureBounds(): Promise<void> {
    if (this.firstSessionAt !== undefined) return Promise.resolve();
    return this.enqueue(async () => {
      try {
        await this.loadBounds();
      } catch (err) {
        this.fail(err);
      }
    });
  }

  /**
   * Make sure every session needed to draw [from, to) is loaded. A range
   * reaching "now" (to = Infinity) also switches on live polling for it.
   */
  ensureRange(from: number, to: number): Promise<void> {
    return this.enqueue(async () => {
      try {
        await this.loadBounds();
        const start = Math.max(from, this.firstSessionAt as number);
        for (const [a, b] of missingIn(this.covered, start, to)) {
          const live = b === Infinity;
          const fetchTo = live ? this.now() + LIVE_FETCH_AHEAD_MS : b;
          const res: SpanResponse = await getSessionSpans(this.siteId, a, fetchTo);
          this.noteServerTime(res);
          this.merge(res.payload);
          this.covered = withRange(this.covered, [a, b]);
          if (live && this.liveCursor === null) this.liveCursor = res.serverNow;
        }
        this.error = null;
      } catch (err) {
        this.fail(err);
      }
    });
  }

  /**
   * Make sure a marker layer's events for [from, to) are loaded, fetching
   * only the parts never loaded before. Team joins are a handful of rows,
   * so the first call loads the whole list and later calls fetch nothing.
   */
  ensureMarkers(layer: MarkerLayer, from: number, to: number): Promise<void> {
    return this.enqueue(async () => {
      try {
        if (layer === "teamJoins") {
          if (this.markerCovered.teamJoins.length) return;
          const res = await getMarkerEvents(this.siteId, layer, 0, 0);
          this.noteServerTime(res);
          this.mergeMarkers(layer, res.payload, true);
          this.markerCovered.teamJoins = [[-Infinity, Infinity]];
          this.markerCursor.teamJoins = res.serverNow;
          return;
        }
        for (const [a, b] of missingIn(this.markerCovered[layer], from, to)) {
          const live = b === Infinity;
          const res = await getMarkerEvents(this.siteId, layer, a, live ? this.now() + LIVE_FETCH_AHEAD_MS : b);
          this.noteServerTime(res);
          this.mergeMarkers(layer, res.payload, false);
          this.markerCovered[layer] = withRange(this.markerCovered[layer], [a, b]);
          if (live && this.markerCursor[layer] === undefined) this.markerCursor[layer] = res.serverNow;
        }
        this.error = null;
      } catch (err) {
        this.fail(err);
      }
    });
  }

  /**
   * One live refresh: new/closed/reopened sessions, every span still held as
   * open, and any switched-on marker layer, all in ONE server call. Each
   * layer catches up from its own cursor, so a layer that was switched off
   * for a while still gets everything it missed when it's switched back on.
   */
  poll(markerLayers: MarkerLayer[] = []): Promise<void> {
    if (this.liveCursor === null) return Promise.resolve();
    return this.enqueue(async () => {
      try {
        const markerSince: Partial<Record<MarkerLayer, number>> = {};
        for (const layer of markerLayers) {
          const cursor = this.markerCursor[layer];
          if (cursor !== undefined) markerSince[layer] = cursor - POLL_OVERLAP_MS;
        }
        const res = await getLiveSpanUpdates(this.siteId, (this.liveCursor as number) - POLL_OVERLAP_MS, this.openIds(), markerSince);
        this.noteServerTime(res);
        this.merge(res.payload);
        this.liveCursor = res.serverNow;
        for (const [layer, payload] of Object.entries(res.markers) as [MarkerLayer, MarkerPayload][]) {
          // The team list comes back whole, so it replaces (removed members disappear); conversions merge by id.
          this.mergeMarkers(layer, payload, layer === "teamJoins");
          this.markerCursor[layer] = res.serverNow;
        }
        this.error = null;
      } catch (err) {
        this.fail(err);
      }
    });
  }
}

const stores = new Map<string, SpanStore>();

export function storeFor(siteId: string): SpanStore {
  // During server rendering: a throwaway store. Nothing is ever loaded on the
  // server, and registering it would keep one per site in server memory, shared across requests.
  if (typeof window === "undefined") return new SpanStore(siteId);
  let store = stores.get(siteId);
  if (!store) {
    store = new SpanStore(siteId);
    stores.set(siteId, store);
  }
  return store;
}
