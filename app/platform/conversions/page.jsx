import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getConversionPaths } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";

export default async function ConversionsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const paths = await getConversionPaths(site.id);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 24 }}>Conversion Paths</h1>
      <PlanGate userPlan={site.plan} required="pro">
        {paths.length === 0 && <div style={{ color: "#333" }}>No conversions yet.</div>}
        {paths.map((p, i) => (
          <div key={i} style={{
            padding: 16, marginBottom: 12,
            background: "#111", border: "1px solid #1a1a1a", borderRadius: 8,
          }}>
            <div style={{ color: "#7dd3fc", fontSize: 12, marginBottom: 6 }}>{p.path}</div>
            <div style={{ color: "#4ade80", fontSize: 11 }}>{p.conversions} conversion{p.conversions !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </PlanGate>
    </div>
  );
}