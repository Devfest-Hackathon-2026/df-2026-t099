import { typeName } from "@/lib/bubble-type";
import { topicLabel, TOPICS } from "@/lib/topics";

// 結果のまとめのカード。最後のスライドと、共有リンクの画面（/s/<id>）で同じ見た目にする
export function SummaryCard({
  who,
  kinds,
  top,
  top3,
  type,
  fogCount,
  className = "",
}: {
  who: string;
  kinds: number;
  top: string[];
  top3: number;
  type: string;
  fogCount: number;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-[min(72vw,300px)] rounded-3xl bg-[#0b0d12]/85 p-5 text-white shadow-2xl ring-1 ring-white/15 ${className}`}>
      <p className="text-xs font-bold text-(--light)">● バブル診断</p>
      <p className="mt-3 text-xs text-white/70">{who}のおすすめに、一度も出てこない話題</p>
      <p className="font-black leading-none">
        <span className="text-lg">約</span>
        <span className="num mx-1 text-6xl text-white">{fogCount}</span>
        <span className="text-lg">/ {TOPICS.length}</span>
      </p>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {top.slice(0, 3).map((t) => (
          <span key={t} className="relative block aspect-video overflow-hidden rounded-md bg-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- 話題ごとの小さな静的画像 */}
            <img src={`/thumbs/${t}.webp`} alt="" className="absolute inset-0 size-full object-cover" />
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-white/70">
        {top3 >= 15 ? `よく出る3つの話題で ${top3}%：` : "よく出る話題："}{top.slice(0, 3).map(topicLabel).join("・")}
      </p>
      <p className="mt-3 text-[11px] text-white/70">見方のタイプ</p>
      <p className="text-lg font-black">{typeName(type)}</p>
      <p className="mt-3 text-[11px] leading-snug text-white/60">おすすめに出てくる話題：約 {kinds} / {TOPICS.length}</p>
    </div>
  );
}
