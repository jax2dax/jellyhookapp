// components/dashboard/SalesSectionView.tsx
// What the dashboard's sales block shows, from data it is given (./SalesSection.tsx loads it on the server; the dev
// preview passes sample data). No data loading here, so it renders on the server or in the browser alike.
//   Hooked leads   the latest leads a hook caught (call these first)
//   Your marks     each mark that is on, its number of leads and its share of all leads
//   Latest leads   the newest form submissions with their mark badges
import Link from "next/link";
import { ArrowRight, Bookmark, ChevronRight, FishingHook, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HookedLeads } from "@/components/hooks/HookedLeads";
import { MarkDots, type BadgeMark } from "@/components/marks/MarkBadge";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import type { HookedLead } from "@/lib/actions/hooks.action";
import { formatRelativeTime } from "@/lib/leadFormat";

export interface SalesLead {
  id: string;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string;
  badges: { mark: BadgeMark; parts?: string[] }[];
}

export interface SalesData {
  hooked: { ok: true; ready: boolean; leads: HookedLead[] } | { ok: false; error: string };
  /** marks that are on, most leads first */
  marks: { id: string; name: string; color: string; count: number }[];
  latest: SalesLead[];
  /** every lead of the site, for each mark's share */
  totalLeads: number;
}

function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group/see flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      {children} <ArrowRight className="size-3 transition-transform group-hover/see:translate-x-0.5" />
    </Link>
  );
}

export function SalesSectionView({ hooked, marks, latest, totalLeads }: SalesData) {
  return (
    <section aria-label="Sales" className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-amber-400/15 text-amber-600 dark:text-amber-400">
                  <FishingHook className="size-3.5" />
                </span>
                Hooked leads
              </CardTitle>
              <CardDescription className="mt-1 text-xs">The latest leads your hooks caught. Start with these.</CardDescription>
            </div>
            <SeeAll href="/platform/hooks">All hooked</SeeAll>
          </CardHeader>
          <CardContent>{hooked.ok ? <HookedLeads leads={hooked.leads} ready={hooked.ready} compact /> : <p className="text-sm text-muted-foreground">{hooked.error}</p>}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Bookmark className="size-3.5" />
                </span>
                Your marks
              </CardTitle>
              <CardDescription className="mt-1 text-xs">Leads with each mark that is on.</CardDescription>
            </div>
            <SeeAll href="/platform/marks">Marks</SeeAll>
          </CardHeader>
          <CardContent>
            {!marks.length ? (
              <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                <p className="text-sm text-foreground">No marks are on.</p>
                <p className="mt-1 text-xs text-muted-foreground">A mark badges every lead that did what you choose, like reading your pricing page.</p>
                <Link href="/platform/leads" className="mt-3 inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium text-foreground hover:bg-muted">
                  Make one on Leads <ArrowRight className="size-3" />
                </Link>
              </div>
            ) : (
              <ul className="-mx-2 space-y-0.5">
                {marks.map((m) => {
                  const share = totalLeads > 0 ? Math.min(100, Math.round((m.count / totalLeads) * 100)) : 0;
                  return (
                    <li key={m.id}>
                      <Link href={"/platform/leads?marks=" + m.id} className="group/mark block rounded-md px-2 py-2 transition-colors hover:bg-muted" title={`${m.count} of ${totalLeads} leads (${share}%). Open them on Leads.`}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                          <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                          <span className="tabular-nums font-medium text-foreground">{m.count}</span>
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{share}%</span>
                        </span>
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted group-hover/mark:bg-background">
                          <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${share}%`, backgroundColor: m.color }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UserCheck className="size-3.5" />
              </span>
              Latest leads
            </CardTitle>
            <CardDescription className="mt-1 text-xs">The newest form submissions and the marks they have.</CardDescription>
          </div>
          <SeeAll href="/platform/leads">All leads</SeeAll>
        </CardHeader>
        <CardContent className="px-2">
          {!latest.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No leads yet. They appear here when someone sends one of your forms.</p>
          ) : (
            <ul>
              {latest.map((l, i) => (
                <li key={l.id} className="jh-row-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <Link href={"/platform/leads/" + l.id} className="group/lead flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                    <InitialsAvatar label={l.name || l.email} size="sm" className="size-8 shrink-0 text-[11px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{l.name || l.email || "A lead without a name"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{l.name && l.email ? l.email : "sent on " + (l.page_path ?? "a page")}</span>
                    </span>
                    {l.page_path && <span className="hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground md:inline">{l.page_path}</span>}
                    <span className="flex w-24 shrink-0 justify-end">{l.badges.length > 0 && <MarkDots marks={l.badges} />}</span>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatRelativeTime(l.submitted_at)}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover/lead:text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
