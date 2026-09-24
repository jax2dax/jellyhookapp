// app/dev/frame-plate/page.jsx
// Visual playground for the FramePlate chart — no auth, fake data only.
// Multiple sessions rendered at once, each with its underlying fake data
// shown below it, plus a live control panel that overrides the theme
// across every chart for stress-testing.
"use client";

import { useMemo, useState } from "react";
import { FramePlateChart, generateFakeSession, generateOutlierTestSession, formatFrameDuration } from "@/framePlate";

// ── Scenarios — a variety of fake sessions to judge the plotting against ──
// Each carries a deviceType (or null, to test the "unknown device" fallback)
// so the auto-resolved viewport height + device plate preset are exercised
// across the board, not just in one dedicated demo.
const SCENARIOS = [
  { key: "mixed", label: "Mixed (typical)", deviceType: "desktop", build: () => generateFakeSession({ seed: 42, visitCount: 6, withConversion: true, withAwayGap: true }) },
  { key: "outlier", label: "9 short + 1 outlier", deviceType: "desktop", build: () => generateOutlierTestSession(7) },
  { key: "short", label: "Short (2 pages)", deviceType: "mobile", build: () => generateFakeSession({ seed: 3, visitCount: 2, withConversion: false, withAwayGap: false }) },
  { key: "long", label: "Long (14 pages)", deviceType: "desktop", build: () => generateFakeSession({ seed: 99, visitCount: 14, withConversion: true, withAwayGap: true }) },
  { key: "tall", label: "Tall pages (4k-9k px)", deviceType: "mobile", build: () => generateFakeSession({ seed: 15, visitCount: 5, pageHeightRange: [4000, 9000], withConversion: true, withAwayGap: false }) },
  { key: "revisit", label: "Heavy revisiting", deviceType: null, build: () => generateFakeSession({ seed: 21, visitCount: 5, revisitChance: 0.9, withConversion: false, withAwayGap: true }) },
  { key: "live", label: "Live session (still open)", deviceType: "mobile", build: () => generateFakeSession({ seed: 77, visitCount: 4, withConversion: false, withAwayGap: false, live: true }) },
  {
    // Hand-built, not generateFakeSession — pinned to the exact numbers used
    // to verify the scroll->page conversion. Viewport 665px, page 831px
    // (1.25 screens): vFrac = 0.80, scrollableFrac = 0.20.
    //   - never scrolled  -> seen 0 -> 0.80 (80% before touching anything)
    //   - scroll y = 0.5  -> viewport top 10% down -> seen 0 -> 0.90, 10% unseen
    // If either plate disagrees with those numbers, the conversion is wrong.
    key: "reference",
    label: "Reference: 1.25-screen page",
    deviceType: "desktop",
    build: () => {
      const t0 = Date.now() - 60_000;
      const mk = (id, path, startMs, durMs, trace) => ({
        id,
        pagePath: path,
        enteredAt: new Date(startMs).toISOString(),
        leftAt: new Date(startMs + durMs).toISOString(),
        pageHeightPx: 831,
        viewportHeightPx: 665,
        scrollTrace: trace,
        converted: false,
      });
      return {
        id: "session-reference",
        visitorId: "visitor-reference",
        startedAt: new Date(t0).toISOString(),
        endedAt: new Date(t0 + 45_000).toISOString(),
        visits: [
          mk("ref-noscroll", "/never-scrolled", t0, 20_000, [
            { t: 0, y: 0 },
            { t: 20_000, y: 0 },
          ]),
          mk("ref-halfway", "/scrolled-halfway", t0 + 20_000, 25_000, [
            { t: 0, y: 0 },
            { t: 25_000, y: 0.5 },
          ]),
        ],
      };
    },
  },
];

// ── Generic control helpers ────────────────────────────────────────────────
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const next = structuredClone(obj);
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor[keys[i]] = cursor[keys[i]] ?? {};
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}

function NumberControl({ label, path, value, min, max, step, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#aaa" }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(path, Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ width: 44, textAlign: "right", color: "#eee", fontSize: 11, fontFamily: "monospace" }}>{value}</span>
      </div>
    </label>
  );
}

function ColorControl({ label, path, value, onChange }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#aaa" }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="color" value={value} onChange={(e) => onChange(path, e.target.value)} style={{ width: 28, height: 22, padding: 0, border: "1px solid #333", borderRadius: 4, background: "none" }} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(path, e.target.value)}
          style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 4, color: "#eee", fontSize: 11, fontFamily: "monospace", padding: "2px 6px" }}
        />
      </div>
    </label>
  );
}

