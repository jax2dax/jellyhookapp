// components/leads/LeadSessionHistory.tsx
// Every session this visitor ever had — including the ones where they
// browsed and left without converting. Expanding a row reveals the
// per-page time-on-page bars for that visit, reusing the same visual
// language as the "path to conversion" chart above it.

"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeadTimeBar } from "@/components/charts/leadTimeBar";
import { formatDate, formatDuration } from "@/lib/leadFormat";

export interface LeadSession {
  sessionId: string;
  visitNumber: number;
  startedAt: string | null;
  durationMs: number | null;
  referrer: string;
  country: string | null;
  converted: boolean;
  pageViews: {
    pagePath: string;
    timeOnPageMs: number;
    scrollDepthPct: number | null;
  }[];
}

export function LeadSessionHistory({ sessions }: { sessions: LeadSession[] }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  if (!sessions.length) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No sessions recorded yet.</div>;
  }

  function toggle(sessionId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Visit</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Pages</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Outcome</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => {
          const isOpen = expanded.has(session.sessionId);
          return (
            <React.Fragment key={session.sessionId}>
              <TableRow className="cursor-pointer" onClick={() => toggle(session.sessionId)} aria-expanded={isOpen}>
                <TableCell>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </TableCell>
                <TableCell className="font-medium">#{session.visitNumber}</TableCell>
                <TableCell>{formatDate(session.startedAt)}</TableCell>
                <TableCell>{formatDuration(session.durationMs)}</TableCell>
                <TableCell>{session.pageViews.length}</TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{session.referrer}{session.country ? ` · ${session.country}` : ""}</TableCell>
                <TableCell className="text-right">
                  {session.converted ? (
                    <Badge>Converted</Badge>
                  ) : (
                    <Badge variant="outline">Left without converting</Badge>
                  )}
                </TableCell>
              </TableRow>
              {isOpen && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-muted/30 py-4">
                    <LeadTimeBar
                      data={session.pageViews.map((pv) => ({
                        label: pv.pagePath,
                        timeMs: pv.timeOnPageMs,
                        scrollDepthPct: pv.scrollDepthPct,
                        highlight: session.converted,
                      }))}
                    />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
