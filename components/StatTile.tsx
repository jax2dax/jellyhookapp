// components/StatTile.tsx
// Shared stat-card used across the platform pages (dashboard, lead profile,
// etc.) so every "number in a card" looks the same everywhere — same
// typography, same theme tokens, no per-page hardcoded colors.
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Smaller padding/type — these tiles have no reason to be this big on a
   * page (like the dashboard overview) that shows several of them at once. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Icon className="h-3 w-3 shrink-0" /> <span className="truncate">{label}</span>
            </div>
            <p className="text-lg font-bold leading-tight text-foreground">{value}</p>
            {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardDescription className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
          <Icon className="h-3 w-3" /> {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
