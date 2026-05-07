import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf8f4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={140}
          height={140}
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
      </div>
    ),
    size,
  );
}
