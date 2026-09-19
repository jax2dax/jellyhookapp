// components/PlanGate.jsx
// Wraps any section. If plan is insufficient, blurs content and shows upgrade banner.
// Usage: <PlanGate required="pro" userPlan={site.plan}>{children}</PlanGate>
// Returns: children if plan passes, locked overlay if not
// Params:
//   required: "free" | "pro" | "elite"
//   userPlan: "free" | "pro" | "elite"
//   children: React.ReactNode

import Link from "next/link";
import { Button } from "@/components/ui/button";

const TIER = { free: 0, pro: 1, elite: 2 };
const LABEL_BY_TIER = ["free", "pro", "elite"];

export default function PlanGate({ required = "free", userPlan = "free", sitePlan = "free", children }) {
  // Effective access = whichever is HIGHER: the person's own Clerk subscription,
  // or the plan the site itself is on. Either one being high enough unlocks it.
  const userTier = TIER[userPlan] ?? 0;
  const siteTier = TIER[sitePlan] ?? 0;
  const effectiveTier = Math.max(userTier, siteTier);
  const effectivePlan = LABEL_BY_TIER[effectiveTier] ?? "free";

  const hasAccess = effectiveTier >= (TIER[required] ?? 0);

  if (hasAccess) return <>{children}</>;

  // Locked — blur children and show upgrade banner on top
  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="pointer-events-none blur-md select-none">{children}</div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/70">
        <div className="text-center text-sm text-foreground">
          🔒 {required.charAt(0).toUpperCase() + required.slice(1)} plan required
          <div className="mt-1 text-xs text-muted-foreground">
            your plan: {effectivePlan} (user: {userPlan}, site: {sitePlan})
          </div>
        </div>
        <Button asChild>
          <Link href="/platform/subscription">Upgrade →</Link>
        </Button>
      </div>
    </div>
  );
}
