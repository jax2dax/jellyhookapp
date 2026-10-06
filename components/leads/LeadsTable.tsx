// components/leads/LeadsTable.tsx
//
// Client-side search + date + qualify filter for the /platform/leads table.
// All leads are fetched once server-side (see app/platform/leads/page.jsx)
// and filtered here in the browser: fine for the volume a single site
// generates today. (Hook, /platform/hook, is the real filtering system.)
//
// Everything a person chooses lives in the URL, only when it isn't the
// default (lib/urlState.ts): ?q=anna&date=custom&from=2026-10-01&to=2026-10-07&qualify=junk
//   q        search text (name or email)              default: empty
//   date     all | today | custom                      default: all
//   from,to  YYYY-MM-DD, local days (date=custom)
//   qualify  all | qualified | junk | unreviewed       default: all
// So a refresh, the back button or a shared link keep the same view.
//
// A whole row opens the lead (not just the underlined name); the qualify
// toggle inside a row still works on its own. The fade at the bottom shows
// only while there really are more rows below the visible part.
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateRangeField } from "@/components/ui/DateRangeField";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalDate } from "@/components/LocalDate";
import { addDays, formatLocal, parseLocal, startOfDay } from "@/lib/dateLocal";
import { oneOf, useDebouncedUrlText, useUrlState } from "@/lib/urlState";
import { LeadQualifyToggle } from "./LeadQualifyToggle";

export interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string | null;
  qualified: boolean | null;
}

const DATE_FILTERS = ["all", "today", "custom"] as const;
const QUALIFY_FILTERS = ["all", "qualified", "junk", "unreviewed"] as const;

// Local calendar day, not UTC: matches how a person reading "today" on
// their own dashboard actually thinks about it.
function isSameLocalDay(isoString: string, day: Date): boolean {
  const d = new Date(isoString);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export function LeadsTable({ leads, siteId }: { leads: LeadRow[]; siteId: string }) {
  const router = useRouter();
  const [url, setUrl] = useUrlState({ q: "", date: "all", from: "", to: "", qualify: "all" });
  const [text, setText] = useDebouncedUrlText(url.q, (q) => setUrl({ q }));
  const dateFilter = oneOf(url.date, DATE_FILTERS, "all");
  const qualifyFilter = oneOf(url.qualify, QUALIFY_FILTERS, "all");

  // custom range: the calendar works in local day strings; default = the last 7 days
  const from = parseLocal(url.from) ?? startOfDay(addDays(new Date(), -6));
  const to = parseLocal(url.to) ?? new Date();

  const filtered = React.useMemo(() => {
    const q = url.q.trim().toLowerCase();
    const lo = startOfDay(from).getTime();
    const hi = startOfDay(addDays(to, 1)).getTime();
    return leads.filter((lead) => {
      if (q) {
        const matchesName = (lead.name || "").toLowerCase().includes(q);
        const matchesEmail = (lead.email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      if (dateFilter === "today") {
        if (!lead.submitted_at || !isSameLocalDay(lead.submitted_at, new Date())) return false;
      } else if (dateFilter === "custom") {
        if (!lead.submitted_at) return false;
        const t = new Date(lead.submitted_at).getTime();
        if (t < lo || t >= hi) return false;
      }
      if (qualifyFilter === "qualified" && lead.qualified !== true) return false;
      if (qualifyFilter === "junk" && lead.qualified !== false) return false;
      if (qualifyFilter === "unreviewed" && lead.qualified !== null) return false;
      return true;
    });
    // from/to are Dates rebuilt each render; their URL strings are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, url.q, dateFilter, url.from, url.to, qualifyFilter]);

  // The bottom fade: only while rows are hidden below the visible part.
  const scroller = React.useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = React.useState(false);
  const measure = React.useCallback(() => {
    const el = scroller.current;
    setMoreBelow(!!el && el.scrollHeight - el.clientHeight - el.scrollTop > 2);
  }, []);
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, filtered.length]);

  const openLead = (id: string) => router.push(`/platform/leads/${id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={text} onChange={(e) => setText(e.target.value)} className="pl-8" />
        </div>
        <select
          value={dateFilter}
          onChange={(e) => {
            const next = e.target.value as (typeof DATE_FILTERS)[number];
            // choosing "Custom range" seeds the URL with the shown default range, so it is shareable at once
            setUrl(next === "custom" ? { date: next, from: formatLocal(from, false), to: formatLocal(to, false) } : { date: next, from: "", to: "" });
          }}
          aria-label="Date"
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="custom">Custom range</option>
        </select>
        {dateFilter === "custom" && (
          <DateRangeField
            withTime={false}
            start={formatLocal(from, false)}
            end={formatLocal(to, false)}
            onChange={(s, e) => setUrl({ from: s, to: e })}
            max={new Date()}
            className="h-9 text-sm"
            placeholder="Pick a range"
            aria-label="Submitted between"
          />
        )}
        <select
          value={qualifyFilter}
          onChange={(e) => setUrl({ qualify: e.target.value })}
          aria-label="Lead status"
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
        >
          <option value="all">All leads</option>
          <option value="qualified">Qualified</option>
          <option value="junk">Junk</option>
          <option value="unreviewed">Unreviewed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {leads.length === 0 ? "No leads yet. Leads appear when visitors submit forms on your site." : "No leads match this search/date/filter."}
        </div>
      ) : (
        <div className="relative">
          <div ref={scroller} onScroll={measure} className="max-h-120 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Qualify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => (
                  <TableRow
                    key={lead.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    onClick={(e) => {
                      // the qualify toggle and the name link handle their own clicks
                      if ((e.target as HTMLElement).closest("button, a, input, select, [role='button']")) return;
                      openLead(lead.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openLead(lead.id);
                      }
                    }}
                  >
                    <TableCell className="font-medium">
                      <Link href={`/platform/leads/${lead.id}`} className="text-foreground hover:text-primary hover:underline">
                        {lead.name || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.page_path || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <LocalDate value={lead.submitted_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <LeadQualifyToggle siteId={siteId} leadId={lead.id} initialQualified={lead.qualified} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {moreBelow && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-linear-to-t from-card to-transparent" />}
        </div>
      )}
    </div>
  );
}
