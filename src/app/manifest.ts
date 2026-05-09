import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LungNote — จดโน้ต เช็คลิสต์ จัดระเบียบชีวิต",
    short_name: "LungNote",
    description:
      "แอปจดโน้ตเรียบง่ายสำหรับนักเรียนไทย โน้ต เช็คลิสต์ ไอเดีย ทุกอย่างอยู่ในที่เดียว",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5ead4",
    theme_color: "#f5ead4",
    orientation: "portrait",
    lang: "th",
    icons: [
      { src: "/lungnote-icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/lungnote-icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/lungnote-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/lungnote-icon-1024.png", sizes: "1024x1024", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