// canvasBackground / plate.baseColor / plate.borderColor / frame.exitedNormally
// are deliberately NOT here — they track light/dark automatically via the
// --fp-* CSS variables in app/globals.css (see the Light/Dark toggle below).
// These four stay fixed hex regardless of mode, so a literal picker fits.
const COLOR_CONTROLS = [
  { path: "frame.backgroundByOutcome.active", label: "frame: active" },
  { path: "frame.backgroundByOutcome.converted", label: "frame: converted" },
  { path: "frame.backgroundByOutcome.expired", label: "frame: expired" },
  { path: "frame.backgroundByOutcome.away", label: "frame: away" },
  { path: "frame.backgroundByOutcome.live", label: "frame: live (session open)" },
];

const CONTROL_GROUPS = [
  {
    title: "Plate",
    controls: [
      { path: "plate.width", label: "width", min: 24, max: 140, step: 2 },
      { path: "plate.minHeight", label: "minHeight", min: 20, max: 200, step: 5 },
      { path: "plate.maxHeight", label: "maxHeight", min: 100, max: 500, step: 5 },
      { path: "plate.pxToVisualRatio", label: "pxToVisualRatio", min: 0.02, max: 0.3, step: 0.01 },
      { path: "plate.cornerRadius", label: "cornerRadius", min: 0, max: 30, step: 1 },
    ],
  },
  {
    title: "Frame",
    controls: [
      { path: "frame.minWidth", label: "minWidth", min: 30, max: 200, step: 2 },
      { path: "frame.typicalWidth", label: "typicalWidth", min: 60, max: 300, step: 2 },
      { path: "frame.maxWidth", label: "maxWidth", min: 150, max: 600, step: 5 },
      { path: "frame.height", label: "height", min: 150, max: 600, step: 5 },
      { path: "frame.padding", label: "padding", min: 0, max: 60, step: 1 },
      { path: "frame.gap", label: "gap", min: 0, max: 40, step: 1 },
    ],
  },
  {
    title: "Bulbs — length (protrusion)",
    controls: [
      { path: "bulbs.enter.length", label: "enter", min: 2, max: 40, step: 1 },
      { path: "bulbs.exit.length", label: "exit", min: 2, max: 40, step: 1 },
      { path: "bulbs.deepestScroll.length", label: "deepestScroll", min: 2, max: 40, step: 1 },
      { path: "bulbs.converted.length", label: "converted", min: 2, max: 40, step: 1 },
    ],
  },
  {
    title: "Bulbs — thickness (shared look)",
    controls: [
      { path: "bulbs.enter.thickness", label: "enter", min: 2, max: 20, step: 1 },
      { path: "bulbs.exit.thickness", label: "exit", min: 2, max: 20, step: 1 },
      { path: "bulbs.deepestScroll.thickness", label: "deepestScroll", min: 2, max: 20, step: 1 },
      { path: "bulbs.converted.thickness", label: "converted", min: 2, max: 20, step: 1 },
    ],
  },
  {
    title: "Ribbon & hover",
    controls: [
      { path: "ribbon.thickness", label: "ribbon.thickness", min: 1, max: 10, step: 1 },
      { path: "ribbon.gap", label: "ribbon.gap", min: 0, max: 40, step: 1 },
      { path: "hover.darkenOpacity", label: "hover.darkenOpacity", min: 0, max: 0.9, step: 0.05 },
    ],
  },
  {
    title: "Header (zigzag)",
    controls: [
      { path: "header.widthPx", label: "widthPx (span)", min: 4, max: 50, step: 1 },
      { path: "header.heightPx", label: "heightPx (amplitude)", min: 1, max: 12, step: 0.5 },
      { path: "header.segments", label: "segments (peaks)", min: 2, max: 10, step: 1 },
      { path: "header.offsetX", label: "offsetX (from plate left)", min: 0, max: 40, step: 1 },
    ],
  },
];

// Matches framePlate/theme/defaultTheme.ts exactly (minus the CSS-var-driven
// fields — see COLOR_CONTROLS above). "Reset to defaults" returns to this.
const INITIAL_OVERRIDES = {
  plate: { width: 70, minHeight: 55, maxHeight: 300, pxToVisualRatio: 0.09, cornerRadius: 2 },
  frame: {
    minWidth: 72,
    typicalWidth: 160,
    maxWidth: 340,
    height: 340,
    padding: 14,
    gap: 10,
    backgroundByOutcome: {
      active: "#3f5f3f",
      converted: "#a6821b",
      expired: "#6b2f2f",
      away: "#5a4080",
      live: "#0e7490",
    },
  },
  bulbs: {
    enter: { length: 7, thickness: 3 },
    exit: { length: 9, thickness: 3 },
    deepestScroll: { length: 15, thickness: 3 },
    converted: { length: 22, thickness: 3 },
  },
  header: { widthPx: 16, heightPx: 3, segments: 4, offsetX: 8 },
  ribbon: { thickness: 3, gap: 14 },
  hover: { darkenOpacity: 0.35 },
};

