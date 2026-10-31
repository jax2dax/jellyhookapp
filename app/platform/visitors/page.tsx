// app/platform/visitors/page.tsx
// Visitors who have not sent a form (or everyone), like the Leads table: last seen, country, device, where they came
// from, visits and how far a form got. A row opens what Jellyhook knows about that visitor. Any active member of the
// site may open it. Data: lib/visitors/load.ts. Design: mds/build/visitors.md.
import Link from "next/link";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { loadVisitorList, VISITOR_LIST_LIMIT } from "@/lib/visitors/load";
import { countryName } from "@/lib/visitors/country";
import { formatRelativeTime } from "@/lib/leadFormat";

export const dynamic = "force-dynamic";

const FORM_LABEL = { started: "Started a form", abandoned: "Left a form", submitted: "Sent a form" } as const;

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  const site = (await requireSite(user.id)) as { id: string };
  const filter = (await searchParams)?.show === "all" ? "all" : "anonymous";
  const { rows, error } = await loadVisitorList(site.id, filter);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Visitors</h1>
          <p className="text-sm text-muted-foreground">
            {filter === "anonymous" ? "People who have not sent a form" : "Everyone, leads included"}, newest first, up to {VISITOR_LIST_LIMIT}. Open a row to see what Jellyhook knows about them.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5 text-xs">
          {(["anonymous", "all"] as const).map((f) => (
            <Link key={f} href={f === "all" ? "/platform/visitors?show=all" : "/platform/visitors"} className={`rounded px-2.5 py-1 ${filter === f ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "anonymous" ? "Anonymous" : "Everyone"}
            </Link>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && rows.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No visitors yet.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Visitor</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Came from</th>
                <th className="px-3 py-2 font-medium">First page</th>
                <th className="px-3 py-2 text-right font-medium">Visits</th>
                <th className="px-3 py-2 font-medium">Form</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.visitorId} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/platform/visitors/${encodeURIComponent(r.visitorId)}`} className="font-mono text-xs font-medium text-foreground hover:underline" title={r.visitorId}>
                      {r.visitorId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatRelativeTime(r.lastSeen)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{countryName(r.country)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{[r.device, r.browser].filter(Boolean).join(" · ") || "–"}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={r.source ?? ""}>
                    {r.source || "Direct"}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={r.landing ?? ""}>
                    {r.landing || "–"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.visits}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{r.form ? FORM_LABEL[r.form] : <span className="text-muted-foreground">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
