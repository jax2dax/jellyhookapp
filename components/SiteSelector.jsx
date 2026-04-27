// components/SiteSelector.jsx
// Simple dropdown that lists all user sites and lets them switch.
// Shows current site name, lists others, has "+" to add a new site.
// Writes cookie via switchSite server action, then reloads.
//import SiteSelector from "@/components/SiteSelector";
"use client";

import { useState, useRef, useEffect } from "react";
import { switchSite } from "@/lib/actions/site-management.actions";

export default function SiteSelector({ sites = [], currentSiteId }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  const currentSite = sites.find((s) => s.id === currentSiteId) ?? sites[0] ?? null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (siteId) => {
    if (siteId === currentSiteId) {
      setOpen(false);
      return;
    }
    setSwitching(siteId);
    setError(null);
    try {
      const res = await switchSite(siteId);
      if (res.success) {
        // Full reload so all server components re-render with new cookie
        window.location.href = "/platform/dashboard";
      } else {
        setError(res.error);
        setSwitching(null);
      }
    } catch (err) {
      setError(err.message);
      setSwitching(null);
    }
  };

  if (!currentSite) {
    return (
      
       <a href="/platform/create-site"
        style={addBtnStyle}
      >
        + Add site
      </a>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", fontFamily: "monospace" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={triggerStyle}
        title="Switch site"
      >
        {/* Verification dot */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: currentSite.verified ? "#4ade80" : "#f59e0b",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
          {currentSite.name || currentSite.domain}
        </span>
        <span style={{ color: "#555", fontSize: 9, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={dropdownStyle}>
          {/* Site list */}
          {sites.map((site) => {
            const isCurrent = site.id === currentSiteId;
            const isLoading = switching === site.id;

            return (
              <button
                key={site.id}
                onClick={() => handleSwitch(site.id)}
                disabled={isLoading || isCurrent}
                style={{
                  ...dropdownItemStyle,
                  background: isCurrent ? "#1a2a1a" : "transparent",
                  cursor: isCurrent ? "default" : "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {/* Left: dot + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: site.verified ? "#4ade80" : "#f59e0b",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      color: isCurrent ? "#4ade80" : "#ccc",
                      fontSize: 12,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: isCurrent ? "bold" : "normal",
                    }}>
                      {site.name || site.domain}
                    </div>
                    <div style={{ color: "#444", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {site.domain}
                    </div>
                  </div>
                </div>

                {/* Right: badges */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                  {!site.verified && (
                    <span style={badge("#f59e0b")}>pending</span>
                  )}
                  {isCurrent && (
                    <span style={badge("#4ade80")}>active</span>
                  )}
                  {isLoading && (
                    <span style={{ color: "#555", fontSize: 10 }}>...</span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Divider */}
          <div style={{ height: 1, background: "#1a1a1a", margin: "4px 0" }} />

          {/* Add site button */}
          
            <a href="/platform/create-site"
            style={{
              ...dropdownItemStyle,
              color: "#4ade80",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onClick={() => setOpen(false)}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 12 }}>Add another site</span>
          </a>

          {/* Error */}
          {error && (
            <div style={{ padding: "6px 12px", color: "#f87171", fontSize: 10 }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const triggerStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  color: "#ccc",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "monospace",
  minWidth: 140,
  maxWidth: 200,
  width: "100%",
};

const dropdownStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 220,
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
  zIndex: 100,
  overflow: "hidden",
  padding: "4px 0",
};

const dropdownItemStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "8px 12px",
  background: "transparent",
  border: "none",
  color: "#ccc",
  fontFamily: "monospace",
  textAlign: "left",
  boxSizing: "border-box",
};

const addBtnStyle = {
  display: "inline-block",
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid #4ade8040",
  borderRadius: 6,
  color: "#4ade80",
  fontSize: 12,
  fontFamily: "monospace",
  textDecoration: "none",
  cursor: "pointer",
};

function badge(color) {
  return {
    background: color + "20",
    color,
    border: `1px solid ${color}40`,
    borderRadius: 99,
    padding: "1px 6px",
    fontSize: 9,
    whiteSpace: "nowrap",
  };
}