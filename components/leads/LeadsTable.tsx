// components/leads/LeadsTable.tsx
//
// Client-side search + date filter for the /platform/leads table. All leads
// are fetched once server-side (see app/platform/leads/page.jsx) and
// filtered here in the browser — fine for the volume a single site
// generates today. This is explicitly a stopgap: a bigger, real filtering
// system ("Hook") is planned to replace it later, so keep this simple
// rather than building out pagination/server-side search for it now.
"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalDate } from "@/components/LocalDate";
import { LeadQualifyToggle } from "./LeadQualifyToggle";

export interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string | null;
  qualified: boolean | null;
}

type DateFilter = "today" | "all" | "custom";
type QualifyFilter = "all" | "qualified" | "junk" | "unreviewed";

// Local calendar day, not UTC — matches how a person reading "today" on
// their own dashboard actually thinks about it.
function isSameLocalDay(isoString: string, day: Date): boolean {
  const d = new Date(isoString);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LeadsTable({ leads, siteId }: { leads: LeadRow[]; siteId: string }) {
  const [query, setQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("today");
  const [customDate, setCustomDate] = React.useState(() => toDateInputValue(new Date()));
  const [qualifyFilter, setQualifyFilter] = React.useState<QualifyFilter>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        const matchesName = (lead.name || "").toLowerCase().includes(q);
        const matchesEmail = (lead.email || "").toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }
      if (dateFilter === "today") {
        if (!lead.submitted_at || !isSameLocalDay(lead.submitted_at, new Date())) return false;
      } else if (dateFilter === "custom") {
        const [y, m, d] = customDate.split("-").map(Number);
        if (!lead.submitted_at || !isSameLocalDay(lead.submitted_at, new Date(y, m - 1, d))) return false;
      }
      // "all" — no date filtering
      if (qualifyFilter === "qualified" && lead.qualified !== true) return false;
      if (qualifyFilter === "junk" && lead.qualified !== false) return false;
      if (qualifyFilter === "unreviewed" && lead.qualified !== null) return false;
      return true;
    });
  }, [leads, query, dateFilter, customDate, qualifyFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
        >
          <option value="today">Today</option>
          <option value="custom">Custom date</option>
          <option value="all">All time</option>
        </select>
        {dateFilter === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
          />
        )}
        <select
          value={qualifyFilter}
          onChange={(e) => setQualifyFilter(e.target.value as QualifyFilter)}
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
        // Capped height + internal scroll instead of the table stretching
        // the page as far as it has to — the gradient overlay is a visual
        // "there's more below" cue, not a functional scroll indicator on
        // its own (overflow-y-auto is what actually enables scrolling).
        <div className="relative">
          <div className="max-h-120 overflow-y-auto rounded-md border">
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
                  <TableRow key={lead.id}>
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-linear-to-t from-card to-transparent" />
        </div>
      )}
    </div>
  );
}
