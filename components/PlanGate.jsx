// PlanGate — wraps any section that needs a plan
// Shows lock UI instead of content if plan insufficient
// Never redirects — user stays on page, sees what free gives them
export default function PlanGate({ userPlan, required, children }) {
  const TIER = { free: 0, pro: 1, elite: 2 };
  const hasAccess = (TIER[userPlan] ?? 0) >= (TIER[required] ?? 0);

  if (!hasAccess) {
    return (
      <div style={{
        padding: 32,
        border: "1px solid #1a1a1a",
        borderRadius: 8,
        textAlign: "center",
        background: "#0d0d0d",
        color: "#555",
        fontFamily: "monospace",
      }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          Requires <span style={{ color: "#fff" }}>{required}</span> plan
        </div>
        <div style={{ fontSize: 11, marginBottom: 16, color: "#333" }}>
          Upgrade to unlock this feature
        </div>
        <a href="/platform/subscription" style={{
          padding: "6px 18px",
          background: "#4ade80",
          color: "#000",
          borderRadius: 6,
          fontSize: 12,
          textDecoration: "none",
          fontWeight: "bold",
        }}>
          Upgrade
        </a>
      </div>
    );
  }

  return <>{children}</>;
}