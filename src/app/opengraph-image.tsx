import { ImageResponse } from "next/og";

export const alt = "LungNote — จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf8f4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <svg
            width={120}
            height={120}
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x={6}
              y={6}
              width={36}
              height={36}
              rx={4}
              fill="none"
              stroke="#2c2a25"
              strokeWidth={3}
            />
            <path
              d="M14 24 L21 31 L34 16"
              fill="none"
              stroke="#6aab8e"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              color: "#2c2a25",
              letterSpacing: -2,
            }}
          >
            <span>Lung</span>
            <span style={{ color: "#6aab8e" }}>Note</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 48,
            color: "#2c2a25",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#8a8578",
            textAlign: "center",
            marginTop: 24,
          }}
        >
          แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย
        </div>
      </div>
    ),
    size,
  );
}
