'use server';
import { createSupabaseClient } from '@/lib/supabase/server';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface PageViewRelative {
  relativeTimeSec: number;
  pagePath: string;
  enteredAt: Date;
}

interface LeadPathData {
  leadId: string;
  leadName?: string;
  leadEmail?: string;
  conversionTime: Date;
  session: Record<string, unknown>;
  pageViews: PageViewRelative[];
}

interface ConversionPathsResult {
  globalMinX: number;
  globalMaxX: number;
  uniquePagePaths: string[];
  leads: LeadPathData[];
}

interface GetConversionPathsParams {
  siteId: string;
  formSubmissionIds?: string[] | null;
  startDate?: Date | null;
  endDate?: Date | null;
  beforeSeconds?: number | 'auto';
  afterSeconds?: number;
}

export async function getConversionPaths({
  siteId,
  formSubmissionIds = null,
  startDate = null,
  endDate = null,
  beforeSeconds = 120,
  afterSeconds = 30,
}: GetConversionPathsParams): Promise<ConversionPathsResult> {
  console.log('[getConversionPaths] Start', { siteId, beforeSeconds, afterSeconds });

  const supabase = await createSupabaseClient();

  // ── 1. Fetch form submissions ─────────────────────────────────────
  let query = supabase
    .from('form_submissions')
    .select('id, created_at, name, email, session_id, page_path')
    .eq('site_id', siteId);

  if (formSubmissionIds?.length) query = query.in('id', formSubmissionIds);
  if (startDate) query = query.gte('created_at', startDate.toISOString());
  if (endDate) query = query.lte('created_at', endDate.toISOString());

  const { data: submissions, error: subError } = await query;

  if (subError) throw new Error(`Failed to fetch form submissions: ${subError.message}`);
  if (!submissions?.length) {
    return {
      globalMinX: beforeSeconds === 'auto' ? -120 : -Math.abs(beforeSeconds as number),
      globalMaxX: afterSeconds,
      uniquePagePaths: [],
      leads: [],
    };
  }

  const sessionIds = submissions.map((s) => s.session_id).filter(Boolean) as string[];
  if (!sessionIds.length) {
    return {
      globalMinX: beforeSeconds === 'auto' ? -120 : -Math.abs(beforeSeconds as number),
      globalMaxX: afterSeconds,
      uniquePagePaths: [],
      leads: [],
    };
  }

  // ── 2. Fetch sessions ─────────────────────────────────────────────
  const { data: sessions, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .in('session_id', sessionIds);

  if (sessError) throw new Error(`Failed to fetch sessions: ${sessError.message}`);

  const sessionMap = new Map<string, Record<string, unknown>>(
    (sessions ?? []).map((s) => [s.session_id as string, s as Record<string, unknown>])
  );

  // ── 3. Fetch ALL page views for these sessions, sorted by entered_at ──
  const { data: pageViews, error: pvError } = await supabase
    .from('page_views')
    .select('session_id, page_path, entered_at')
    .in('session_id', sessionIds)
    .order('entered_at', { ascending: true });

  if (pvError) throw new Error(`Failed to fetch page views: ${pvError.message}`);

  // Group page views by session_id
  const pageViewsBySession = new Map<
    string,
    { session_id: string; page_path: string; entered_at: string }[]
  >();
  for (const pv of pageViews ?? []) {
    const sid = pv.session_id as string;
    if (!pageViewsBySession.has(sid)) pageViewsBySession.set(sid, []);
    pageViewsBySession.get(sid)!.push(
      pv as { session_id: string; page_path: string; entered_at: string }
    );
  }

  // ── 4. Build lead paths ───────────────────────────────────────────
  const leadsData: LeadPathData[] = [];
  const effectiveMin: number =
    beforeSeconds === 'auto' ? -Infinity : -Math.abs(beforeSeconds as number);
  const effectiveMax: number = afterSeconds;

  for (const sub of submissions) {
    const conversionTime = new Date(sub.created_at);
    const conversionMs = conversionTime.getTime();

    const rawPageViews = pageViewsBySession.get(sub.session_id) ?? [];

    // Convert to relative seconds and sort chronologically
    const allRelative: PageViewRelative[] = rawPageViews
  .map((pv) => {
    // Force UTC parsing — entered_at has no timezone in DB so Node
    // would treat it as local time. Appending 'Z' forces UTC, matching
    // the conversionTime which comes in as +00.
    const enteredAtUTC = new Date(
      pv.entered_at.endsWith('Z') || pv.entered_at.includes('+')
        ? pv.entered_at
        : pv.entered_at + 'Z'
    );
    return {
      relativeTimeSec: (enteredAtUTC.getTime() - conversionMs) / 1000,
      pagePath: pv.page_path || '/unknown',
      enteredAt: enteredAtUTC,
    };
  })
  .sort((a, b) => a.relativeTimeSec - b.relativeTimeSec);

    // ── CRITICAL FIX: only keep views that happened BEFORE conversion ──
    // relativeTimeSec < 0 means before the form submit.
    // We also apply the beforeSeconds window here.
    // We do NOT include views after conversion (relativeTimeSec > 0) in the
    // "last 3 pages" logic — those are post-conversion noise.
    const preConversionViews = allRelative.filter(
      (pv) => pv.relativeTimeSec <= 0 && pv.relativeTimeSec >= effectiveMin
    );

    // Add the conversion point itself at t=0
    const conversionPoint: PageViewRelative = {
      relativeTimeSec: 0,
      pagePath: sub.page_path || '/conversion',
      enteredAt: conversionTime,
    };

    // Only add conversion point if not already there (avoid exact duplicate)
    const lastPre = preConversionViews[preConversionViews.length - 1];
    if (!lastPre || lastPre.relativeTimeSec !== 0) {
      preConversionViews.push(conversionPoint);
    }

    // Also include a small window after conversion if requested
    const postConversionViews = allRelative.filter(
      (pv) => pv.relativeTimeSec > 0 && pv.relativeTimeSec <= effectiveMax
    );

    const finalViews = [...preConversionViews, ...postConversionViews];

    leadsData.push({
      leadId: sub.id,
      leadName: sub.name ?? undefined,
      leadEmail: sub.email ?? undefined,
      conversionTime,
      session: sessionMap.get(sub.session_id) ?? {},
      pageViews: finalViews,
    });
  }

  // ── 5. Build unique page path list sorted by frequency ────────────
  const pathFreqMap = new Map<string, number>();
  for (const lead of leadsData) {
    for (const pv of lead.pageViews) {
      pathFreqMap.set(pv.pagePath, (pathFreqMap.get(pv.pagePath) ?? 0) + 1);
    }
  }
  const uniquePagePaths = Array.from(pathFreqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  // Compute actual global min/max from final data
  let globalMin = 0;
  let globalMax = effectiveMax;
  for (const lead of leadsData) {
    for (const pv of lead.pageViews) {
      if (pv.relativeTimeSec < globalMin) globalMin = pv.relativeTimeSec;
      if (pv.relativeTimeSec > globalMax) globalMax = pv.relativeTimeSec;
    }
  }

  console.log('[getConversionPaths] Done', {
    leads: leadsData.length,
    uniquePages: uniquePagePaths.length,
    globalMin,
    globalMax,
  });

  return {
    globalMinX: globalMin,
    globalMaxX: globalMax,
    uniquePagePaths,
    leads: leadsData,
  };
}