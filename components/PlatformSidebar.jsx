"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// NAV ITEMS — change plan here to adjust gating globally
const NAV = [
  { href: "/platform/dashboard",    label: "Overview",              plan: "free"  },
  { href: "/platform/visitors",     label: "Visitor Journeys",      plan: "pro"   },
  { href: "/platform/intent",       label: "Intent Signals 🔥",     plan: "elite" },
  { href: "/platform/leads",        label: "Leads",                 plan: "pro"   },
  { href: "/platform/conversions",  label: "Conversion Paths",      plan: "pro"   },
  { href: "/platform/acquisition",  label: "Acquisition",           plan: "pro"   },
  { href: "/platform/settings",     label: "Settings",              plan: "free"  },
];

const TIER = { free: 0, pro: 1, elite: 2 };

export default function PlatformSidebar({ userPlan = "free" }) {
  const pathname = usePathname();

  return (
    <div style={{
      width: 220,
      minHeight: "100vh",
      background: "#0a0a0a",
      borderRight: "1px solid #1a1a1a",
      padding: "24px 0",
      fontFamily: "monospace",
      fontSize: 13,
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{ padding: "0 20px 28px", color: "#fff", fontWeight: "bold", fontSize: 15 }}>
        JellyHook
      </div>

      <nav style={{ flex: 1 }}>
        {NAV.map((item) => {
          const locked = (TIER[userPlan] ?? 0) < (TIER[item.plan] ?? 0);
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={locked ? "/platform/subscription" : item.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 20px",
                color: locked ? "#333" : active ? "#fff" : "#888",
                background: active ? "#111" : "transparent",
                borderLeft: active ? "2px solid #4ade80" : "2px solid transparent",
                textDecoration: "none",
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              <span>{item.label}</span>
              {locked && <span style={{ fontSize: 10, color: "#333" }}>{item.plan}</span>}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #1a1a1a" }}>
        <div style={{ color: "#333", fontSize: 11 }}>plan</div>
        <div style={{ color: "#4ade80", fontSize: 12, marginTop: 2 }}>{userPlan}</div>
      </div>
    </div>
  );
}