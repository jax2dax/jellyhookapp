import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getAcquisitionSources } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";

export default async function AcquisitionPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const sources = await getAcquisitionSources(site.id);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 24 }}>Acquisition Intelligence</h1>
      <PlanGate userPlan={site.plan} required="pro">
        <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr",
            padding: "6px 16px", background: "#111", color: "#555", fontSize: 11,
            borderBottom: "1px solid #1a1a1a",
          }}>
            <div>Source</div><div>Sessions</div>
          </div>
          {sources.map((s) => (
            <div key={s.source} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr",
              padding: "8px 16px", borderBottom: "1px solid #111", fontSize: 12,
            }}>
              <span style={{ color: "#7dd3fc" }}>{s.source}</span>
              <span>{s.sessions}</span>
            </div>
          ))}
        </div>
      </PlanGate>
    </div>
  );
}