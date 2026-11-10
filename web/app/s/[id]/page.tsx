import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { Mark } from "@/components/page-shell";
import { SummaryCard } from "@/components/summary-card";
import { getShareDoc } from "@/lib/share-db";
import type { ShareSummary } from "@/lib/share";
import { GENRES } from "@/lib/genres";
import { genreOfTopic, TOPICS } from "@/lib/topics";

// 共有リンク（/s/<id>）の画面。受け取った人が結果のまとめを見て、そのまま自分の診断を始められるようにする。
// 合言葉なしで開ける（proxy.ts）。載せるのは、まとめの数と話題の名前だけ
const whoOf = (s: ShareSummary) => (s.sample ? "見本の人" : "わたし");

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getShareDoc(id);
  const title = s ? `${whoOf(s)}のおすすめに、一度も出てこない話題は約 ${s.fogCount} / ${TOPICS.length}｜バブル診断` : "バブル診断";
  const description = "あなたの YouTube のおすすめに、一度も出てこない話題はいくつ？ カードに答えるだけで、1分で調べられます。登録はいりません。";
  return {
    title,
    description,
    // 共有された結果は検索結果に出さない（SNS のカードには出る）
    robots: { index: false, follow: false },
    openGraph: { type: "website", siteName: "バブル診断", title, description, locale: "ja_JP" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function SharePage({ params }: PageProps<"/s/[id]">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0b0d12] text-white">
      <Suspense fallback={<div className="flex-1" />}>
        <ShareView params={params} />
      </Suspense>
    </div>
  );
}

async function ShareView({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const s = await getShareDoc(id);
  const tint = s ? (GENRES.find((g) => g.id === genreOfTopic(s.top[0]))?.color ?? "#1d2b64") : "#1d2b64";

  return (
    <div
      className="flex flex-1 flex-col"
      style={{ background: `radial-gradient(120% 70% at 80% 0%, ${tint}, transparent 65%), radial-gradient(100% 60% at 0% 100%, ${tint}55, #0b0d12 75%)` }}
    >
      <header className="mx-auto flex h-12 w-full max-w-[480px] items-center px-4">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold">
          <Mark />
          バブル診断
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 pb-[max(32px,env(safe-area-inset-bottom))] pt-6">
        {s ? (
          <>
            <SummaryCard who={whoOf(s)} kinds={s.kinds} top={s.top} top3={s.top3} type={s.type} fogCount={s.fogCount} />
            {s.sample && <p className="mt-3 text-center text-xs text-white/60">診断の見本（架空の人）の結果です</p>}
          </>
        ) : (
          <p className="mt-6 text-center text-[15px] text-white/80">このリンクの結果は見つかりませんでした。</p>
        )}

        <section className="mt-10 text-center">
          <h1 className="text-[clamp(26px,7.5vw,34px)] font-black leading-[1.3]">あなたのおすすめに、出てこない話題はいくつ？</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            カードに答えるだけで、{TOPICS.length} の話題のうち、あなたの YouTube のおすすめに一度も出てこない話題がわかります。登録はいりません。
          </p>
          <Link
            href="/diagnose/swipe"
            className="mt-6 flex h-[52px] items-center justify-center gap-2 rounded-full bg-white text-[17px] font-bold text-[#0b0d12] transition hover:brightness-95"
          >
            1分で診断する
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-white/70 hover:text-white">
            バブル診断について
          </Link>
        </section>
      </main>
    </div>
  );
}
