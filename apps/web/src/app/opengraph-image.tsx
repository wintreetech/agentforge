import { ImageResponse } from "next/og";

export const alt = "AgentForge AI — Intelligence. Automated.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #08090D 0%, #11131A 60%, #1e1438 100%)", color: "#F4F5F8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#22D3EE,#6366F1,#7C3AED)" }} />
          <div style={{ fontSize: 40, fontWeight: 700 }}>AgentForge AI</div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 40, letterSpacing: -2 }}>Your AI Workforce Starts Here.</div>
        <div style={{ fontSize: 30, marginTop: 20, color: "#A3A9BC" }}>AI tools, agents and automation systems · €10–€800</div>
      </div>
    ),
    size,
  );
}
