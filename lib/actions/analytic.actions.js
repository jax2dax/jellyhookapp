//lib/analytics.action
import { createSupabaseClient } from '@/lib/supabase/server';

/**
 * STEP 1: Get the session that contains a specific form submission.
 * @param {string} formSubmissionId - UUID of form_submission
 * @param {string} siteId - UUID of the site
 * @returns {Promise<Object|null>} Session row or null if not found.
 * @throws Will throw an error if Supabase query fails.
 */
export async function getSessionWindowByFormSubmission(formSubmissionId, siteId) {
  console.log(`[getSessionWindowByFormSubmission] Start for submission ${formSubmissionId}`);
  const supabase = await createClient();

  // 1. Fetch the form submission to get its created_at and session_id
  const { data: submission, error: subError } = await supabase
    .from('form_submissions')
    .select('created_at, session_id')
    .eq('id', formSubmissionId)
    .eq('site_id', siteId)
    .single();

  if (subError) {
    console.error('[getSessionWindowByFormSubmission] Submission fetch failed:', subError);
    throw new Error(`Failed to fetch submission: ${subError.message}`);
  }
  if (!submission) {
    console.warn(`[getSessionWindowByFormSubmission] No submission found for id ${formSubmissionId}`);
    return null;
  }
  console.log(`[getSessionWindowByFormSubmission] Submission found, session_id = ${submission.session_id}`);

  // 2. Fetch the session using session_id
  const { data: session, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', submission.session_id)
    .single();

  if (sessError) {
    console.error('[getSessionWindowByFormSubmission] Session fetch failed:', sessError);
    throw new Error(`Failed to fetch session: ${sessError.message}`);
  }
  if (!session) {
    console.warn(`[getSessionWindowByFormSubmission] No session found for session_id ${submission.session_id}`);
    return null;
  }

  console.log(`[getSessionWindowByFormSubmission] Success: session from ${session.started_at} to ${session.ended_at || session.last_activity_at}`);
  return session;
}

/**
 * STEP 2: Get all page views within a session and organise into DEMO_DATA shape.
 * @param {string} siteId
 * @param {string[]} formSubmissionIds - optional, if not provided fetch all leads in date range
 * @param {Date|null} startDate - optional filter
 * @param {Date|null} endDate - optional filter
 * @param {number|'auto'} beforeSeconds - fixed seconds before conversion or 'auto' (use earliest page)
 * @param {number} afterSeconds - fixed seconds after conversion
 * @returns {Promise<Object>} Object matching ConversionPathsResult (globalMinX, globalMaxX, uniquePagePaths, leads)
 */
export async function getConversionPaths({
  siteId,
  formSubmissionIds = null,
  startDate = null,
  endDate = null,
  beforeSeconds = 120,
  afterSeconds = 30,
}) {
  console.log('[getConversionPaths] Start', { siteId, formSubmissionIds, startDate, endDate, beforeSeconds, afterSeconds });
  const supabase = await createClient();

  // ---------------- 1. Fetch form submissions (leads) ----------------
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
    return { globalMinX: -beforeSeconds, globalMaxX: afterSeconds, uniquePagePaths: [], leads: [] };
  }
  console.log(`[getConversionPaths] Found ${submissions.length} leads`);

  // ---------------- 2. Fetch sessions for those leads ----------------
  const sessionIds = submissions.map(s => s.session_id).filter(Boolean);
  const { data: sessions, error: sessError } = await supabase
    .from('sessions')
    .select('*')
    .in('session_id', sessionIds);

  if (sessError) {
    console.error('[getConversionPaths] Sessions fetch error:', sessError);
    throw new Error(`Failed to fetch sessions: ${sessError.message}`);
  }
  const sessionMap = new Map(sessions?.map(s => [s.session_id, s]) || []);

  // ---------------- 3. Fetch all page views for those sessions ----------------
  const { data: pageViews, error: pvError } = await supabase
    .from('page_views')
    .select('session_id, page_path, entered_at')
    .in('session_id', sessionIds)
    .order('entered_at', { ascending: true });

  if (pvError) {
    console.error('[getConversionPaths] Page views fetch error:', pvError);
    throw new Error(`Failed to fetch page views: ${pvError.message}`);
  }
  const pageViewsBySession = new Map();
  for (const pv of pageViews || []) {
    if (!pageViewsBySession.has(pv.session_id)) pageViewsBySession.set(pv.session_id, []);
    pageViewsBySession.get(pv.session_id).push(pv);
  }

  // ---------------- 4. Build lead paths with relative times ----------------
  const leadsData = [];
  let globalMin = 0;
  let globalMax = afterSeconds;

  for (const sub of submissions) {
    const session = sessionMap.get(sub.session_id);
    if (!session) {
      console.warn(`[getConversionPaths] No session for submission ${sub.id}`);
      continue;
    }

    const conversionTime = new Date(sub.created_at);
    const sessionPageViews = pageViewsBySession.get(sub.session_id) || [];

    // Convert each page view to seconds relative to conversionTime
    const relativeViews = sessionPageViews.map(pv => ({
      relativeTimeSec: (new Date(pv.entered_at) - conversionTime) / 1000,
      pagePath: pv.page_path || '/unknown',
      enteredAt: new Date(pv.entered_at),
    }));

    // Add conversion point (time 0)
    relativeViews.push({
      relativeTimeSec: 0,
      pagePath: sub.page_path || '/submission',
      enteredAt: conversionTime,
    });

    leadsData.push({
      leadId: sub.id,
      leadName: sub.name,
      leadEmail: sub.email,
      conversionTime,
      session,
      pageViews: relativeViews,
    });

    // Update global min/max
    for (const pv of relativeViews) {
      if (pv.relativeTimeSec < globalMin) globalMin = pv.relativeTimeSec;
      if (pv.relativeTimeSec > globalMax) globalMax = pv.relativeTimeSec;
    }
  }

  // Apply beforeSeconds window
  let effectiveMin = beforeSeconds === 'auto' ? globalMin : -Math.abs(beforeSeconds);
  let effectiveMax = afterSeconds;

  // Filter each lead's page views to the window
  for (const lead of leadsData) {
    lead.pageViews = lead.pageViews.filter(pv => pv.relativeTimeSec >= effectiveMin && pv.relativeTimeSec <= effectiveMax);
    if (lead.pageViews.length === 0) {
      lead.pageViews.push({ relativeTimeSec: 0, pagePath: '/conversion', enteredAt: lead.conversionTime });
    }
  }

  // Build unique page paths
  const allPaths = new Set();
  for (const lead of leadsData) {
    for (const pv of lead.pageViews) {
      allPaths.add(pv.pagePath);
    }
  }
  const uniquePagePaths = Array.from(allPaths).sort();

  console.log('[getConversionPaths] Success, returning', { leadsCount: leadsData.length, uniquePages: uniquePagePaths.length });
  return {
    globalMinX: effectiveMin,
    globalMaxX: effectiveMax,
    uniquePagePaths,
    leads: leadsData,
  };
}