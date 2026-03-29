"use client";

import { useEffect, useState, useRef } from "react";

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [leads, setLeads] = useState([]);
  const [sites, setSites] = useState([]);
  const containerRef = useRef(null);

  async function fetchAll() {
    try {
      const [debugRes, leadsRes, siteRes] = await Promise.all([
        fetch("/api/debug"),
        fetch("/api/debug-leads"),
        fetch("/api/debug-site"),
      ]);
      const debug = await debugRes.json();
      const leadsJson = await leadsRes.json();
      const siteJson = await siteRes.json();

      // Keep only latest 20 page views
      setData((debug.data || []).slice(0, 20));
      setLeads(leadsJson.data || []);
      setSites(siteJson.data || []);
    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 4000);
    return () => clearInterval(interval);
  }, []);

  const col7 = "1.5fr 1fr 1fr 1fr 1fr 0.7fr 0.7fr";
  const col6 = "1fr 1.5fr 1fr 1fr 0.7fr 1fr";

  const headerStyle = {
    padding: "6px 8px",
    fontWeight: "bold",
    borderBottom: "1px solid #333",
    background: "#111",
    color: "#aaa",
  };

  const rowStyle = {
    padding: "6px 8px",
    borderBottom: "1px solid #1a1a1a",
    color: "#ddd",
  };

  return (
    <div
      ref={containerRef}
      style={{ padding: 16, fontSize: 12, fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#ddd" }}
    >

      {/* ---- SITE INFO ---- */}
      <h2 style={{ marginBottom: 8, color: "#fff" }}>Your Sites</h2>
      {sites.length === 0 && (
        <div style={{ color: "#555", marginBottom: 24 }}>No sites found. Go to /platform/create-site to add one.</div>
      )}
      {sites.map((site) => (
        <div key={site.id} style={{
          border: "1px solid #222",
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
          background: "#111",
        }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>{site.name || site.domain}</span>
            <span style={{
              padding: "2px 8px",
              borderRadius: 99,
              fontSize: 10,
              background: site.is_active ? "#1a3a1a" : "#3a1a1a",
              color: site.is_active ? "#4ade80" : "#f87171",
            }}>
              {site.is_active ? "ACTIVE" : "INACTIVE"}
            </span>
            <span style={{ color: "#555" }}>Plan: <span style={{ color: "#aaa" }}>{site.plan || "free"}</span></span>
            <span style={{ color: "#555" }}>Site ID: <span style={{ color: "#666" }}>{site.id}</span></span>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#555" }}>Domain: </span>
            <span style={{ color: "#aaa" }}>{site.domain}</span>
          </div>

          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "#555" }}>API Key: </span>
            <span style={{ color: "#666" }}>{site.api_key}</span>
          </div>

          <div style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "#0d0d0d",
            border: "1px solid #222",
            borderRadius: 4,
            color: "#4ade80",
            fontSize: 11,
            wordBreak: "break-all",
          }}>
            {`<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`}
            {/* 🚀 DEPLOY: replace localhost:3000 with your production domain */}
          </div>
        </div>
      ))}

      {/* ---- ACTIVITY LOG ---- */}
      <h2 style={{ marginBottom: 8, marginTop: 24, color: "#fff" }}>
        Activity Log <span style={{ color: "#444", fontWeight: "normal" }}>(latest 20)</span>
      </h2>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden", marginBottom: 32 }}>
        <div style={{ display: "grid", gridTemplateColumns: col7, ...headerStyle }}>
          <div>Page</div><div>Visitor</div><div>Session</div>
          <div>Entered</div><div>Left</div><div>Time(ms)</div><div>Scroll%</div>
        </div>
        {data.length === 0 && (
          <div style={{ padding: "10px 8px", color: "#444" }}>No activity yet.</div>
        )}
        {data.map((item) => (
          <div key={item.id} style={{ display: "grid", gridTemplateColumns: col7, ...rowStyle }}>
            <div style={{ color: "#7dd3fc" }}>{item.page_path}</div>
            <div style={{ color: "#aaa" }}>{item.visitor_id?.slice(0, 8)}...</div>
            <div style={{ color: "#666" }}>{item.session_id?.slice(0, 8)}...</div>
            <div>{formatTime(item.entered_at)}</div>
            <div>{item.left_at ? formatTime(item.left_at) : <span style={{ color: "#444" }}>live</span>}</div>
            <div>{item.time_on_page ?? <span style={{ color: "#444" }}>—</span>}</div>
            <div>{item.scroll_depth != null ? `${Math.round(item.scroll_depth * 100)}%` : <span style={{ color: "#444" }}>—</span>}</div>
          </div>
        ))}
      </div>

      {/* ---- LEADS ---- */}
      <h2 style={{ marginBottom: 8, color: "#fff" }}>
        Form Submissions <span style={{ color: "#444", fontWeight: "normal" }}>({leads.length} total)</span>
      </h2>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: col6, ...headerStyle }}>
          <div>Name</div><div>Email</div><div>Phone</div>
          <div>Page</div><div>Confidence</div><div>Submitted</div>
        </div>
        {leads.length === 0 && (
          <div style={{ padding: "10px 8px", color: "#444" }}>No leads yet.</div>
        )}
        {leads.map((lead) => (
          <div key={lead.id} style={{ display: "grid", gridTemplateColumns: col6, ...rowStyle }}>
            <div style={{ color: "#fff" }}>{lead.name || <span style={{ color: "#444" }}>—</span>}</div>
            <div style={{ color: "#7dd3fc" }}>{lead.email || <span style={{ color: "#444" }}>—</span>}</div>
            <div>{lead.phone || <span style={{ color: "#444" }}>—</span>}</div>
            <div style={{ color: "#aaa" }}>{lead.page_path || "—"}</div>
            <div style={{ color: lead.confidence === "high" ? "#4ade80" : "#fb923c" }}>
              {lead.confidence}
            </div>
            <div>{formatTime(lead.submitted_at)}</div>
          </div>
        ))}
      </div>

    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString();
}