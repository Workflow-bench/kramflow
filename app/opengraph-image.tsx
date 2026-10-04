import { ImageResponse } from "next/og";

export const alt = "KramFlow — the live operations system for event production";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#0c0b09",
          color: "#f4efe5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#a79d8b" }}>KRAMFLOW</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
          Run the show from one screen.
        </div>
        <div style={{ fontSize: 30, color: "#a79d8b" }}>Cues, timing and every display, in sync.</div>
      </div>
    ),
    { ...size }
  );
}
