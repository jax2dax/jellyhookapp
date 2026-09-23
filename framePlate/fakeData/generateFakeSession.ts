// framePlate/fakeData/generateFakeSession.ts
//
// Produces realistic-looking SessionRaw fixtures for developing the chart
// before real tracking data is wired in. Uses a seeded RNG so the same seed
// always reproduces the same session — useful for visually comparing theme
// changes without the data shifting under you.
import type { PageVisitRaw, ScrollSample, SessionRaw } from "../types";

// mulberry32 — tiny, deterministic PRNG (no crypto needed for fixtures)
function makeRng(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min);
}

const SAMPLE_PATHS = ["/", "/pricing", "/features", "/blog/post-1", "/join-us", "/deals", "/offers", "/contact", "/about"];

/** Generates a believable scroll trace for one page visit. */
function generateScrollTrace(rng: () => number, durationMs: number, revisitChance = 0.35): { trace: ScrollSample[]; maxY: number } {
  const sampleCount = Math.max(2, Math.round(durationMs / 1500)); // ~1 sample per 1.5s
  const enterY = rng() < 0.1 ? randRange(rng, 0.1, 0.3) : 0; // occasional mid-page entry (anchor link)
  const targetMax = randRange(rng, 0.3, 1);
  const willRevisit = rng() < revisitChance;

  const trace: ScrollSample[] = [{ t: 0, y: enterY }];
  let y = enterY;
  let maxY = enterY;

  const descendSamples = willRevisit ? Math.ceil(sampleCount * 0.5) : sampleCount - 1;
  for (let i = 1; i <= descendSamples; i++) {
    y = Math.min(targetMax, y + randRange(rng, 0.05, 0.25));
    maxY = Math.max(maxY, y);
    trace.push({ t: Math.round((i / sampleCount) * durationMs), y });
  }

  if (willRevisit) {
    // scroll back up partway, then back down past the previous max
    const backUpTo = Math.max(0, y - randRange(rng, 0.2, 0.5));
    y = backUpTo;
    trace.push({ t: Math.round((descendSamples / sampleCount) * durationMs) + 1, y });

    for (let i = descendSamples + 1; i < sampleCount; i++) {
      y = Math.min(1, y + randRange(rng, 0.08, 0.3));
      maxY = Math.max(maxY, y);
      trace.push({ t: Math.round((i / sampleCount) * durationMs), y });
    }
  }

  // exit position: usually near the last scroll position, sometimes scrolls up a bit before leaving
  const exitY = rng() < 0.2 ? Math.max(0, y - randRange(rng, 0.1, 0.3)) : y;
  trace.push({ t: durationMs, y: exitY });

  return { trace, maxY };
}

function makeVisit(
  rng: () => number,
  id: string,
  pagePath: string,
  enteredAtMs: number,
  durationMs: number,
  converted = false,
  pageHeightRange: [number, number] = [900, 4200],
  revisitChance = 0.35
): PageVisitRaw {
  const { trace } = generateScrollTrace(rng, durationMs, revisitChance);
  const pageHeightPx = Math.round(randRange(rng, pageHeightRange[0], pageHeightRange[1]));
  return {
    id,
    pagePath,
    enteredAt: new Date(enteredAtMs).toISOString(),
    leftAt: new Date(enteredAtMs + durationMs).toISOString(),
    pageHeightPx,
    scrollTrace: trace,
    converted,
    headers:
      rng() < 0.6
        ? [
            { text: "H1", y: randRange(rng, 0.02, 0.1) },
            { text: "H2", y: randRange(rng, 0.3, 0.6) },
          ]
        : undefined,
  };
}

export interface GenerateFakeSessionOptions {
  seed?: number;
  visitCount?: number;
  /** appends a trailing conversion page visit */
  withConversion?: boolean;
  /** inserts an "away and came back" gap partway through the session */
  withAwayGap?: boolean;
  /** [min,max] px for randomly generated page heights */
  pageHeightRange?: [number, number];
  /** chance [0-1] that a given visit scrolls down, back up, then down again */
  revisitChance?: number;
  /** [min,max] ms for randomly generated visit durations */
  durationRangeMs?: [number, number];
  /** session hasn't ended yet — endedAt is null, and the last visit renders as "live" */
  live?: boolean;
}

export function generateFakeSession(options: GenerateFakeSessionOptions = {}): SessionRaw {
  const {
    seed = 42,
    visitCount = 6,
    withConversion = true,
    withAwayGap = true,
    pageHeightRange = [900, 4200],
    revisitChance = 0.35,
    durationRangeMs = [8_000, 200_000],
    live = false,
  } = options;
  const rng = makeRng(seed);

  const sessionStart = Date.now() - 1000 * 60 * 30; // started 30 min ago
  let cursor = sessionStart;
  const visits: PageVisitRaw[] = [];

  for (let i = 0; i < visitCount; i++) {
    const path = SAMPLE_PATHS[Math.floor(rng() * SAMPLE_PATHS.length)];
    const durationMs = Math.round(randRange(rng, durationRangeMs[0], durationRangeMs[1]));
    visits.push(makeVisit(rng, `visit-${i}`, path, cursor, durationMs, false, pageHeightRange, revisitChance));
    cursor += durationMs;

    if (withAwayGap && i === Math.floor(visitCount / 2)) {
      cursor += Math.round(randRange(rng, 20_000, 90_000)); // wandered off, came back
    }
  }

  if (withConversion) {
    const durationMs = Math.round(randRange(rng, 15_000, 60_000));
    visits.push(makeVisit(rng, `visit-conversion`, "/join-us", cursor, durationMs, true, pageHeightRange, revisitChance));
    cursor += durationMs;
  }

  return {
    id: `session-${seed}`,
    visitorId: `visitor-${seed}`,
    startedAt: new Date(sessionStart).toISOString(),
    endedAt: live ? null : new Date(cursor).toISOString(),
    visits,
  };
}

/**
 * The exact scenario described in the spec: nine pages at 5-10s, one
 * outlier at 5 minutes. Use this to sanity-check scaleFrameWidths visually —
 * the nine should render at close to the same width, and the outlier should
 * grow noticeably without dwarfing the rest.
 */
export function generateOutlierTestSession(seed = 7): SessionRaw {
  const rng = makeRng(seed);
  const sessionStart = Date.now() - 1000 * 60 * 10;
  let cursor = sessionStart;
  const visits: PageVisitRaw[] = [];

  for (let i = 0; i < 9; i++) {
    const durationMs = Math.round(randRange(rng, 5_000, 10_000));
    visits.push(makeVisit(rng, `outlier-test-${i}`, SAMPLE_PATHS[i % SAMPLE_PATHS.length], cursor, durationMs));
    cursor += durationMs;
  }

  const outlierDurationMs = 5 * 60_000 + 40_000; // 5m40s
  visits.push(makeVisit(rng, "outlier-test-9", "/blog/post-1", cursor, outlierDurationMs));
  cursor += outlierDurationMs;

  return {
    id: `session-outlier-${seed}`,
    visitorId: `visitor-outlier-${seed}`,
    startedAt: new Date(sessionStart).toISOString(),
    endedAt: new Date(cursor).toISOString(),
    visits,
  };
}
