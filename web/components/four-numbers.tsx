import { formatPercent } from "@/lib/bubble-metrics";
import type { FeedMetrics } from "@/lib/feed-metrics";
import { TOPICS } from "@/lib/topics";

// 自分を正確に知るための4つの数字。見えるものがそれぞれ違うので、全部を並べる（言葉は 15_画面の言葉の決まり.md・yomiyasu で推敲）
export function FourNumbers({ metrics }: { metrics: FeedMetrics }) {
  const items = [
    {
      key: "C",
      label: "重みつきの話題の数",
      value: `約 ${Math.max(1, Math.round(metrics.effective))}`,
      unit: "種類",
      note: "よく出てくる話題ほど重く数えた、話題の数です。出てくる話題が多くても、いくつかの話題ばかりなら小さくなります。",
    },
    {
      key: "D",
      label: "多い3つの話題が占める割合",
      value: `${metrics.top3}%`,
      note: "いちばん多い3つの話題の動画が、おすすめ全体に占める割合です。",
    },
    {
      key: "B",
      label: "かたよりの少なさ",
      value: `${formatPercent(metrics.attention)}%`,
      note: "すべての話題が同じだけ出てくると 100% です。見られる動画の数には限りがあるので、ふつうは小さい数字になります。",
    },
    {
      key: "A",
      label: "一度でも出てくる話題の割合",
      value: `${formatPercent(metrics.breadth)}%`,
      note:
        metrics.breadthLow !== undefined
          ? `${TOPICS.length} の話題のうち、一度でもおすすめに出てくる話題の割合です。答えから推定した値で、およそ ${formatPercent(metrics.breadthLow)}〜${formatPercent(metrics.breadthHigh ?? 0)}% の幅があります。`
          : `${TOPICS.length} の話題のうち、一度でもおすすめに出てくる話題の割合です。読み取った動画だけで数えています。`,
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {items.map((i) => (
        <li key={i.key} className="rounded-(--r-card) bg-surface p-4">
          <p className="text-xs font-bold tracking-wider text-muted">{i.label}</p>
          <p className="num mt-1.5 text-2xl font-bold sm:text-3xl">
            {i.value}
            {i.unit && <span className="ml-1 text-xs font-normal text-muted">{i.unit}</span>}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">{i.note}</p>
        </li>
      ))}
    </ul>
  );
}
