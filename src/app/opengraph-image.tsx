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
          background: "#f5ead4",
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
            {/* Cardboard mascot — wobbly box with check-mouth (ADR-0013).
                Coords scaled from design/mascot-icon/lungnote-mascot-icon.svg. */}
            <g
              fill="none"
              stroke="#3a3020"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 9.6 Q10.4 9 12.4 8.8 Q19.2 8.4 24 8.4 Q31.2 8.2 35.4 8.8 Q37.4 9 38 9.6 Q38.8 12 39 16.8 Q39.4 24 39 30.8 Q38.8 35.4 38 37.4 Q37.4 38.4 35.4 38.8 Q31.2 39.4 24 39.4 Q16.8 39.4 12.4 38.8 Q10.4 38.4 10 37.4 Q9.2 35.4 9 30.8 Q8.6 24 9 16.8 Q9 12 10 9.6Z" />
              <path d="M13 8 Q13.6 7.2 15.4 6.8 Q19.2 6.4 24 6.4 Q28.8 6.4 32.6 6.8 Q34.4 7.2 35 8 Q35.4 8.6 35.4 9.6 Q35 10.8 34.4 11 Q32.6 11.4 28.8 11.4 Q24 11.4 19.2 11.4 Q15.4 11 13.6 10.8 Q13 10.4 13 9.6 Q13 8.6 13 8Z" strokeWidth={1} />
              <circle cx={17.8} cy={18.6} r={2.4} fill="#3a3020" stroke="none" />
              <circle cx={30.2} cy={18.2} r={2} fill="#3a3020" stroke="none" />
              <path d="M18 27.4 Q20 29.2 21.6 30.8 Q22.6 30.4 24 28.4 Q26 25.8 30.2 22" strokeWidth={2} stroke="#c9a040" />
            </g>
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 700,
              color: "#3a3020",
              letterSpacing: -2,
            }}
          >
            <span>Lung</span>
            <span style={{ color: "#c9a040" }}>Note</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 48,
            color: "#3a3020",
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
            color: "#a08050",
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
