import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { UiParts } from "@/components/ui-parts";
import { THEME_BOOT } from "@/components/theme-switch";
import { TOPICS } from "@/lib/topics";
import "./globals.css";
import "./ui-parts.css";

// Apple の端末以外では、この字で表示する（globals.css の --font-sans）
const noto = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "500", "700", "900"], variable: "--font-noto", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "バブル診断：YouTube のおすすめのかたよりを調べる",
  description: "YouTube のおすすめが、どれくらいかたよっているかを調べます。カードの質問に答えるだけで、登録はいりません。",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "バブル診断", statusBarStyle: "default" },
  // SNS に URL を貼ったときに出るカード（画像は ops/og/make-og.mjs で作る）
  metadataBase: new URL("https://bubble-web-547073661893.asia-northeast1.run.app"),
  openGraph: {
    type: "website",
    siteName: "バブル診断",
    title: "あなたの YouTube のおすすめに、出てこない話題はいくつ？｜バブル診断",
    description: `カードに答えるだけで、${TOPICS.length} の話題のうち、あなたのおすすめに一度も出てこない話題がわかります。登録はいりません。`,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "バブル診断：あなたの YouTube のおすすめに、出てこない話題はいくつ？" }],
    locale: "ja_JP",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f5f5f7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme は、描く前に THEME_BOOT が付ける（サーバーの HTML とずれるので、その警告は出さない）
    <html lang="ja" className={`h-full antialiased ${noto.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <UiParts />
      </body>
    </html>
  );
}
