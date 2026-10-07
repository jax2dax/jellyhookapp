// lib/leadSessions/structureRows.js
// Reads page structure for session replay, as ALL versions of each page.
//
// Returns rows in the old page_structure shape (header_index, header_text,
// header_tag, position_y, page_height, page_path) so existing callers keep
// working, plus the version they belong to (version_id, device_class,
// first_seen_at). lib/leadSessions/transform.js groups them back into
// versions and picks the one a visit was recorded under.
//
// Falls back to the old overwrite-in-place table when no versions exist yet
// (before the 2026-10-07 migration, or for a page never captured since).

/** One versions-table row -> one legacy-shaped row per header. Pure. */
export function expandVersionsToRows(versions) {
  const rows = [];
  for (const v of versions || []) {
    const headers = Array.isArray(v.headers) ? v.headers : [];
    for (const h of headers) {
      rows.push({
        site_id: v.site_id,
        page_path: v.page_path,
        page_height: v.page_height,
        header_index: h.i,
        header_text: h.text,
        header_tag: h.tag,
        position_y: h.y,
        version_id: v.id,
        device_class: v.device_class,
        first_seen_at: v.first_seen_at,
      });
    }
  }
  return rows;
}

/**
 * @param {any} supabase a client allowed to read the structure tables
 * @param {string} siteId
 * @param {string[]} pagePaths
 * @returns {Promise<any[]>}
 */
export async function fetchStructureRows(supabase, siteId, pagePaths) {
  if (!siteId || !Array.isArray(pagePaths) || pagePaths.length === 0) return [];

  const { data: versions, error } = await supabase
    .from("page_structure_versions")
    .select("id, site_id, page_path, device_class, headers, page_height, first_seen_at")
    .eq("site_id", siteId)
    .in("page_path", pagePaths);

  const rows = error ? [] : expandVersionsToRows(versions);
  const have = new Set(rows.map((r) => r.page_path));
  const missing = pagePaths.filter((p) => !have.has(p));
  if (error) console.error("[structureRows] versions fetch error:", error.message);
  if (missing.length === 0) return rows;

  // Pages with no version yet: the legacy table (single, current structure).
  const { data: legacy, error: legacyError } = await supabase.from("page_structure").select("*").eq("site_id", siteId).in("page_path", missing);
  if (legacyError) console.error("[structureRows] page_structure fetch error:", legacyError.message);
  return [...rows, ...(legacy || [])];
}