function VisitSummaryTable({ session }) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div style={{ marginTop: 10, fontSize: 11 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", color: "#ccc" }}>
        <thead>
          <tr style={{ color: "#777", textAlign: "left" }}>
            <th style={{ padding: "3px 6px" }}>page</th>
            <th style={{ padding: "3px 6px" }}>duration</th>
            <th style={{ padding: "3px 6px" }}>pageHeight</th>
            <th style={{ padding: "3px 6px" }}>revisited</th>
            <th style={{ padding: "3px 6px" }}>converted</th>
          </tr>
        </thead>
        <tbody>
          {session.visits.map((v) => {
            const durationMs = new Date(v.leftAt).getTime() - new Date(v.enteredAt).getTime();
            const revisited = (v.scrollTrace?.length ?? 0) > 3 && v.scrollTrace.some((s, i) => i > 0 && s.y < v.scrollTrace[i - 1].y - 0.15);
            return (
              <tr key={v.id} style={{ borderTop: "1px solid #2a2a2a" }}>
                <td style={{ padding: "3px 6px" }}>{v.pagePath}</td>
                <td style={{ padding: "3px 6px" }}>{formatFrameDuration(durationMs)}</td>
                <td style={{ padding: "3px 6px" }}>{v.pageHeightPx}px</td>
                <td style={{ padding: "3px 6px" }}>{revisited ? "yes" : "—"}</td>
                <td style={{ padding: "3px 6px" }}>{v.converted ? "✓" : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        onClick={() => setShowRaw((s) => !s)}
        style={{ marginTop: 6, fontSize: 10, background: "none", border: "1px solid #333", color: "#888", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
      >
        {showRaw ? "hide" : "show"} raw JSON
      </button>
      {showRaw && (
        <pre style={{ marginTop: 6, maxHeight: 240, overflow: "auto", background: "#111", padding: 10, borderRadius: 6, fontSize: 10 }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Fields device presets (desktopPlate/mobilePlate) actually control — stripped
// from the manual overrides when "let device control shape" is on, so
// FramePlateChart's own deviceType-based merge can show through instead of
// always being overridden by the sliders' fixed values.
function stripDeviceControlledFields(overrides) {
  const next = structuredClone(overrides);
  if (next.plate) delete next.plate.cornerRadius;
  delete next.header;
  return next;
}

export default function FramePlateDevPage() {
  const [overrides, setOverrides] = useState(INITIAL_OVERRIDES);
  const [hoverDelayMs, setHoverDelayMs] = useState(150);
  // 'auto' = resolved per-scenario from deviceType, 'off' = no line, 'manual' = the slider value below
  const [viewportMode, setViewportMode] = useState("auto");
  const [viewportHeightPx, setViewportHeightPx] = useState(900);
  const [deviceAutoShape, setDeviceAutoShape] = useState(true);
  const [hovered, setHovered] = useState(null);
  // Toggles the real `.dark` class the app's ModeToggle uses — this is what
  // actually exercises the --fp-* CSS variables in app/globals.css, not a
  // JS-level color override. canvasBackground/plate colors/exitedNormally
  // all flip automatically because they reference those variables.
  const [darkMode, setDarkMode] = useState(true);

  const sessions = useMemo(() => SCENARIOS.map((s) => ({ ...s, session: s.build() })), []);

  function updateOverride(path, value) {
    setOverrides((prev) => setPath(prev, path, value));
  }

  const effectiveTheme = deviceAutoShape ? stripDeviceControlledFields(overrides) : overrides;
  const effectiveViewportProp = viewportMode === "off" ? 0 : viewportMode === "manual" ? viewportHeightPx : undefined;

  return (
    <div className={darkMode ? "dark" : ""} style={{ minHeight: "100vh", background: "var(--fp-canvas, #0a0a0a)", padding: 32, fontFamily: "system-ui, sans-serif", color: "var(--fp-text, #eee)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>FramePlate — dev playground</h1>
        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{ fontSize: 12, background: "var(--fp-plate, #222)", border: "1px solid var(--fp-plate-border, #333)", color: "var(--fp-text, #ccc)", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}
        >
          {darkMode ? "☾ Dark" : "☀ Light"} — toggle
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--fp-text-muted, #888)", marginBottom: 20 }}>Fake data only. Adjust values below — they apply live to every chart.</p>

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, background: "var(--fp-plate, #1c1c1c)", border: "1px solid var(--fp-plate-border, #2a2a2a)", borderRadius: 12, padding: 20, marginBottom: 12 }}>
        {CONTROL_GROUPS.map((group) => (
          <div key={group.title} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>{group.title}</div>
            {group.controls.map((c) => (
              <NumberControl key={c.path} label={c.label} path={c.path} value={getPath(overrides, c.path)} min={c.min} max={c.max} step={c.step} onChange={updateOverride} />
            ))}
          </div>
        ))}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>Colors (mode-independent)</div>
          <div style={{ fontSize: 10, color: "var(--fp-text-muted, #888)", marginBottom: 2 }}>
            canvas / plate / border track the ☾/☀ toggle above via app/globals.css
          </div>
          {COLOR_CONTROLS.map((c) => (
            <ColorControl key={c.path} label={c.label} path={c.path} value={getPath(overrides, c.path)} onChange={updateOverride} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>Interaction</div>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#aaa" }}>
            hoverDelayMs
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={0} max={800} step={10} value={hoverDelayMs} onChange={(e) => setHoverDelayMs(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ width: 44, textAlign: "right", fontSize: 11, fontFamily: "monospace" }}>{hoverDelayMs}</span>
            </div>
          </label>

          <div style={{ fontSize: 11, color: "#aaa" }}>
            viewportHeightPx (1vh line)
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {["auto", "off", "manual"].map((m) => (
                <button
                  key={m}
                  onClick={() => setViewportMode(m)}
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--fp-plate-border, #333)",
                    background: viewportMode === m ? "#4ade80" : "transparent",
                    color: viewportMode === m ? "#111" : "var(--fp-text-muted, #aaa)",
                    cursor: "pointer",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: "var(--fp-text-muted, #777)", marginTop: 3 }}>
              auto = resolved per-scenario from deviceType (see chart labels)
            </div>
          </div>
          {viewportMode === "manual" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="range" min={100} max={2000} step={50} value={viewportHeightPx} onChange={(e) => setViewportHeightPx(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ width: 44, textAlign: "right", fontSize: 11, fontFamily: "monospace" }}>{viewportHeightPx}</span>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#aaa", marginTop: 4 }}>
            <input type="checkbox" checked={deviceAutoShape} onChange={(e) => setDeviceAutoShape(e.target.checked)} />
            let device control shape (cornerRadius + header)
          </label>

          <button
            onClick={() => setOverrides(INITIAL_OVERRIDES)}
            style={{ marginTop: 4, fontSize: 11, background: "#222", border: "1px solid #333", color: "#ccc", borderRadius: 6, padding: "5px 10px", cursor: "pointer" }}
          >
            Reset to defaults
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 24, fontSize: 12, color: "#888" }}>
        {hovered
          ? hovered.kind === "visit"
            ? `hovering: ${hovered.pagePath} — ${Math.round(hovered.durationMs / 1000)}s, outcome: ${hovered.outcome}, converted: ${String(hovered.converted)}`
            : `hovering: away for ${Math.round(hovered.durationMs / 1000)}s`
          : "hover a frame to inspect it"}
      </div>

      {/* ── Charts ───────────────────────────────────────────────────── */}
      {sessions.map(({ key, label, deviceType, session }) => (
        <div key={key} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: "var(--fp-text, #ddd)" }}>
            {label} {session.endedAt === null && <span style={{ color: "#22d3ee" }}>● live</span>}
          </div>
          <div style={{ fontSize: 10, color: "var(--fp-text-muted, #777)", marginBottom: 8 }}>
            deviceType: {deviceType ?? "unknown (falls back to desktop's defaults)"}
          </div>
          {/* no background here on purpose — the SVG paints its own canvasBackground, this is just a border frame */}
          <div style={{ borderRadius: 12, padding: 24, border: "1px solid var(--fp-plate-border, #2a2a2a)" }}>
            <FramePlateChart
              session={session}
              theme={effectiveTheme}
              deviceType={deviceType}
              hoverDelayMs={hoverDelayMs}
              viewportHeightPx={effectiveViewportProp}
              onHoverItem={setHovered}
            />
          </div>
          <VisitSummaryTable session={session} />
        </div>
      ))}
    </div>
  );
}
