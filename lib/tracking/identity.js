// lib/tracking/identity.js
// One person, one visitor (mds/migrations/19-visitor-aliases.sql). The tracker mints a visitor id per browser storage, so
// one person in several private windows, or in a browser that blocks storage, arrives as several ids. /api/track merges a
// NEW id into a visitor who arrived earlier today from the same IP and browser and never sent a form (the SQL function
// jh_resolve_visitor) and records the alias. The other routes (the form and the form engagement) only need to look an id up.
// Before the migration has run the table does not exist: every function then returns the id as sent, so nothing breaks.

/** The visitor (or session: the alias table holds both, ids never collide) an id counts as: itself, or what it was
 *  merged into. One indexed lookup; never throws. */
export async function canonicalVisitorId(supabase, siteId, visitorId) {
  if (!visitorId) return visitorId;
  try {
    const { data, error } = await supabase.from("visitor_aliases").select("visitor_id").eq("site_id", siteId).eq("alias_id", visitorId).maybeSingle();
    if (error) return visitorId;
    return data?.visitor_id || visitorId;
  } catch {
    return visitorId;
  }
}
