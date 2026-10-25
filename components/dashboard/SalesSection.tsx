// components/dashboard/SalesSection.tsx
// The sales part of the dashboard (founder 2026-10-24: "a dashboard more focused on sales"): who to call first.
//   Hooked leads   the latest leads a hook caught (Hooks page)
//   Your marks     each active mark with how many leads have it; a click shows those leads on the Leads page
//   Latest leads   the newest form submissions with their mark badges
// Server component; reads through the same actions as the Hooks and Leads pages.
import Link from "next/link";
import { ArrowRight, Bookmark, FishingHook, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HookedLeads } from "@/components/hooks/HookedLeads";
import { MarkDots } from "@/components/marks/MarkBadge";
import { loadHookedLeads } from "@/lib/actions/hooks.action";
import { loadMarks } from "@/lib/actions/marks.action";
import { formatRelativeTime } from "@/lib/leadFormat";

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string;
}

export async function SalesSection({ leads }: { leads: LeadRow[] }) {
  const latest = leads.slice(0, 8);
  const [hooked, marks] = await Promise.all([loadHookedLeads(6), loadMarks({ leadIds: latest.map((l) => l.id) })]);
  const active = marks.ok ? marks.marks.filter((m) => m.active) : [];
  const markOf = new Map(active.map((m) => [m.id, m]));
  const badges = (leadId: string) =>
    marks.ok
      ? marks.leadMarks
          .filter((lm) => lm.leadId === leadId && markOf.has(lm.markId))
          .map((lm) => ({ mark: { id: lm.markId, name: markOf.get(lm.markId)!.name, color: markOf.get(lm.markId)!.color }, parts: lm.parts }))
      : [];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FishingHook className="size-4 text-amber-500" /> Hooked leads
              </CardTitle>
              <CardDescription>The latest leads your hooks caught: call these first.</CardDescription>
            </div>
            <Link href="/platform/hooks" className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              All <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent>{hooked.ok ? <HookedLeads leads={hooked.leads} ready={hooked.ready} compact /> : <p className="text-sm text-muted-foreground">{hooked.error}</p>}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bookmark className="size-4" /> Your marks
              </CardTitle>
              <CardDescription>How many leads have each mark.</CardDescription>
            </div>
            <Link href="/platform/marks" className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Marks <ArrowRight className="size-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!active.length ? (
              <p className="text-sm text-muted-foreground">
                No marks switched on. <Link href="/platform/leads" className="text-primary hover:underline">Make one on the Leads page</Link>.
              </p>
            ) : (
              <ul className="space-y-1">
                {active.map((m) => (
                  <li key={m.id}>
                    <Link href={"/platform/leads?marks=" + m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                      <span className="tabular-nums text-muted-foreground">{m.matchCount ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" /> Latest leads
            </CardTitle>
            <CardDescription>The newest form submissions and the marks they earned.</CardDescription>
          </div>
          <Link href="/platform/leads" className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            All leads <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {!latest.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No leads yet. They appear here when someone sends one of your forms.</p>
          ) : (
            <ul className="divide-y">
              {latest.map((l) => {
                const b = badges(l.id);
                return (
                  <li key={l.id}>
                    <Link href={"/platform/leads/" + l.id} className="flex items-center gap-3 px-1 py-2.5 hover:bg-muted/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{l.name || l.email || "A lead without a name"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {l.name && l.email ? l.email + " · " : ""}
                          {l.page_path ?? ""}
                        </span>
                      </span>
                      {b.length > 0 && <MarkDots marks={b} />}
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{formatRelativeTime(l.submitted_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
