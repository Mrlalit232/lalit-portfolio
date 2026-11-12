import { ImageResponse } from "next/og";
import { site } from "./site";

export const ogSize = { width: 1200, height: 630 };

/** Branded social-sharing card (text only, no fabricated imagery). */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #06070a 0%, #10131a 60%, #171b24 100%)",
          color: "#e9ebf0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              border: "2px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
            }}
          >
            L
          </div>
          <div style={{ fontSize: 26, color: "#a1a9b8" }}>Portfolio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{site.name}</div>
          <div style={{ display: "flex", gap: 20, marginTop: 28, fontSize: 44 }}>
            <span style={{ color: "#6cc7ff" }}>Technology</span>
            <span style={{ color: "#7d8697" }}>×</span>
            <span style={{ color: "#f0b46c" }}>Business</span>
            <span style={{ color: "#7d8697" }}>×</span>
            <span style={{ color: "#ab9dff" }}>Creativity</span>
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#a1a9b8" }}>
          Web Development · QA &amp; Test Automation · Business Operations · Digital Marketing
        </div>
      </div>
    ),
    ogSize,
  );
}
