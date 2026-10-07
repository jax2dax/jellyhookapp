// lib/leadSessions/resolveStructure.js
// Which version of a page's structure applies to a visit. Pure, and
// browser-safe (no Node imports): used by lib/leadSessions/transform.js on
// both sides.
//
// A visit uses, in order:
//   1. the exact version the tracker linked it to (page_views.structure_id);
//   2. else the newest version of the same device class that existed when the
//      visit happened (first_seen_at <= entered_at);
//   3. else the oldest version of that device class (the visit predates the
//      first capture);
//   4. else the same rules ignoring device class.

/**
 * @param {Array<{id: string, page_path: string, device_class: string, first_seen_at: string}>} versions all versions of ONE page
 * @param {{ structure_id?: string | null, entered_at?: string | null, device_class?: string | null }} pageView
 */
export function resolveStructureVersion(versions, pageView) {
  if (!versions || versions.length === 0) return null;
  if (pageView?.structure_id) {
    const exact = versions.find((v) => v.id === pageView.structure_id);
    if (exact) return exact;
  }
  const at = pageView?.entered_at ? new Date(pageView.entered_at).getTime() : Infinity;
  const pick = (list) => {
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => new Date(a.first_seen_at).getTime() - new Date(b.first_seen_at).getTime());
    let chosen = null;
    for (const v of sorted) {
      if (new Date(v.first_seen_at).getTime() <= at) chosen = v;
      else break;
    }
    return chosen ?? sorted[0];
  };
  const wanted = pageView?.device_class === "mobile" ? "mobile" : "desktop";
  return pick(versions.filter((v) => v.device_class === wanted)) ?? pick(versions);
}
