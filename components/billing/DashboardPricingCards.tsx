// components/billing/DashboardPricingCards.tsx
// Custom plan cards for the in-app /platform/subscription page — replaces
// Clerk's <PricingTable /> with cards built from this dashboard's own
// shadcn tokens (primary/card/border), so they sit inside the sidebar shell
// without clashing with light/dark mode the way a hardcoded lime/black
// marketing card would. Same glow/accent-bar language as the marketing
// version (components/marketing/PricingCards.tsx) and the same
// site-vs-personal scope toggle, just themed for here. Preview-only:
// pricing isn't live yet, so these buttons don't charge anyone anything.
"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRICING_TIERS, type PlanScope } from "@/lib/pricing/tiers";

export function DashboardPricingCards() {
  const [scope, setScope] = React.useState<PlanScope>("site");

  return (
    <div>
      <div className="mb-6 inline-flex gap-1 rounded-md border border-border bg-muted/40 p-1">
        {(["site", "personal"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
              scope === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "site" ? "Upgrade this site" : "Upgrade just me"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const option = tier.scopes?.find((o) => o.scope === scope);
          return (
            <Card
              key={tier.name}
              className="group relative overflow-hidden transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_40px_-16px_var(--primary)]"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    Free now
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{tier.blurb}</p>

                <ul className="mt-4 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="select-none text-foreground blur-[5px]">{f}</span>
                    </li>
                  ))}
                </ul>

                {option && (
                  <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="select-none blur-[5px]">{option.note}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
