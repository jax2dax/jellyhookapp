import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import Link from "next/link";

export default async function LeadsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const leads = await getLeads(site.id);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 24 }}>Leads</h1>
      <PlanGate userPlan={site.plan} required="pro">
        {leads.length === 0 && (
          <div style={{ color: "#333", padding: 16 }}>No leads yet. Leads appear when visitors submit forms on your site.</div>
        )}
        <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr 0.7fr",
            padding: "6px 16px", background: "#111", color: "#555", fontSize: 11,
            borderBottom: "1px solid #1a1a1a",
          }}>
            <div>Name</div><div>Email</div><div>Page</div><div>Submitted</div><div>Score</div>
          </div>
          {leads.map((lead) => (
            <Link key={lead.id} href={`/platform/leads/${lead.visitor_id}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 1fr 0.7fr",
                padding: "8px 16px", borderBottom: "1px solid #111",
                fontSize: 12, cursor: "pointer",
              }}>
                <span style={{ color: "#fff" }}>{lead.name || "—"}</span>
                <span style={{ color: "#7dd3fc" }}>{lead.email || "—"}</span>
                <span style={{ color: "#aaa" }}>{lead.page_path || "—"}</span>
                <span>{lead.submitted_at ? new Date(lead.submitted_at).toLocaleDateString() : "—"}</span>
                <span style={{ color: lead.confidence === "high" ? "#4ade80" : "#fb923c" }}>{lead.confidence}</span>
              </div>
            </Link>
          ))}
        </div>
      </PlanGate>
    </div>
  );
}