"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { RecapStory, type Slide } from "@/components/recap-story";
import { OceanMap } from "@/components/ocean-map";
import { BatonInbox } from "@/components/baton-inbox";
import type { Baton } from "@/lib/db";
import { formatPercent, worldCoverage } from "@/lib/bubble-metrics";
import { TOPICS, topicLabel } from "@/lib/topics";
import { ErrorText, PageShell } from "@/components/page-shell";
import { describeType, oppositeType, typeName } from "@/lib/bubble-type";
import { topGenres } from "@/lib/compare";
import { GENRES } from "@/lib/genres";
import type { Insights } from "@/lib/insights";


// 「その他」はジャンルとして数えない（画面では 17 のジャンルと説明している）
const COUNTED_GENRES = GENRES.filter((g) => g.id !== "other");

// Spotify の年末のまとめのように、1枚ずつめくって見るスライド
function buildSlides(d: Insights): Slide[] {
  const visited = COUNTED_GENRES.filter((g) => (d.me.counts[g.id] ?? 0) > 0);
  const top = topGenres(d.me.counts, 1)[0];
  const topShare = top ? Math.round(((d.me.counts[top.id] ?? 0) / (d.me.total || 1)) * 100) : 0;
  const topics = d.me.topicCounts ?? {};
  const topicCount = Object.keys(topics).length;
  const slides: Slide[] = [
    topicCount > 0
      ? {
          kicker: "おすすめのかたよりの少なさ",
          big: `${formatPercent(worldCoverage(topics))}%`,
          text: `すべての話題が同じだけ出てくると 100% です。${TOPICS.length} の話題のうち、あなたのおすすめに出てきたのは ${topicCount} の話題、${COUNTED_GENRES.length} のジャンルのうちでは ${visited.length} のジャンルでした。`,
          color: "#ff9f0a",
        }
      : {
          kicker: "おすすめに出てきたジャンル",
          big: `${visited.length} / ${COUNTED_GENRES.length}`,
          text: `${COUNTED_GENRES.length} のジャンルのうち、あなたのおすすめに出てきたのは ${visited.length} のジャンルでした。`,
          color: "#ff9f0a",
        },
    {
      kicker: "あなたの見方のタイプ",
      big: typeName(d.me.type),
      text: `記号では ${d.me.type} です。4つの文字は「${describeType(d.me.type).join("」「")}」を表しています。`,
      color: "#64d2ff",
    },
  ];
  if (top) {
    slides.push({
      kicker: "いちばん多いジャンル",
      big: top.label,
      text: `あなたのおすすめに出てきた動画の ${topShare}% が、このジャンルでした。`,
      color: top.color,
    });
  }
  for (const c of [d.sameAge, d.sameRegion, d.everyone]) {
    if (!c) continue;
    slides.push({
      kicker: `${c.label}と比べると`,
      big: `${c.match}%`,
      text: `${c.n} 人の平均と比べて、ジャンルの割合がどれだけ似ているかを出しました。${c.match >= 80 ? "かなり似ています。" : c.match >= 50 ? "半分くらい似ています。" : "あまり似ていません。"}`,
      color: "#64d2ff",
    });
  }
  if (d.farthest) {
    slides.push({
      kicker: "あなたといちばん似ていない人たち",
      big: d.farthest.label,
      text: `似ている度合いは ${d.farthest.match}% です。この人たちのおすすめに多いジャンルは「${d.farthest.top.join("」「")}」です。`,
      color: "#f472b6",
    });
  }
  if (d.audience.n > 0) {
    const ages = d.audience.ages.map((a) => `${a.key} ${Math.round(a.share * 100)}%`).join("、");
    const regions = d.audience.regions.map((r) => r.key).join("、");
    slides.push({
      kicker: `「${d.audience.genre}」が多い人たち`,
      big: `${d.audience.n}人`,
      text: `診断した人のうち、おすすめの2割以上がこのジャンルだった人の数です。${ages ? `年代は ${ages}。` : ""}${regions ? `多い地域は ${regions}。` : ""}`,
      color: "#5eead4",
    });
  }
  if (d.sameTypeShare !== null) {
    slides.push({
      kicker: "あなたと同じタイプの人",
      big: `${d.sameTypeShare}%`,
      text: `診断した人のうち、あなたと同じ「${typeName(d.me.type)}（${d.me.type}）」の人の割合です。反対のタイプは「${typeName(oppositeType(d.me.type))}（${oppositeType(d.me.type)}）」です。`,
      color: "#ff9f0a",
    });
  }
  return slides;
}

