// app/opengraph-image.tsx
// The picture shown when jellyhook.com (or a page without its own) is shared on LinkedIn, Slack, X or in a message:
// 1200 x 630, in the site's look (white, ink, green). Pages that set their own openGraph.images keep theirs.
import { ImageResponse } from "next/og";

export const alt = "Jellyhook: stop treating every lead like a stranger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: "64px 72px", color: "#111111" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
            <span>Jelly</span>
            <span style={{ color: "#0f7a3d" }}>hook</span>
          </div>
          <div style={{ height: 8, background: "#111111", marginTop: 18 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>Stop treating every lead like a stranger.</div>
          <div style={{ fontSize: 30, marginTop: 28, color: "#4f544e", lineHeight: 1.35 }}>
            See what each lead read, how long and where they hesitated, before they sent your form.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, fontWeight: 700 }}>
          <span style={{ color: "#0f7a3d" }}>One script. Free during early access.</span>
          <span style={{ background: "#0f7a3d", color: "#ffffff", padding: "14px 26px" }}>jellyhook.com</span>
        </div>
      </div>
    ),
    size,
  );
}
