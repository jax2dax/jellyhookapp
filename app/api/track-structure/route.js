// api/track-structure/route.js
//
// Page structure (headings + where they sit), VERSIONED. See
// lib/tracking/structure.js for the rules and
// mds/audit/tracker-backend-audit-2026-10-07.md (problem 1) for the why.
//
// The tracker sends what the page looks like now. We fingerprint it:
//   - same fingerprint as a stored version  -> "unchanged": touch last_seen_at
//   - new fingerprint                       -> NEW version row; the old one stays
// and link the page view that reported it (page_views.structure_id), so a
// recorded visit is always drawn with the headings the page really had.
//
// page_structure (the old overwrite-in-place table) is still kept equal to the
// newest DESKTOP version, because several readers only need "the page as it is
// now" (page analysis, intent failure, output engine). Session replay reads
// the versions instead.
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeHeaders, pageHeightOf, fingerprint, deviceClassFromWidth, canCreateVersion } from "@/lib/tracking/structure";
import { emptyUsage, bump } from "@/lib/tracking/usage";
import { CORS, MAX_BODY_BYTES, cleanId, cleanStr, cleanNum, authorizeRequest, applySiteEffects, flushUsage } from "@/lib/tracking/server";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

const ok = () => NextResponse.json({ success: true }, { headers: CORS });

export async function POST(req) {
  const supabase = supabaseAdmin;
  const usage = emptyUsage();
  const now = Date.now();
  try {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: CORS });

    let payload;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
    }
    if (!payload || typeof payload !== "object") return ok();

    const apiKey = payload.api_key || req.headers.get("x-api-key") || null;
    if (!apiKey) return ok();

    const auth = await authorizeRequest(supabase, { apiKey, event: payload, headers: req.headers, now });
    if (!auth.site || !auth.key.ok) return ok();
    const { site, key, decision, host } = auth;

    bump(usage, "requests");
    bump(usage, "bytes_in", len);
    await applySiteEffects(supabase, { site, key, decision, host, now });
    if (!decision.accept) {
      bump(usage, "dropped");
      after(() => flushUsage(supabase, site.id, usage, now));
      return ok();
    }

    const headers = normalizeHeaders(payload.structures);
    const pagePath = cleanStr(payload.page_path, 500);
    if (headers.length === 0 || !pagePath) return ok();
    bump(usage, "structure");

    const pageHeight = pageHeightOf(payload.page_height);
    const deviceClass = deviceClassFromWidth(cleanNum(payload.viewport_width, 1, 20000));
    const fp = fingerprint(headers, pageHeight);
    const nowIso = new Date(now).toISOString();

    const pageViewId = cleanId(payload.page_view_id);

    // ── find or create the version ────────────────────────────────────────
    const keyCols = { site_id: site.id, page_path: pagePath, device_class: deviceClass, fingerprint: fp };
    let versionId = null;
    let isNew = false;

    const { data: existing } = await supabase.from("page_structure_versions").select("id, seen_count").match(keyCols).maybeSingle();
    if (existing) {
      versionId = existing.id;
      await supabase.from("page_structure_versions").update({ last_seen_at: nowIso, seen_count: (existing.seen_count || 0) + 1 }).eq("id", existing.id);
    } else {
      // A structure we have not seen. It becomes a new version unless this page
      // already changes too often (see canCreateVersion): then the visit links
      // to the newest version instead, and nothing grows.
      const { data: newestRows, count } = await supabase
        .from("page_structure_versions")
        .select("id, first_seen_at", { count: "exact" })
        .eq("site_id", site.id).eq("page_path", pagePath).eq("device_class", deviceClass)
        .order("first_seen_at", { ascending: false })
        .limit(1);
      const newest = newestRows?.[0] ?? null;
      if (newest && !canCreateVersion({ count: count ?? 0, newestFirstSeenAt: newest.first_seen_at, now })) {
        versionId = newest.id;
        if (pageViewId) await supabase.from("page_views").update({ structure_id: versionId }).eq("page_view_id", pageViewId).eq("site_id", site.id);
        after(() => flushUsage(supabase, site.id, usage, now));
        return ok();
      }
      const { data: inserted, error } = await supabase
        .from("page_structure_versions")
        .insert({ ...keyCols, headers, page_height: pageHeight, first_seen_at: nowIso, last_seen_at: nowIso })
        .select("id")
        .maybeSingle();
      if (error && error.code === "23505") {
        // Two windows reported the same new structure together; the other one won.
        const { data: again } = await supabase.from("page_structure_versions").select("id").match(keyCols).maybeSingle();
        versionId = again?.id ?? null;
      } else if (error) {
        console.error("[track-structure] version insert error:", error.message);
        return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
      } else {
        versionId = inserted?.id ?? null;
        isNew = true;
      }
    }

    // ── link the page view that reported it ───────────────────────────────
    if (versionId && pageViewId) {
      await supabase.from("page_views").update({ structure_id: versionId }).eq("page_view_id", pageViewId).eq("site_id", site.id);
    }

    // ── keep the legacy "current structure" table equal to the newest desktop version ──
    if (deviceClass === "desktop" && (isNew || !existing)) await syncLegacyTable(supabase, site.id, pagePath, headers, pageHeight);
    else if (deviceClass === "desktop") {
      // Unchanged since a stored version: only re-sync if this version is the newest one
      // (a page that changed and changed back must show its current state).
      const { data: newest } = await supabase.from("page_structure_versions").select("id").eq("site_id", site.id).eq("page_path", pagePath).eq("device_class", "desktop").order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
      if (newest?.id === versionId) await syncLegacyTable(supabase, site.id, pagePath, headers, pageHeight);
    }

    after(() => flushUsage(supabase, site.id, usage, now));
    return ok();
  } catch (err) {
    console.error("[track-structure] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
}

async function syncLegacyTable(supabase, siteId, pagePath, headers, pageHeight) {
  const rows = headers.map((h) => ({
    site_id: siteId,
    page_path: pagePath,
    page_height: pageHeight,
    header_index: h.i,
    header_text: h.text,
    header_tag: h.tag,
    position_y: h.y,
  }));
  const { error } = await supabase.from("page_structure").upsert(rows, { onConflict: "site_id,page_path,header_index", ignoreDuplicates: false });
  if (error) {
    console.error("[track-structure] legacy sync error:", error.message);
    return;
  }
  // The page now has fewer headings than before: drop the leftovers.
  await supabase.from("page_structure").delete().eq("site_id", siteId).eq("page_path", pagePath).gte("header_index", headers.length);
}
