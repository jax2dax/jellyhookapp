"use client";

import { useEffect, useState, useRef } from "react";

export default function Dashboard() {
  const [data, setData] = useState([]);
  const containerRef = useRef(null);

  async function fetchData() {
    try {
      const res = await fetch("/api/debug");
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error("FETCH ERROR:", err);
    }
  }

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 2000); // live polling
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        padding: 12,
        fontSize: 12,
        fontFamily: "monospace",
      }}
    >
      <h2 style={{ marginBottom: 10 }}>Live Page Views</h2>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 0.7fr 0.7fr",
            padding: "6px 8px",
            fontWeight: "bold",
            borderBottom: "1px solid #ddd",
            position: "sticky",
            top: 0,
            background: "#fafafa",
          }}
        >
          <div>Page</div>
          <div>Visitor</div>
          <div>Session</div>
          <div>Entered</div>
          <div>Left</div>
          <div>Time</div>
          <div>Scroll</div>
        </div>

        {/* ROWS */}
        {data.map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.5fr 1fr 1fr 1fr 1fr 0.7fr 0.7fr",
              padding: "6px 8px",
              borderBottom: "1px solid #eee",
            }}
          >
            <div>{item.page_path}</div>
            <div>{item.visitor_id}</div>
            <div>{item.session_id}</div>
            <div>{formatTime(item.entered_at)}</div>
            <div>{item.left_at ? formatTime(item.left_at) : "…"}</div>
            <div>{item.time_on_page ?? "…"}</div>
            <div>{item.scroll_depth ?? "…"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// small helper
function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString();
}