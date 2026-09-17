// components/PlanGate.jsx
// Wraps any section. If plan is insufficient, blurs content and shows upgrade banner.
// Usage: <PlanGate required="pro" userPlan={site.plan}>{children}</PlanGate>
// Returns: children if plan passes, locked overlay if not
// Params:
//   required: "free" | "pro" | "elite"
//   userPlan: "free" | "pro" | "elite"
//   children: React.ReactNode

import Link from "next/link";
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
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
      {/* Blurred content — still renders but not readable */}
      <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>

      {/* Upgrade overlay — centered on top of blurred content */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        borderRadius: 8,
        gap: 12,
      }}>
                <div style={{ fontSize: 13, color: "#fff", fontFamily: "monospace" }}>
          🔒 {required.charAt(0).toUpperCase() + required.slice(1)} plan required
          <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
            your plan: {effectivePlan} (user: {userPlan}, site: {sitePlan})
          </div>
        </div>
        <Link
          href="/platform/subscription"
          style={{
            padding: "8px 20px",
            background: "#4ade80",
            color: "#000",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Upgrade →
        </Link>
      </div>
    </div>
  );
}