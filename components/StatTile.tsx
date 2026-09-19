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
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
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
