import { getAuthUser } from "@/lib/actions/permission.actions";
import { getSiteSettings } from "@/lib/actions/supabase.actions";

export default async function SettingsPage() {
  const user = await getAuthUser();
  const site = await getSiteSettings(user.id);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 24 }}>Settings</h1>
      {!site ? (
        <div style={{ color: "#555" }}>No site connected. <a href="/platform/create-site" style={{ color: "#4ade80" }}>Create one →</a></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
          {[
            { label: "Domain", value: site.domain },
            { label: "Plan", value: site.plan },
            { label: "Site ID", value: site.id },
            { label: "API Key", value: site.api_key },
            { label: "Status", value: site.is_active ? "Active" : "Inactive" },
          ].map((row) => (
            <div key={row.label} style={{ padding: 14, background: "#111", border: "1px solid #1a1a1a", borderRadius: 6 }}>
              <div style={{ color: "#555", fontSize: 11, marginBottom: 4 }}>{row.label}</div>
              <div style={{ color: "#fff", fontSize: 13, wordBreak: "break-all" }}>{row.value}</div>
            </div>
          ))}
          <div style={{ padding: 14, background: "#0d0d0d", border: "1px solid #222", borderRadius: 6 }}>
            <div style={{ color: "#555", fontSize: 11, marginBottom: 6 }}>Tracker Script</div>
            <div style={{ color: "#4ade80", fontSize: 11, wordBreak: "break-all" }}>
              {`<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`}
              {/* 🚀 DEPLOY: replace localhost:3000 with production domain */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}