export default function MeView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [batons, setBatons] = useState<Baton[]>([]);

  useEffect(() => {
    fetch(`/api/insights/${id}`)
      .then((r) => r.json() as Promise<Insights & { error?: string }>)
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("まとめを作れませんでした"));
  }, [id]);

  if (error) return <PageShell title="あなたの YouTube のまとめ"><ErrorText>{error}</ErrorText></PageShell>;
  if (!data) {
    return (
      <PageShell title="あなたの YouTube のまとめ">
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          まとめを作っています
        </p>
      </PageShell>
    );
  }

  const slides = buildSlides(data);
  // 友だちのおすすめを見て加わった話題も、地図に足す
  const litBatons = batons.filter((b) => b.litAt);
  const mapTopics = data.me.topicCounts
    ? {
        ...data.me.topicCounts,
        ...Object.fromEntries(litBatons.filter((b) => !data.me.topicCounts?.[b.topic]).map((b) => [b.topic, 1])),
      }
    : undefined;
  // 招待リンクには本人用の id ではなく、招待用の id を使う
  const inviteUrl =
    typeof window !== "undefined" && data.me.inviteId ? `${window.location.origin}/friend/${data.me.inviteId}` : "";

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast("リンクをコピーしました。LINE などに貼って送れます");
  }

  return (
    <PageShell title="あなたの YouTube のまとめ">
      <RecapStory slides={slides} />

      <div className="mt-8">
        <OceanMap
          counts={data.me.counts}
          topics={mapTopics}
          coverage={mapTopics ? worldCoverage(mapTopics) : undefined}
        />
      </div>

      {litBatons.length > 0 && (
        <section className="mt-6">
          <h2 className="font-bold">友だちのおすすめで地図に加わった話題</h2>
          <p className="mt-2 flex flex-wrap gap-2">
            {litBatons.map((b) => (
              <span key={b.id} className="rounded-full bg-accent/15 px-3 py-1.5 text-sm">
                {topicLabel(b.topic)}（{b.from}）
              </span>
            ))}
          </p>
        </section>
      )}

      <BatonInbox id={id} inviteId={data.me.inviteId} onLit={setBatons} />

      {data.usesSample && (
        <p className="mt-6 rounded-lg bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-700 dark:text-amber-300">
          比べている相手には、試作のために作ったデータがまざっています。実際の人の数字ではありません。
        </p>
      )}

      <section className="mt-8 rounded-(--r-card) bg-surface p-5 sm:p-6">
        <h2 className="font-bold">友だちと比べる</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          このリンクを開いた友だちが診断して保存すると、友だちの画面に、2人のおすすめがどれだけ似ているかが出ます。友だちには、あなたの見方のタイプと、おすすめに出てきたジャンルも見えます。
        </p>
        <button
          onClick={copyInvite}
          disabled={!inviteUrl}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-5 font-semibold"
        >
          <Copy size={16} aria-hidden />
          {copied ? "コピーしました" : "比べるためのリンクをコピー"}
        </button>
      </section>

      <Link href={`/types/${oppositeType(data.me.type)}`} className="mt-6 inline-flex min-h-11 items-center font-bold text-accent">
        反対のタイプ「{typeName(oppositeType(data.me.type))}」のホーム画面の例を見る
      </Link>
    </PageShell>
  );
}
