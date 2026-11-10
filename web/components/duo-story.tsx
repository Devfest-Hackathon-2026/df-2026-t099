"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { topicLabel } from "@/lib/topics";
import { typeName } from "@/lib/bubble-type";
import { CountUp, GOLDEN, LIST, Player, Rise, Thumb, type Slide, type Suggestion } from "@/components/result-story";

// 2人のまとめ：おすすめの重なりと、おたがいに見ていない話題の動画を届け合うスライド。
// 届ける動画は、相手だけが見ている話題から、YouTube で本物の動画を探す（2人が交換するプレイリストになる）
export type DuoTopics = { both: string[]; onlyA: string[]; onlyB: string[] };

// 2人の点を重ねた地図：あなただけ＝オレンジ、友だちだけ＝水色、2人とも＝白く光る
function DuoDots({ topics }: { topics: DuoTopics }) {
  const both = new Set(topics.both);
  const a = new Set(topics.onlyA);
  const b = new Set(topics.onlyB);
  return (
    <svg viewBox="0 0 100 100" style={{ width: "min(70vw, 300px)", height: "min(70vw, 300px)" }} className="mx-auto overflow-visible" aria-hidden>
      {LIST.map((t, i) => {
        const r = 3.9 * Math.sqrt(i + 0.5);
        const x = 50 + r * Math.cos(i * GOLDEN);
        const y = 50 + r * Math.sin(i * GOLDEN);
        const kind = both.has(t.id) ? "both" : a.has(t.id) ? "a" : b.has(t.id) ? "b" : null;
        const fill = kind === "both" ? "#ffffff" : kind === "a" ? "var(--light)" : kind === "b" ? "#7cc8ff" : "#ffffff";
        return (
          <circle
            key={t.id}
            cx={x}
            cy={y}
            r={kind ? (kind === "both" ? 2.6 : 2.1) : 1.2}
            fill={fill}
            fillOpacity={kind ? 1 : 0.14}
            className={kind ? "st-dot" : "st-fade"}
            style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${kind === "both" ? 1400 : kind ? 500 + (i % 30) * 20 : 0}ms`, filter: kind === "both" ? "drop-shadow(0 0 2px #fff)" : undefined }}
          />
        );
      })}
    </svg>
  );
}

function VideoList({ topics, picks, tone }: { topics: string[]; picks: Record<string, Suggestion | null> | null; tone: string }) {
  return (
    <ul className="mt-5 space-y-2.5" data-no-nav>
      {topics.map((t, i) => {
        const s = picks?.[t];
        return (
          <li key={t} className="st-pop" style={{ animationDelay: `${500 + i * 120}ms` }}>
            <a
              href={s ? `https://www.youtube.com/watch?v=${s.videoId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(topicLabel(t))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl bg-white/10 p-2 pr-3 transition hover:bg-white/20"
            >
              {s ? (
                // eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネ
                <img src={s.thumbnail} alt="" className="aspect-video w-24 shrink-0 rounded-lg object-cover" />
              ) : (
                <Thumb topic={t} className="w-24 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-bold" style={{ color: tone }}>
                  {topicLabel(t)}
                </span>
                <span className="line-clamp-2 text-sm font-bold leading-snug">{s ? s.title : picks ? "YouTube で探す" : "探しています"}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function DuoStory({
  match,
  myType,
  friendType,
  topics,
  onClose,
}: {
  match: number;
  myType: string;
  friendType: string;
  topics: DuoTopics | null;
  onClose: () => void;
}) {
  const toMe = useMemo(() => topics?.onlyB.slice(0, 3) ?? [], [topics]);
  const toFriend = useMemo(() => topics?.onlyA.slice(0, 3) ?? [], [topics]);
  const [picks, setPicks] = useState<Record<string, Suggestion | null> | null>(null);
  useEffect(() => {
    const ids = [...toMe, ...toFriend];
    if (ids.length === 0) return;
    // 1回に5つまでなので、2回に分けて頼む
    Promise.all([ids.slice(0, 5), ids.slice(5)].filter((x) => x.length).map((x) => fetch(`/api/suggest?topics=${x.join(",")}`).then((r) => (r.ok ? r.json() : { items: {} }))))
      .then((list: { items: Record<string, Suggestion | null> }[]) => setPicks(Object.assign({}, ...list.map((d) => d.items))))
      .catch(() => setPicks({}));
  }, [toMe, toFriend]);

  const ids = [...toMe, ...toFriend].map((t) => picks?.[t]?.videoId).filter(Boolean);
  const playlist = ids.length > 1 ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}` : null;

  const slides: Slide[] = [];
  slides.push({
    id: "match",
    bg: ["#0b0d12", "#3b2a8f"],
    text: `2人のおすすめは ${match}% 似ています`,
    why: "おすすめに出てくる動画のジャンルの割合を、2人で比べた数字です。同じジャンルが同じ割合で出てくるほど 100% に近づきます。",
    node: (
      <div className="my-auto text-center">
        {topics && <DuoDots topics={topics} />}
        {topics && (
          <p className="mt-4 flex justify-center gap-4 text-xs font-bold text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-(--light)" />
              あなただけ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#7cc8ff]" />
              友だちだけ
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-white" />
              2人とも
            </span>
          </p>
        )}
        <p className="mt-6 text-sm font-bold text-white/70">
          <Rise>2人のおすすめは</Rise>
        </p>
        <p className="font-black leading-none">
          <CountUp to={match} delay={700} className="text-[clamp(96px,30vw,150px)]" />
          <span className="text-3xl">%</span>
          <span className="ml-1 text-2xl">似ています</span>
        </p>
        <Rise d={1900} className="mt-4 text-[15px] text-white/85">
          あなたは「{typeName(myType)}」、友だちは「{typeName(friendType)}」
        </Rise>
      </div>
    ),
  });

  if (topics && topics.both.length > 0) {
    slides.push({
      id: "both",
      bg: ["#101014", "#6d28d9"],
      text: `2人とも見ている話題が ${topics.both.length} つあります`,
      node: (
        <div className="my-auto">
          <h2 className="text-[clamp(26px,7.5vw,38px)] font-black leading-[1.3]">
            <Rise>2人とも見ている話題</Rise>
          </h2>
          <p className="mt-1 font-black">
            <CountUp to={topics.both.length} delay={300} className="text-[clamp(72px,22vw,112px)] leading-none" />
            <span className="ml-1 text-2xl">つ</span>
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {topics.both.slice(0, 4).map((t, i) => (
              <span key={t} className="st-pop" style={{ animationDelay: `${800 + i * 120}ms` }}>
                <Thumb topic={t} />
                <span className="mt-1 line-clamp-1 block text-xs text-white/80">{topicLabel(t)}</span>
              </span>
            ))}
          </div>
          <Rise d={1500} className="mt-5 text-[15px] text-white/85">
            話が合うのは、たぶんこのあたりです。
          </Rise>
        </div>
      ),
    });
  }

  if (toMe.length > 0) {
    slides.push({
      id: "to-me",
      bg: ["#04151f", "#0369a1"],
      text: "友だちは見ているのに、あなたのおすすめには出てこない話題から、動画が届きました",
      hold: true,
      node: (
        <div className="my-auto">
          <Rise className="text-sm font-bold text-[#7cc8ff]">友だちの世界から、あなたへ</Rise>
          <h2 className="mt-2 text-[clamp(24px,7vw,34px)] font-black leading-[1.3]">
            <Rise d={100}>友だちは見ているのに、</Rise>
            <Rise d={170}>あなたには出てこない {toMe.length} 本</Rise>
          </h2>
          <VideoList topics={toMe} picks={picks} tone="#7cc8ff" />
        </div>
      ),
    });
  }

  if (toFriend.length > 0) {
    slides.push({
      id: "to-friend",
      bg: ["#1f0f04", "#c2410c"],
      text: "あなたは見ているのに、友だちのおすすめには出てこない話題から、動画を届けます",
      hold: true,
      node: (
        <div className="my-auto">
          <Rise className="text-sm font-bold text-(--light)">あなたの世界から、友だちへ</Rise>
          <h2 className="mt-2 text-[clamp(24px,7vw,34px)] font-black leading-[1.3]">
            <Rise d={100}>あなたは見ているのに、</Rise>
            <Rise d={170}>友だちには出てこない {toFriend.length} 本</Rise>
          </h2>
          <VideoList topics={toFriend} picks={picks} tone="var(--light)" />
          <Rise d={1000} className="mt-4 text-sm text-white/75">
            友だちがこの画面を開くと、同じ動画が「あなたの世界から」届きます。
          </Rise>
        </div>
      ),
    });
  }

  slides.push({
    id: "playlist",
    bg: ["#1f0a24", "#be185d"],
    text: "2人で交換したプレイリスト",
    hold: true,
    node: (
      <div className="my-auto text-center" data-no-nav>
        <Rise className="text-sm font-bold text-white/70">2人で交換した</Rise>
        <h2 className="mt-2 text-[clamp(30px,9vw,44px)] font-black leading-[1.2]">
          <Rise d={100}>プレイリスト</Rise>
        </h2>
        <div className="mx-auto mt-6 grid w-[min(80vw,340px)] grid-cols-3 gap-1.5">
          {[...toMe, ...toFriend].slice(0, 6).map((t, i) => (
            <span key={t} className="st-pop" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <Thumb topic={t} className="rounded-md" />
            </span>
          ))}
        </div>
        <div className="mx-auto mt-7 flex w-[min(80vw,340px)] flex-col gap-2.5">
          {playlist && (
            <a href={playlist} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-full bg-white font-bold text-[#1f0a24]">
              YouTube で続けて再生する
              <ExternalLink size={16} aria-hidden />
            </a>
          )}
          <button onClick={onClose} className="flex h-12 items-center justify-center rounded-full bg-white/15 font-bold">
            くわしく比べる
          </button>
        </div>
      </div>
    ),
  });

  return <Player slides={slides} onClose={onClose} />;
}
