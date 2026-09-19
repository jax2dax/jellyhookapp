// components/SiteSelector.jsx
// Dropdown that lists all user sites and lets them switch.
// Shows current site name, lists others, has "+" to add a new site.
// Writes cookie via switchSite server action, then reloads.
"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { switchSite } from "@/lib/actions/site-management.actions";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function VerifiedDot({ verified }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${verified ? "bg-primary" : "bg-muted-foreground"}`} />;
}

export default function SiteSelector({ sites = [], currentSiteId }) {
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState(null);

  const currentSite = sites.find((s) => s.id === currentSiteId) ?? sites[0] ?? null;

  const handleSwitch = async (siteId) => {
    if (siteId === currentSiteId) return;
    setSwitching(siteId);
    setError(null);
    try {
      const res = await switchSite(siteId);
      if (res.success) {
        // Full reload so all server components re-render with new cookie
        window.location.href = "/platform/dashboard";
      } else {
        setError(res.error);
        setSwitching(null);
      }
    } catch (err) {
      setError(err.message);
      setSwitching(null);
    }
  };

  if (!currentSite) {
    return (
      <a
        href="/platform/create-site"
        className="inline-block rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        + Add site
      </a>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Switch site"
          className="flex w-full min-w-35 max-w-50 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm text-foreground hover:bg-muted/50"
        >
          <VerifiedDot verified={currentSite.verified} />
          <span className="flex-1 truncate">{currentSite.name || currentSite.domain}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-55">
        {sites.map((site) => {
          const isCurrent = site.id === currentSiteId;
          const isLoading = switching === site.id;

          return (
            <DropdownMenuItem
              key={site.id}
              disabled={isLoading || isCurrent}
              onSelect={() => handleSwitch(site.id)}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <VerifiedDot verified={site.verified} />
                <div className="min-w-0">
                  <div className={`truncate text-sm ${isCurrent ? "font-semibold text-primary" : "text-foreground"}`}>{site.name || site.domain}</div>
                  <div className="truncate text-xs text-muted-foreground">{site.domain}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!site.verified && <Badge variant="outline">pending</Badge>}
                {isCurrent && <Badge>active</Badge>}
                {isLoading && <span className="text-xs text-muted-foreground">...</span>}
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/platform/create-site" className="flex items-center gap-2 text-primary">
            <Plus className="h-3.5 w-3.5" />
            <span>Add another site</span>
          </a>
        </DropdownMenuItem>

        {error && <div className="px-2 py-1.5 text-xs text-destructive">{error}</div>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
