import type { MetadataRoute } from "next";

// スマホのホーム画面に追加したときの名前・アイコン・開き方
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BubbLens",
    short_name: "BubbLens",
    description: "YouTube のおすすめが、どれくらいかたよっているかを調べます。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
