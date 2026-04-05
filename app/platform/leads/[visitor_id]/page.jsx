import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeadTimeline, computeLeadScore } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";

export default async function LeadTimelinePage({ params }) {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const timeline = await getLeadTimeline(site.id, params.visitor_id);
  const score = computeLeadScore(timeline);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>Lead Timeline</h1>
      <div style={{ color: "#555", fontSize: 11, marginBottom: 24 }}>visitor: {params.visitor_id}</div>

      <PlanGate userPlan={site.plan} required="elite">
        <div style={{ marginBottom: 16, padding: 16, background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}>
          <span style={{ color: "#555" }}>Lead Score: </span>
          <span style={{ color: score > 30 ? "#4ade80" : "#fb923c", fontSize: 20, fontWeight: "bold" }}>{score}</span>
        </div>

        <div style={{ borderLeft: "2px solid #1a1a1a", paddingLeft: 24 }}>
          {timeline.map((step, i) => (
            <div key={i} style={{ marginBottom: 20, position: "relative" }}>
              <div style={{
                position: "absolute", left: -30, top: 4,
                width: 10, height: 10, borderRadius: "50%",
                background: step.time_on_page > 30000 ? "#4ade80" : "#333",
              }} />
              <div style={{ color: "#7dd3fc", fontSize: 13 }}>{step.page_path}</div>
              <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>
                {step.entered_at ? new Date(step.entered_at).toLocaleTimeString() : "—"}
                {step.time_on_page ? ` · ${(step.time_on_page / 1000).toFixed(1)}s` : ""}
                {step.scroll_depth != null ? ` · ${Math.round(step.scroll_depth * 100)}% scroll` : ""}
              </div>
            </div>
          ))}
        </div>
      </PlanGate>
    </div>
  );
}