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
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    orientation: "portrait",
    lang: "th",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
