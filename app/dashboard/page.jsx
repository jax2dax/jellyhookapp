"use client";

import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { ConversionPathsChart } from "@/components/charts/lineConversionPath"
import { ConversionRateChart } from "@/components/charts/conversionRate"
import { ModeToggle } from "@/components/DarkButton"
export default function Dashboard() {
  const { user } = useUser();
  const [data, setData] = useState([]);
  const [leads, setLeads] = useState([]);
  const [sites, setSites] = useState([]);
  const [devMode, setDevMode] = useState(true);
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

  // USER MODE: only active sites belonging to logged in user
  const visibleSites = devMode
    ? sites
    : sites.filter((s) => s.user_id === user?.id && s.is_active);

  // USER MODE: only leads from visible sites
  const visibleSiteIds = new Set(visibleSites.map((s) => s.id));
  const visibleLeads = devMode
    ? leads
    : leads.filter((l) => visibleSiteIds.has(l.site_id));

  const col7 = "1.5fr 1fr 1fr 1fr 1fr 0.7fr 0.7fr";
  const col6 = "1fr 1.5fr 1fr 1fr 0.7fr 1fr";

  const headerStyle = {
    padding: "6px 8px",
    fontWeight: "bold",
    borderBottom: "1px solid #333",
    background: "#111",
    color: "#32CD32",
  };

  const rowStyle = {
    padding: "6px 8px",
    borderBottom: "1px solid #1a1a1a",
    color: "#32CD32",
  };
  const DEMO_DATA= {
  globalMinX: -360,
  globalMaxX: 30,
  uniquePagePaths: ['/', '/pricing', '/signup', '/docs', '/contact', '/checkout', '/about'],
  leads: [
    {
      leadId: 'demo1',
      leadName: 'Alice',
      leadEmail: 'alice@example.com',
      conversionTime: new Date('2026-04-05T10:00:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -240, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -180, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -120, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: -30, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo2',
      leadName: 'Bob',
      leadEmail: 'bob@example.com',
      conversionTime: new Date('2026-04-05T11:30:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -60, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -45, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -20, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo3',
      leadName: 'Charlie',
      leadEmail: 'charlie@example.com',
      conversionTime: new Date('2026-04-05T09:15:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -300, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -250, pagePath: '/contact', enteredAt: new Date() },
        { relativeTimeSec: -200, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -150, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -80, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -10, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo4',
      leadName: 'Diana',
      leadEmail: 'diana@example.com',
      conversionTime: new Date('2026-04-05T12:05:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -180, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -150, pagePath: '/about', enteredAt: new Date() },
        { relativeTimeSec: -100, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -50, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo5',
      leadName: 'Ethan',
      leadEmail: 'ethan@example.com',
      conversionTime: new Date('2026-04-05T08:45:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -360, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -300, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -240, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -180, pagePath: '/about', enteredAt: new Date() },
        { relativeTimeSec: -120, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -60, pagePath: '/checkout', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
  ],
}

  return (
    <div
      ref={containerRef}
      style={{ padding: 16, fontSize: 12, fontFamily: "monospace", background: "#0a0a0a", minHeight: "100vh", color: "#ddd" }}
    >
      <ModeToggle />

      {/* ---- HEADER ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <span style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>Dashboard</span>
          {user && (
            <span style={{ color: "#555", marginLeft: 12 }}>
              {user.emailAddresses?.[0]?.emailAddress}
            </span>
          )}
        </div>
        <button
          onClick={() => setDevMode((v) => !v)}
          style={{
            padding: "4px 14px",
            borderRadius: 99,
            border: "1px solid",
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "monospace",
            background: devMode ? "#1a1a3a" : "#1a3a1a",
            borderColor: devMode ? "#6366f1" : "#4ade80",
            color: devMode ? "#818cf8" : "#4ade80",
          }}
        >
          {devMode ? "DEV MODE" : "USER MODE"}
        </button>
      </div>
      <div className="my-2 mx-1" >
      <ConversionPathsChart siteId="1a6d1c5c-7a6a-4d39-b221-9f3dbb64c3b1" useDemo={false} permission={2} />  {/*//i removed leads={}*/}
         </div>
         <div className="my-2 mt-4 mx-1" >
          <ConversionRateChart siteId={"1a6d1c5c-7a6a-4d39-b221-9f3dbb64c3b1"} /></div>  {/*<ConversionRateChart siteId={site.id} planLevel={planLevel} />*/}




      {/* ---- SITE INFO ---- */}
      <h2 style={{ marginBottom: 8, color: "#fff" }}>
        Sites{" "}
        <span style={{ color: "#444", fontWeight: "normal" }}>
          ({devMode ? "all" : "your active"})
        </span>
      </h2>
      {visibleSites.length === 0 && (
        <div style={{ color: "#555", marginBottom: 24 }}>
          {devMode ? "No sites in DB." : "No active site found. Go to /platform/create-site."}
        </div>
      )}
      {visibleSites.map((site) => (
        <div key={site.id} style={{
          border: "1px solid #222",
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
          background: "#111",
        }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: "#fff", fontWeight: "bold", fontSize: 13 }}>{site.name || site.domain}</span>
            <span style={{
              padding: "2px 8px", borderRadius: 99, fontSize: 10,
              background: site.is_active ? "#1a3a1a" : "#3a1a1a",
              color: site.is_active ? "#4ade80" : "#f87171",
            }}>
              {site.is_active ? "ACTIVE" : "INACTIVE"}
            </span>
            <span style={{ color: "#555" }}>
              Plan: <span style={{ color: "#aaa" }}>{site.plan || "free"}</span>
            </span>
            {devMode && (
              <span style={{ color: "#333" }}>
                owner: <span style={{ color: "#444" }}>{site.user_id?.slice(0, 16)}...</span>
              </span>
            )}
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: "#555" }}>Domain: </span>
            <span style={{ color: "#aaa" }}>{site.domain}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: "#555" }}>Site ID: </span>
            <span style={{ color: "#444" }}>{site.id}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: "#555" }}>API Key: </span>
            <span style={{ color: "#444" }}>{site.api_key}</span>
          </div>
          <div style={{
            marginTop: 8, padding: "6px 10px",
            background: "#0d0d0d", border: "1px solid #222",
            borderRadius: 4, color: "#4ade80", fontSize: 11, wordBreak: "break-all",
          }}>
            {`<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`}
            {/* 🚀 DEPLOY: replace localhost:3000 with production domain */}
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
        Form Submissions{" "}
        <span style={{ color: "#444", fontWeight: "normal" }}>({visibleLeads.length} total)</span>
      </h2>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: col6, ...headerStyle }}>
          <div>Name</div><div>Email</div><div>Phone</div>
          <div>Page</div><div>Confidence</div><div>Submitted</div>
        </div>
        {visibleLeads.length === 0 && (
          <div style={{ padding: "10px 8px", color: "#444" }}>No leads yet.</div>
        )}
        {visibleLeads.map((lead) => (
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