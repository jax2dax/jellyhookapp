// components/dashboard/DashboardHeader.tsx
// The top of the dashboard: the site's name, its domain, whether tracking is on, and the way to the leads.
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function DashboardHeader({ name, domain, active }: { name: string | null; domain: string | null; active: boolean }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{name || domain || "Overview"}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {domain && name && <span className="truncate">{domain}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">
            <span className={"size-1.5 rounded-full " + (active ? "bg-emerald-500" : "bg-muted-foreground")} />
            {active ? "Tracking active" : "Tracking paused"}
          </span>
        </div>
      </div>
      <Link href="/platform/leads" className="group inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
        Open leads <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </header>
  );
}
