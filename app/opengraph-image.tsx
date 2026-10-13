import { ImageResponse } from "next/og";

// 1200x630 social card. Set in the product's own graphite and live green,
// typographic only: no product screenshot, no invented logo.
export const alt = "Kramflow: run the show from one screen.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  ["09:00", "Doors / walk-in", false],
  ["09:40", "Opening keynote", true],
  ["10:15", "Product launch demo", false],
  ["10:50", "Break", false],
] as const;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0c0b09",
          color: "#f4efe5",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 16, height: 16, background: "#30d158", borderRadius: 2 }} />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Kramflow</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>Run the show from one screen.</div>
            <div style={{ marginTop: 28, fontSize: 26, color: "#a79d8b" }}>
              Live operations for stage managers, AV operators and presenters.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 330,
              border: "1px solid #3a3327",
              borderRadius: 16,
              background: "#17140f",
              overflow: "hidden",
            }}
          >
            {ROWS.map(([time, title, live]) => (
              <div
                key={time}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "18px 22px",
                  fontSize: 22,
                  borderBottom: "1px solid #211d16",
                  background: live ? "rgba(48,209,88,0.14)" : "transparent",
                  color: live ? "#f4efe5" : "#a79d8b",
                }}
              >
                <span>{title}</span>
                <span style={{ color: live ? "#30d158" : "#8a8070" }}>{live ? "LIVE" : time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
