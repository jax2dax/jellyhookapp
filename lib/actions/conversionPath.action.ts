'use server';

import { createSupabaseClient } from '@/lib/supabase/server';

// ------------------------------------------------------------------
// Types (mirror the frontend's ConversionPathsResult)
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

// ------------------------------------------------------------------
// getConversionPaths
// Called by the frontend ConversionPathsChart component.
// Returns a ConversionPathsResult shaped for the Recharts line chart.
// ------------------------------------------------------------------
export async function getConversionPaths({
  siteId,
  formSubmissionIds = null,
  startDate = null,
  endDate = null,
  beforeSeconds = 120,
  afterSeconds = 30,
}: GetConversionPathsParams): Promise<ConversionPathsResult> {
  console.log('[getConversionPaths] Start', {
    siteId,
    formSubmissionIds,
    startDate,
    endDate,
    beforeSeconds,
    afterSeconds,
  });

  // ✅ createSupabaseClient is async — must be awaited
  const supabase = await createSupabaseClient();

  // ── 1. Fetch form submissions (leads) ──────────────────────────────
  let query = supabase
    .from('form_submissions')
    .select('id, created_at, name, email, session_id, page_path')
    .eq('site_id', siteId);

  if (formSubmissionIds && formSubmissionIds.length > 0) {
    query = query.in('id', formSubmissionIds);
  }
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data: submissions, error: subError } = await query;

  if (subError) {
    console.error('[getConversionPaths] Submissions fetch error:', subError);
    throw new Error(`Failed to fetch form submissions: ${subError.message}`);
  }

  if (!submissions || submissions.length === 0) {
    console.warn('[getConversionPaths] No leads found');
    return {
      globalMinX: typeof beforeSeconds === 'number' ? -Math.abs(beforeSeconds) : -120,
      globalMaxX: afterSeconds,
      uniquePagePaths: [],
      leads: [],
    };
  }

  console.log(`[getConversionPaths] Found ${submissions.length} leads`);

  // ── 2. Fetch sessions for those leads ─────────────────────────────
  const sessionIds: string[] = submissions
    .map((s) => s.session_id)
    .filter((id): id is string => Boolean(id));

  // No session IDs at all — return empty
  if (sessionIds.length === 0) {
    console.warn('[getConversionPaths] No session_ids on any submission');
    return {
      globalMinX: typeof beforeSeconds === 'number' ? -Math.abs(beforeSeconds) : -120,
      globalMaxX: afterSeconds,
      uniquePagePaths: [],
      leads: [],
    };
  }

  const { data: sessions, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .in('session_id', sessionIds);

  if (sessError) {
    console.error('[getConversionPaths] Sessions fetch error:', sessError);
    throw new Error(`Failed to fetch sessions: ${sessError.message}`);
  }

  // Build a map: session_id → session row
  const sessionMap = new Map<string, Record<string, unknown>>(
    (sessions ?? []).map((s) => [s.session_id as string, s as Record<string, unknown>])
  );

  // ── 3. Fetch all page views for those sessions ────────────────────
  const { data: pageViews, error: pvError } = await supabase
    .from('page_views')
    .select('session_id, page_path, entered_at')
    .in('session_id', sessionIds)
    .order('entered_at', { ascending: true });

  if (pvError) {
    console.error('[getConversionPaths] Page views fetch error:', pvError);
    throw new Error(`Failed to fetch page views: ${pvError.message}`);
  }

  // Build a map: session_id → page_view[]
  const pageViewsBySession = new Map<
    string,
    { session_id: string; page_path: string; entered_at: string }[]
  >();

  for (const pv of pageViews ?? []) {
    const sid = pv.session_id as string;
    if (!pageViewsBySession.has(sid)) pageViewsBySession.set(sid, []);
    pageViewsBySession.get(sid)!.push(pv as { session_id: string; page_path: string; entered_at: string });
  }

  // ── 4. Build lead paths with times relative to conversion ─────────
  const leadsData: LeadPathData[] = [];
  let globalMin = 0;
  let globalMax = afterSeconds;

  for (const sub of submissions) {
    const session = sessionMap.get(sub.session_id);

    if (!session) {
      console.warn(`[getConversionPaths] No session for submission ${sub.id} (session_id=${sub.session_id})`);
      // Still include the lead with only the conversion point
    }

    const conversionTime = new Date(sub.created_at);
    const sessionPageViews = pageViewsBySession.get(sub.session_id) ?? [];

    // Convert each page view to seconds relative to conversionTime
    const relativeViews: PageViewRelative[] = sessionPageViews.map((pv) => ({
      relativeTimeSec: (new Date(pv.entered_at).getTime() - conversionTime.getTime()) / 1000,
      pagePath: pv.page_path || '/unknown',
      enteredAt: new Date(pv.entered_at),
    }));

    // Always add the conversion point at t=0 (the form submission page)
    relativeViews.push({
      relativeTimeSec: 0,
      pagePath: sub.page_path || '/submission',
      enteredAt: conversionTime,
    });

    // Sort chronologically
    relativeViews.sort((a, b) => a.relativeTimeSec - b.relativeTimeSec);

    leadsData.push({
      leadId: sub.id,
      leadName: sub.name ?? undefined,
      leadEmail: sub.email ?? undefined,
      conversionTime,
      session: session ?? {},
      pageViews: relativeViews,
    });

    // Track global min/max BEFORE windowing
    for (const pv of relativeViews) {
      if (pv.relativeTimeSec < globalMin) globalMin = pv.relativeTimeSec;
      if (pv.relativeTimeSec > globalMax) globalMax = pv.relativeTimeSec;
    }
  }

  // ── 5. Apply time window (beforeSeconds / afterSeconds) ───────────
  const effectiveMin: number =
    beforeSeconds === 'auto' ? globalMin : -Math.abs(beforeSeconds as number);
  const effectiveMax: number = afterSeconds;

  for (const lead of leadsData) {
    lead.pageViews = lead.pageViews.filter(
      (pv) => pv.relativeTimeSec >= effectiveMin && pv.relativeTimeSec <= effectiveMax
    );

    // Always keep at least the conversion point
    if (lead.pageViews.length === 0) {
      lead.pageViews.push({
        relativeTimeSec: 0,
        pagePath: '/conversion',
        enteredAt: lead.conversionTime,
      });
    }
  }

  // ── 6. Build ordered unique page path list ────────────────────────
  // Sort by frequency (most-visited first) for a cleaner Y axis
  const pathFreqMap = new Map<string, number>();
  for (const lead of leadsData) {
    for (const pv of lead.pageViews) {
      pathFreqMap.set(pv.pagePath, (pathFreqMap.get(pv.pagePath) ?? 0) + 1);
    }
  }
  const uniquePagePaths = Array.from(pathFreqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  console.log('[getConversionPaths] Success', {
    leadsCount: leadsData.length,
    uniquePages: uniquePagePaths.length,
    effectiveMin,
    effectiveMax,
  });

  return {
    globalMinX: effectiveMin,
    globalMaxX: effectiveMax,
    uniquePagePaths,
    leads: leadsData,
  };
}