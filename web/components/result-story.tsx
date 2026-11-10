"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleHelp, ExternalLink, Link2, Pause, RotateCcw, Share2, X } from "lucide-react";
import { GENRES, type Diagnosis, type GenreId, type Video } from "@/lib/genres";
import { bubbleCounts, diagnosisMetrics, outsideTopics, topicSplit, type FeedMetrics } from "@/lib/feed-metrics";
import { removeOutside, saveOutside } from "@/lib/diagnosis-store";
import { SeenButton, Ticker, useCameBack } from "@/components/outside-step";
import { TOPICS, topicLabel, topicsOf, genreOfTopic } from "@/lib/topics";
import { exposureOf, shownVideos } from "@/lib/exposure";
import { describeType, typeName, AXES } from "@/lib/bubble-type";
import { shareImage } from "@/lib/persona-image";
import { changeFrom, markOutside, previousOf, shortDate, snapshotOf, useHistory, type Change } from "@/lib/history";
import { toast } from "@/lib/toast";
import { SummaryCard } from "@/components/summary-card";

// 結果を、ストーリーのようなスライドで見せる（年末のまとめのように、1枚に1つずつ）。
// 長い結果の画面を読まなくても、約1分で「自分のおすすめのかたより」に気づけるようにする。
// 操作：右側を押すと次、左側で戻る、押し続けると止まる。←→ キー、Esc で閉じる。
// 1枚の長さは文字の量で決める（2.5秒＋1秒に8文字、4〜8秒）。答える・待つスライドは自動で進まない

type Persona = { oneLiner: string; age?: number; guesses: { label: string; guess: string; because: string }[] };
export type OutsideItem = { topic: string; reason: string; query: string; video: Suggestion | null };
export type Suggestion = { videoId: string; title: string; channel: string; thumbnail: string };
export type Slide = { id: string; bg: [string, string]; text: string; hold?: boolean; why?: string; node: ReactNode };

export const LIST = TOPICS.filter((t) => t.genre !== "other");
export const GOLDEN = 137.508 * (Math.PI / 180);
const thumb = (topic: string) => `/thumbs/${topic}.webp`;
const color = (g: GenreId) => GENRES.find((x) => x.id === g)?.color ?? "#64748b";
const msFor = (text: string) => Math.min(8000, Math.max(4000, 2500 + (text.length / 8) * 1000));
export const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 語句ごとに下から出す
export function Rise({ children, d = 0, className = "" }: { children: ReactNode; d?: number; className?: string }) {
  return (
    <span className={`st-rise ${className}`} style={{ animationDelay: `${d}ms` }}>
      {children}
    </span>
  );
}

// 数字を数え上げ、止まった瞬間に少し跳ねる
export function CountUp({ from = 0, to, delay = 300, ms = 1100, className = "" }: { from?: number; to: number; delay?: number; ms?: number; className?: string }) {
  const [v, setV] = useState(reduced() ? to : from);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.max(0, Math.min(1, (t - start) / ms));
      setV(from + (to - from) * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDone(true);
        buzz(18);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, ms]);
  return <span className={`num inline-block ${done ? "st-bump" : ""} ${className}`}>{Math.round(v)}</span>;
}

// 149 の話題の点。出てくる話題（lit）だけが、順番に灯る。
// extra は外へ出た話題（緑の点）。fresh はいま加わった話題で、点が跳ねて輪が広がる。
// glow をつけると、明るい点のまわりをにじませる（にじみ全体が「泡」に見える）
const OUT = "#7ff0dd";
function Dots({
  lit,
  extra = [],
  fresh = null,
  glow = false,
  size = "min(74vw, 330px)",
  fog = false,
}: {
  lit: string[];
  extra?: string[];
  fresh?: { topic: string; n: number } | null;
  glow?: boolean;
  size?: string;
  // 出てこない話題を主役にする：出てくる点はオレンジの丸、出てこない点は白い輪（色と形の両方で見分けられるように）
  fog?: boolean;
}) {
  const id = useId();
  const rank = new Map(lit.map((t, i) => [t, i]));
  const out = new Map(extra.filter((t) => !rank.has(t)).map((t, i) => [t, i]));
  const pts = LIST.map((t, i) => {
    const r = 3.9 * Math.sqrt(i + 0.5);
    return { id: t.id, x: 50 + r * Math.cos(i * GOLDEN), y: 50 + r * Math.sin(i * GOLDEN) };
  });
  const at = fresh ? pts.find((p) => p.id === fresh.topic) : undefined;
  return (
    <svg viewBox="0 0 100 100" style={{ width: size, height: size }} className="mx-auto shrink-0 overflow-visible" aria-hidden>
      {glow && (
        <>
          <defs>
            <radialGradient id={`${id}-in`}>
              <stop offset="0" stopColor="var(--light)" stopOpacity="0.45" />
              <stop offset="1" stopColor="var(--light)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-out`}>
              <stop offset="0" stopColor={OUT} stopOpacity="0.85" />
              <stop offset="1" stopColor={OUT} stopOpacity="0" />
            </radialGradient>
          </defs>
          {pts.map((p) =>
            (rank.has(p.id) && !fog) || out.has(p.id) ? (
              <circle
                key={`g-${p.id}`}
                cx={p.x}
                cy={p.y}
                r={out.has(p.id) ? 13 : 8}
                fill={`url(#${id}-${out.has(p.id) ? "out" : "in"})`}
                className={out.has(p.id) ? "ob-glow" : "st-fade"}
              />
            ) : null,
          )}
        </>
      )}
      {pts.map(({ id: t, x, y }) => {
        const k = rank.get(t);
        const o = out.get(t);
        if (o !== undefined) {
          return (
            <circle
              key={t}
              cx={x}
              cy={y}
              r={2.6}
              fill={OUT}
              className={fresh?.topic === t ? "ob-light" : "st-dot"}
              // いま加わった点は、点の中心を軸に跳ねる（CSS の ob-light）。ほかは灯る順を待つ
              style={fresh?.topic === t ? undefined : { transformOrigin: `${x}px ${y}px`, animationDelay: `${500 + (lit.length + o) * 28}ms` }}
            />
          );
        }
        if (fog && k === undefined) {
          return (
            <circle key={t} cx={x} cy={y} r={1.8} fill="none" stroke="#ffffff" strokeWidth={0.7} strokeOpacity={0.95} className="st-fade" style={{ transformOrigin: `${x}px ${y}px` }} />
          );
        }
        return (
          <circle
            key={t}
            cx={x}
            cy={y}
            r={k === undefined ? 1.25 : 2.1}
            fill={k === undefined ? "#ffffff" : "var(--light)"}
            fillOpacity={k === undefined ? 0.16 : 1}
            className={k === undefined ? "st-fade" : "st-dot"}
            style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${k === undefined ? 0 : 500 + k * 28}ms` }}
          />
        );
      })}
      {at &&
        [0, 1].map((j) => (
          <circle key={`r-${fresh!.n}-${j}`} cx={at.x} cy={at.y} r={2.6} strokeWidth={0.8} className="ob-ripple" style={{ animationDelay: `${j * 280}ms` }} />
        ))}
    </svg>
  );
}

export function Thumb({ topic, className = "", gray = false }: { topic: string; className?: string; gray?: boolean }) {
  return (
    <span className={`relative block aspect-video overflow-hidden rounded-xl bg-white/10 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 話題ごとの小さな静的画像 */}
      <img src={thumb(topic)} alt="" className={`absolute inset-0 size-full object-cover ${gray ? "opacity-60 grayscale" : ""}`} onError={(e) => (e.currentTarget.style.display = "none")} />
    </span>
  );
}

// 出てくる話題の並び：よく見る → たまに見る → 見ないが出てくる → 答えていない話題はジャンルの推定の高い順
function rankTopics(videos: Video[], byGenre: FeedMetrics["byGenre"]) {
  const score = new Map<string, number>();
  for (const v of videos) {
    if (!v.topic || v.topic.startsWith("other")) continue;
    const e = exposureOf(v);
    const s = e === "watched" ? (v.frequency === "often" ? 4 : 3) : e === "skipped" ? (v.frequency === "often" ? 2.5 : 2) : e === "shown" ? 2 : -1;
    score.set(v.topic, Math.max(score.get(v.topic) ?? -Infinity, s));
  }
  return LIST.map((t) => {
    if (score.has(t.id)) return { id: t.id, s: score.get(t.id)! };
    const g = byGenre[t.genre];
    const n = topicsOf(t.genre).length || 1;
    return { id: t.id, s: g ? Math.min(1, g.shownTopics / n) : 0 };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
}

// おすすめに出てこない話題から、ジャンルが重ならないように選ぶ（答えで「出てこない」としたものを先に）
function fogTopics(videos: Video[], lit: Set<string>, n: number) {
  const unseen = videos.filter((v) => v.topic && !v.topic.startsWith("other") && exposureOf(v) === "unseen").map((v) => v.topic!);
  const rest = LIST.map((t) => t.id).filter((id) => !lit.has(id) && !unseen.includes(id));
  const out: string[] = [];
  const used = new Set<GenreId>();
  for (const id of [...unseen, ...rest]) {
    const g = genreOfTopic(id);
    if (used.has(g)) continue;
    used.add(g);
    out.push(id);
    if (out.length >= n) break;
  }
  return out;
}

export function ResultStory({
  diagnosis,
  metrics: fm,
  type,
  start,
  onClose,
}: {
  diagnosis: Diagnosis;
  metrics: FeedMetrics;
  type: string;
  // 最初に見せるスライド（くわしい結果の画面から、出てこない動画の一覧を開くときなど）
  start?: string;
  onClose: () => void;
}) {
  const who = diagnosis.source === "sample" ? "この人" : "あなた";
  const videos = diagnosis.videos;
  // 主役の数：149 の話題のうち、おすすめに一度でも出てくる話題（kinds）と、一度も出てこない話題（fogCount）。足すと 149
  const split = topicSplit(fm);
  const kinds = split.shown;
  const ranked = useMemo(() => rankTopics(videos, fm.byGenre), [videos, fm.byGenre]);
  const shownCount = Math.round((LIST.length * fm.breadth) / 100);
  const lit = ranked.slice(0, Math.min(shownCount, LIST.length));
  const fogCount = split.fog;
  const fogs = useMemo(() => fogTopics(videos, new Set(ranked), 5), [videos, ranked]);
  const skipped = videos.filter((v) => v.topic && !v.topic.startsWith("other") && exposureOf(v) === "skipped");
  const top = fm.top3Topics.filter((t) => !t.startsWith("other"));
  const prediction = diagnosis.prediction ?? null;
  // 前回の記録があるときだけ、くらべる1枚を足す（同じ調べ方の前回と）
  const history = useHistory();
  const current = snapshotOf(diagnosis, fm);
  const change = diagnosis.source === "sample" ? null : changeFrom(previousOf(history, current), current);

  // AI（Gemini）の推定と、出てこない話題の本物の動画は、最初に頼んでおく（そのスライドに来るまでに届くように）
  const personaKey = `persona:${diagnosis.createdAt}`;
  const [persona, setPersona] = useState<Persona | null | "failed">(() => {
    try {
      const s = sessionStorage.getItem(personaKey);
      return s ? (JSON.parse(s) as Persona) : null;
    } catch {
      return null;
    }
  });
  const [picks, setPicks] = useState<Record<string, Suggestion | null> | null>(null);
  useEffect(() => {
    if (persona) return;
    fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videos: shownVideos(videos).slice(0, 40).map((v) => ({ title: v.title, topic: v.topic, frequency: v.frequency })) }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Persona) : Promise.reject()))
      .then((p) => {
        setPersona(p);
        try {
          sessionStorage.setItem(personaKey, JSON.stringify(p));
        } catch {}
      })
      .catch(() => setPersona("failed"));
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 外への5本：好きな話題とつながる「出てこない話題」を、AI（Gemini）に選んでもらう。
  // AI を休ませているときや失敗したときは、ジャンルが重ならないように選ぶ、いままでの選び方に戻す
  const likes = useMemo(() => {
    const watched = videos.filter((v) => v.topic && !v.topic.startsWith("other") && exposureOf(v) === "watched").map((v) => v.topic!);
    return [...new Set([...top, ...watched])].slice(0, 6);
  }, [videos, top]);
  const candidates = useMemo(() => {
    const unseen = videos.filter((v) => v.topic && !v.topic.startsWith("other") && exposureOf(v) === "unseen").map((v) => v.topic!);
    const lit = new Set(ranked);
    // 「出てこない」と答えた話題を先に、残りはジャンルが偏らないように、ジャンルを順番に1つずつ取る
    const rest = LIST.map((t) => t.id).filter((id) => !lit.has(id) && !unseen.includes(id));
    const byGenre = new Map<string, string[]>();
    for (const id of rest) byGenre.set(id.split(".")[0], [...(byGenre.get(id.split(".")[0]) ?? []), id]);
    const mixed: string[] = [];
    for (let i = 0; mixed.length < rest.length; i++) for (const list of byGenre.values()) if (list[i]) mixed.push(list[i]);
    return [...new Set([...unseen, ...mixed])].slice(0, 30);
  }, [videos, ranked]);
  const [asked, setAiPicks] = useState<OutsideItem[] | null | "failed">(null);
  const canAsk = likes.length > 0 && candidates.length >= 5;
  const aiPicks = canAsk ? asked : "failed";
  const pickKey = likes.join(",") + "|" + candidates.join(",");
  useEffect(() => {
    if (!canAsk) return;
    fetch("/api/outside", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ likes, candidates }) })
      .then((r) => (r.ok ? (r.json() as Promise<{ items: OutsideItem[] }>) : Promise.reject()))
      .then((d) => setAiPicks(d.items.length ? d.items : "failed"))
      .catch(() => setAiPicks("failed"));
    // 中身が同じなら頼み直さない（「見た」を押すと診断が書き直されるため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickKey]);
  const byAi = Array.isArray(aiPicks);
  const outFogs = byAi ? aiPicks.map((p) => p.topic) : fogs;
  // AI が使えないときだけ、話題ごとに動画を探す
  const fogKey = fogs.join(",");
  useEffect(() => {
    if (aiPicks !== "failed" || !fogKey) return;
    fetch(`/api/suggest?topics=${fogKey}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ items: Record<string, Suggestion | null> }>) : Promise.reject()))
      .then((d) => setPicks(d.items))
      .catch(() => setPicks({}));
  }, [fogKey, aiPicks]);
  const pickOf = (t: string) => (byAi ? (aiPicks.find((p) => p.topic === t)?.video ?? null) : picks?.[t]);
  const reasonOf = (t: string) => (byAi ? aiPicks.find((p) => p.topic === t)?.reason : undefined);
  // 動画が見つからないとき（YouTube の検索の上限など）は、AI が考えた言葉で YouTube の検索を開く（回数を使わない）
  const wordsOf = (t: string) => {
    const q = byAi ? aiPicks.find((p) => p.topic === t)?.query : undefined;
    if (!q) return topicLabel(t);
    // AI の言葉に話題の名前がもう入っていれば、重ねて足さない
    const label = topicLabel(t).split("・");
    return label.some((w) => q.includes(w)) ? q : `${label.join(" ")} ${q}`;
  };
  const searchUrl = (t: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(wordsOf(t))}`;
  const loading = aiPicks === null || (aiPicks === "failed" && picks === null);

  // 外へ出た話題：動画を開いたら「見た」を出し、押すと地図（点）と数字に足す
  const outside = outsideTopics(diagnosis);
  const grown = diagnosisMetrics(diagnosis, outside);
  const counts = bubbleCounts(fm, grown);
  const [opened, setOpened] = useState<Set<string>>(() => new Set(outside));
  const [fresh, setFresh] = useState<{ topic: string; n: number } | null>(null);
  const cameBack = useCameBack([...opened].some((t) => !outside.includes(t)));
  const open = (topics: string[]) => setOpened((o) => new Set([...o, ...topics]));
  function toggleSeen(topic: string, s: Suggestion | null | undefined) {
    if (outside.includes(topic)) {
      removeOutside(topic);
      setFresh(null);
      buzz(10);
      return;
    }
    saveOutside({ topic, videoId: s?.videoId, title: s?.title });
    setFresh((f) => ({ topic, n: (f?.n ?? 0) + 1 }));
    buzz(35);
  }

  // クイズ：いちばん多い話題を当てる（正解1つ＋ほかの答えから2つ）
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const quiz = useMemo(() => {
    if (top.length === 0) return null;
    const others = [top[1], fogs[0], top[2], fogs[1]].filter((x): x is string => Boolean(x) && x !== top[0]).slice(0, 2);
    if (others.length < 2) return null;
    const opts = [top[0], ...others];
    // 正解の位置は、話題の名前から決める（毎回同じ並びにして、ずれないように）
    const shift = top[0].length % 3;
    return { answer: top[0], options: [...opts.slice(shift), ...opts.slice(0, shift)] };
  }, [top, fogs]);

  const nextOut = outFogs.find((t) => !outside.includes(t));
  const nextVideo = nextOut ? pickOf(nextOut) : null;
  const videoIds = outFogs.map(pickOf).filter((s): s is Suggestion => Boolean(s)).map((s) => s.videoId);

  const slides: Slide[] = [];
  const answered = videos.filter((v) => v.topic && !v.topic.startsWith("other")).map((v) => v.topic!);

  slides.push({
    id: "intro",
    bg: ["#0b0d12", "#1d2b64"],
    text: "あなたの YouTube のおすすめを、のぞいてみよう",
    node: (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-[16%] -rotate-6 space-y-3 opacity-50" aria-hidden>
          {[0, 1].map((row) => (
            <div key={row} className={`flex w-max gap-3 ${row ? "st-marquee-rev" : "st-marquee"}`}>
              {[...answered, ...answered].filter((_, i) => i % 2 === row).map((t, i) => (
                <Thumb key={`${t}-${i}`} topic={t} className="w-40 shrink-0" />
              ))}
            </div>
          ))}
        </div>
        <div className="relative mt-auto">
          <Rise className="text-sm font-bold text-white/70">カード {videos.length} 枚の答えから</Rise>
          <h2 className="mt-3 text-[clamp(34px,10vw,52px)] font-black leading-[1.15]">
            <Rise d={150}>{who}の YouTube の</Rise>
            <Rise d={220}>おすすめを、</Rise>
            <Rise d={290}>のぞいてみよう</Rise>
          </h2>
        </div>
      </>
    ),
  });

  if (quiz) {
    slides.push({
      id: "quiz",
      bg: ["#2b0a3d", "#7a1fa2"],
      text: "まず問題。いちばん多い話題は？",
      hold: !quizAnswer,
      node: (
        <div className="my-auto">
          <Rise className="text-sm font-bold text-white/70">まず問題</Rise>
          <h2 className="mt-3 text-[clamp(26px,7.5vw,38px)] font-black leading-[1.25]">
            <Rise d={100}>{who}のおすすめで、</Rise>
            <Rise d={170}>いちばん多い話題は？</Rise>
          </h2>
          <div className="mt-7 grid gap-3" data-no-nav>
            {quiz.options.map((o, i) => {
              const right = quizAnswer && o === quiz.answer;
              const wrong = quizAnswer === o && o !== quiz.answer;
              return (
                <button
                  key={o}
                  disabled={Boolean(quizAnswer)}
                  onClick={() => {
                    setQuizAnswer(o);
                    buzz(o === quiz.answer ? 30 : 12);
                  }}
                  className={`st-pop flex items-center gap-3 rounded-2xl p-2 pr-4 text-left font-bold transition ${
                    right ? "bg-white text-[#2b0a3d]" : wrong ? "bg-white/10 text-white/50 line-through" : "bg-white/12 hover:bg-white/20"
                  }`}
                  style={{ animationDelay: `${350 + i * 90}ms` }}
                >
                  <Thumb topic={o} className="w-24 shrink-0" />
                  <span className="text-[17px] leading-snug">{topicLabel(o)}</span>
                </button>
              );
            })}
          </div>
          {quizAnswer && (
            <Rise className="mt-5 text-lg font-bold">{quizAnswer === quiz.answer ? who === "あなた" ? "正解！ 自分のことは、わかっていますね" : "正解！" : `じつは「${topicLabel(quiz.answer)}」でした`}</Rise>
          )}
        </div>
      ),
    });
  }

  // 予想は「一度も出てこない話題の数」
  const gap = prediction != null ? prediction - fogCount : null;
  slides.push({
    id: "kinds",
    bg: ["#06101d", "#0f3a6b"],
    text: `${TOPICS.length} の話題のうち約 ${fogCount} の話題は、${who}のおすすめに一度も出てきません`,
    why: "答えから、それぞれの話題が一度でもおすすめに出てくるかを推定しました。「出てこない」と答えた話題と、同じジャンルの答えから出てこないと推定した話題を数えています。オレンジの点が出てくる話題、白い輪が一度も出てこない話題です。",
    node: (
      <div className="my-auto text-center">
        <Dots lit={lit} fog />
        <p className="mt-3 flex justify-center gap-5 text-xs font-bold text-white/85">
          <span><span style={{ color: "var(--light)" }}>●</span> 出てくる話題</span>
          <span>○ 一度も出てこない話題</span>
        </p>
        <p className="mt-4 text-sm font-bold text-white/70">
          <Rise>{TOPICS.length} の話題のうち、{who}のおすすめに一度も出てこないのは</Rise>
        </p>
        <p className="mt-1 font-black leading-none">
          <span className="text-2xl">約</span>
          <CountUp from={prediction ?? 0} to={fogCount} delay={600} className="mx-2 text-[clamp(96px,30vw,150px)] text-white" />
          <span className="text-2xl">/ {TOPICS.length}</span>
        </p>
        {gap !== null && (
          <Rise d={1900} className="mt-3 text-base font-bold">
            予想は {prediction}。{gap > 0 ? `予想より ${gap} 少なめでも、約 ${fogCount} の話題が一度も届いていません` : gap < 0 ? `思っていたより ${-gap} 多くの話題が、一度も届いていません` : `予想どおり、約 ${fogCount} の話題が一度も届いていません`}
          </Rise>
        )}
      </div>
    ),
  });

  if (change) slides.push(compareSlide(change, kinds));

  if (top.length >= 3) {
    slides.push({
      id: "top3",
      bg: ["#2a0b0b", "#c2410c"],
      // 多い3つの割合が小さいとき（話題が広く散っているとき）は、% を主役にしない
      text: fm.top3 >= 15 ? `おすすめの ${Math.round(fm.top3)}% は、この3つの話題です` : "いちばんよく出てくるのは、この3つの話題です",
      why: "「よく出る」はほぼ毎日、「たまに出る」は週に1〜2本として、おすすめに出てくる量を話題ごとに比べました。",
      node: (
        <div className="my-auto">
          <h2 className="text-[clamp(26px,7.5vw,38px)] font-black leading-[1.25]">
            {fm.top3 >= 15 ? (
              <>
                <Rise>おすすめの</Rise>
                <Rise d={80}>
                  <CountUp to={Math.round(fm.top3)} delay={400} className="text-[clamp(72px,22vw,112px)] leading-none text-[#ffd166]" />
                  <span className="text-[0.9em]">%</span> は、
                </Rise>
                <Rise d={160}>この3つの話題</Rise>
              </>
            ) : (
              <>
                <Rise>いちばんよく出てくるのは、</Rise>
                <Rise d={120}>この3つの話題</Rise>
              </>
            )}
          </h2>
          <ol className="mt-6 space-y-3">
            {top.slice(0, 3).map((t, i) => (
              <li key={t} className="st-pop flex items-center gap-3" style={{ animationDelay: `${1500 + (2 - i) * 450}ms` }}>
                <span className="num w-7 text-3xl font-black text-white/60">{i + 1}</span>
                <Thumb topic={t} className="w-28 shrink-0" />
                <span className="text-lg font-bold leading-snug">{topicLabel(t)}</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    });
  }

  if (skipped.length > 0) {
    slides.push({
      id: "skipped",
      bg: ["#04211f", "#0f766e"],
      text: `見ないのに、おすすめに出てくる動画が ${skipped.length} 本ありました`,
      node: (
        <div className="my-auto">
          <h2 className="text-[clamp(26px,7.5vw,38px)] font-black leading-[1.3]">
            <Rise>見ないのに、</Rise>
            <Rise d={80}>おすすめに出てくる</Rise>
          </h2>
          <p className="mt-2 font-black">
            <CountUp to={skipped.length} delay={300} className="text-[clamp(72px,22vw,112px)] leading-none text-[#7ff0dd]" />
            <span className="ml-1 text-2xl">本</span>
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {skipped.slice(0, skipped.length > 4 ? 3 : 4).map((v, i) => (
              <span key={v.topic} className="st-pop" style={{ animationDelay: `${900 + i * 120}ms` }}>
                <Thumb topic={v.topic!} />
                <span className="mt-1 line-clamp-1 block text-xs text-white/75">{topicLabel(v.topic!)}</span>
              </span>
            ))}
            {skipped.length > 4 && (
              <span className="st-pop grid aspect-video place-items-center rounded-xl bg-white/10 text-lg font-bold" style={{ animationDelay: "1260ms" }}>
                ほか {skipped.length - 3} 本
              </span>
            )}
          </div>
          <Rise d={1500} className="mt-5 text-[15px] leading-relaxed text-white/85">
            見ていなくても、YouTube はこれらを{who}に出し続けています。
          </Rise>
        </div>
      ),
    });
  }

  slides.push({
    id: "fog",
    bg: ["#0c0c0f", "#3f3f46"],
    text: `たとえば、こんな話題が${who}のおすすめに出てきません`,
    why: "「出てこない」と答えた話題と、同じジャンルの答えから出てこないと推定した話題から、いくつかを見せています。",
    node: (
      <div className="my-auto">
        <div className="grid grid-cols-3 gap-2 opacity-90">
          {[...fogs, ...LIST.map((t) => t.id).filter((id) => !ranked.includes(id) && !fogs.includes(id))].slice(0, 9).map((t, i) => (
            <span key={t} className="st-pop" style={{ animationDelay: `${i * 70}ms` }}>
              <Thumb topic={t} gray />
            </span>
          ))}
        </div>
        <h2 className="mt-7 text-[clamp(26px,7.5vw,36px)] font-black leading-[1.3]">
          <Rise d={700}>たとえば、こんな話題が</Rise>
          <Rise d={800}>{who}のおすすめに</Rise>
          <Rise d={900}>出てきません</Rise>
        </h2>
        <Rise d={1100} className="mt-3 text-[15px] text-white/75">
          ほかにも、ぜんぶで約 {fogCount} あります
        </Rise>
      </div>
    ),
  });

  const axes = describeType(type);
  slides.push({
    id: "type",
    bg: ["#140b2e", color(genreOfTopic(top[0] ?? "game.fps"))],
    text: `${who}の見方のタイプは、${typeName(type)}`,
    why: `答えで「見る」とした動画のジャンルから、4つの組で決めました。${AXES.map((a, i) => `${a.question}→「${axes[i]}」`).join("。")}。`,
    node: (
      <div className="my-auto">
        <Rise className="text-sm font-bold text-white/70">{who}の見方のタイプ</Rise>
        <h2 className="mt-4 text-[clamp(40px,12vw,64px)] font-black leading-[1.1]">
          <Rise d={120}>{typeName(type)}</Rise>
        </h2>
        <div className="mt-7 flex flex-wrap gap-2">
          {axes.map((a, i) => (
            <span key={a} className="st-pop rounded-full bg-white/15 px-4 py-2 text-[15px] font-bold" style={{ animationDelay: `${700 + i * 120}ms` }}>
              {a}
            </span>
          ))}
        </div>
      </div>
    ),
  });

  const p = persona && persona !== "failed" ? persona : null;
  slides.push({
    id: "persona",
    bg: ["#071a3a", "#1a73e8"],
    text: p ? `${who}の答えから AI が想像した、YouTube に見えていそうな${who}は、${p.oneLiner}` : "AI が考えています",
    hold: persona === null,
    why: "カードで「出てくる」と答えた動画の題名だけを AI（Google の Gemini）に渡し、YouTube にどんな人だと見えていそうかを想像してもらいました。YouTube が実際にどう思っているかではありません。題名は保存しません。",
    node: (
      <div className="my-auto">
        <Rise className="text-sm font-bold text-white/70">{who}の答えから、AI（Google の Gemini）が想像した</Rise>
        <h2 className="mt-3 text-[clamp(26px,7.5vw,38px)] font-black leading-[1.3]">
          <Rise d={100}>YouTube に見えていそうな{who}は</Rise>
        </h2>
        {persona === null && <p className="mt-8 animate-pulse text-lg text-white/80">「出てくる」と答えた動画の題名を、AI が読んでいます</p>}
        {persona === "failed" && <p className="mt-8 text-lg text-white/80">いまは推定できませんでした。くわしい結果の画面で、あとからもう一度試せます。</p>}
        {p && (
          <>
            {p.age && (
              <p className="mt-4 font-black">
                <CountUp to={p.age} delay={400} className="text-[clamp(88px,26vw,132px)] leading-none" />
                <span className="ml-1 text-2xl">歳くらいの</span>
              </p>
            )}
            <Rise d={1300} className="mt-3 text-[clamp(22px,6.4vw,30px)] font-black leading-[1.35]">
              {p.age ? p.oneLiner.replace(/^\d+歳(くらい)?[・、の]?/, "") : p.oneLiner}
            </Rise>
            <div className="mt-6 space-y-2">
              {p.guesses.filter((g) => !g.label.includes("年齢") && !p.oneLiner.includes(g.guess.replace(/に見えていそうです。?$/, ""))).slice(0, 2).map((g, i) => (
                <p key={g.label} className="st-pop rounded-xl bg-white/12 px-4 py-3 text-[15px]" style={{ animationDelay: `${1900 + i * 200}ms` }}>
                  <span className="font-bold">{g.label}：</span>
                  {g.guess}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    ),
  });

  const playlist = videoIds.length > 1 ? `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}` : null;
  slides.push({
    id: "playlist",
    bg: ["#1f0a24", "#be185d"],
    text: "いつものおすすめには出てこない動画を、集めました",
    hold: true,
    node: (
      <div className="my-auto">
        <h2 className="text-[clamp(24px,7vw,34px)] font-black leading-[1.25]">
          <Rise>いつものおすすめには</Rise>
          <Rise d={80}>出てこない {outFogs.length} 本</Rise>
        </h2>
        <Rise d={160} className="mt-2 text-sm leading-relaxed text-white/80">
          {byAi
            ? `${who}の好きな話題とつながる、いつもは出てこない話題を、AI（Google の Gemini）が選びました。${outFogs.some((t) => !pickOf(t)) && !loading ? "動画が見つからない話題は、AI が考えた言葉で YouTube を探します。" : "実際の YouTube の動画です。"}見たら「見た」を押してください。`
            : `${who}のおすすめに出てこない話題の、実際の YouTube の動画です。見たら「見た」を押してください。`}
        </Rise>

        {/* 泡の地図。「見た」を押すと、その話題の点が緑に灯り、数字が変わる */}
        <div className="st-pop mt-4 flex items-center gap-4 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10" style={{ animationDelay: "250ms" }} data-no-nav>
          <Dots lit={lit} extra={outside} fresh={fresh} glow fog size="108px" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white/75">一度も出てこない話題</p>
            <p className="font-black leading-none">
              <span className="text-sm">約</span>
              <Ticker value={counts.fog} className="mx-1 text-[34px] text-white" />
              <span className="text-sm">/ {TOPICS.length}</span>
            </p>
            <p className="mt-1.5 text-xs text-white/75">おすすめが変わったかは、1週間後にもう一度調べるとわかります</p>
            <p className="mt-1.5 min-h-4 text-xs font-bold text-[#7ff0dd]">
              {outside.length > 0 ? (
                <>
                  外へ出た話題 <Ticker value={outside.length} className="text-sm" /> つ
                  {fresh && outside.includes(fresh.topic) && (
                    <span key={fresh.n} className="st-fade ml-1 text-white/85">
                      ＋{topicLabel(fresh.topic)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-white/60">見た話題は、緑の点で地図に残ります</span>
              )}
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-2" data-no-nav>
          {outFogs.map((t, i) => {
            const s = pickOf(t);
            const why = reasonOf(t);
            const done = outside.includes(t);
            return (
              <li key={t} className="st-pop flex items-center gap-2" style={{ animationDelay: `${400 + i * 110}ms` }}>
                <a
                  href={s ? `https://www.youtube.com/watch?v=${s.videoId}` : searchUrl(t)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    open([t]);
                    markOutside(current.id, [t]);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 pr-3 transition ${done ? "bg-[#7ff0dd]/15 ring-1 ring-[#7ff0dd]/50" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {s ? (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube のサムネ
                    <img src={s.thumbnail} alt="" className="aspect-video w-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <Thumb topic={t} className="w-20 shrink-0 rounded-lg" />
                  )}
                  <span className="min-w-0">
                    <span className={`block text-[11px] font-bold ${done ? "text-[#7ff0dd]" : "text-white/60"}`}>{topicLabel(t)}</span>
                    <span className="line-clamp-2 text-[13px] font-bold leading-snug">{s ? s.title : loading ? "探しています" : `「${wordsOf(t)}」を YouTube で探す`}</span>
                    {why && <span className="mt-0.5 block text-[11px] leading-snug text-[#ffd6f0]">AI：{why}</span>}
                  </span>
                </a>
                {(opened.has(t) || done) && <SeenButton done={done} nudge={cameBack} label={topicLabel(t)} onPress={() => toggleSeen(t, s)} />}
              </li>
            );
          })}
        </ul>
        {playlist && (
          <a
            href={playlist}
            target="_blank"
            rel="noopener noreferrer"
            data-no-nav
            onClick={() => {
              open(outFogs);
              markOutside(current.id, outFogs);
            }}
            className="st-pop mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-white font-bold text-[#1f0a24]"
            style={{ animationDelay: "1100ms" }}
          >
            YouTube で続けて再生する
            <ExternalLink size={16} aria-hidden />
          </a>
        )}
        {/* 読み上げ用。録画の台本などがスライドの文を .sr-only で読むので、別の書き方で隠す */}
        <p className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]" aria-live="polite">
          {fresh && outside.includes(fresh.topic)
            ? `「${topicLabel(fresh.topic)}」を見ました。外へ出た話題は ${outside.length} つです。`
            : ""}
        </p>
      </div>
    ),
  });

  const [drawing, setDrawing] = useState(false);
  async function share() {
    setDrawing(true);
    try {
      const blob = await drawSummary({ who, kinds, top3: Math.round(fm.top3), fogCount, typeLabel: typeName(type), type, top: top.slice(0, 3) });
      await shareImage(blob, "bubble-summary.png");
    } finally {
      setDrawing(false);
    }
  }
  // 共有リンク：押したときだけ、まとめの数と話題の名前を保存してリンクを作る。同じ診断では1つのリンクを使い回す
  const [linking, setLinking] = useState(false);
  async function shareLink() {
    setLinking(true);
    try {
      const key = `share:${diagnosis.createdAt}`;
      let id: string | null = null;
      try {
        id = sessionStorage.getItem(key);
      } catch {}
      if (!id) {
        const res = await fetch("/api/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kinds, top: top.slice(0, 3), top3: Math.round(fm.top3), type, fogCount, sample: diagnosis.source === "sample" }),
        });
        if (!res.ok) throw new Error();
        id = ((await res.json()) as { id: string }).id;
        try {
          sessionStorage.setItem(key, id);
        } catch {}
      }
      const url = `${location.origin}/s/${id}`;
      const text = `${diagnosis.source === "sample" ? "見本の人" : "わたし"}の YouTube のおすすめには、${TOPICS.length} の話題のうち約 ${fogCount} が一度も出てこなかった。あなたは？`;
      if (navigator.share) {
        await navigator.share({ title: "バブル診断", text, url }).catch(() => {});
      } else {
        await navigator.clipboard.writeText(url);
        toast("リンクをコピーしました");
      }
    } catch {
      toast("リンクを作れませんでした。少しあけてから試してください", "err");
    } finally {
      setLinking(false);
    }
  }
  slides.push({
    id: "summary",
    bg: ["#0b0d12", color(genreOfTopic(top[0] ?? "game.fps"))],
    text: "まとめ",
    hold: true,
    node: (
      <div className="my-auto" data-no-nav>
        <SummaryCard className="st-pop" who={who} kinds={kinds} top={top.slice(0, 3)} top3={Math.round(fm.top3)} type={type} fogCount={fogCount} />
        {outside.length > 0 && <p className="mt-2 text-center text-xs font-bold text-[#7ff0dd]">外へ出た話題　{outside.length}つ</p>}
        <div className="mx-auto mt-6 flex w-[min(80vw,340px)] flex-col gap-2.5">
          {/* 締めは「外へ1歩」。まだ見ていない外の1本を、いちばん目立つボタンにする */}
          {nextOut && (
            <a
              href={nextVideo ? `https://www.youtube.com/watch?v=${nextVideo.videoId}` : searchUrl(nextOut)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                open([nextOut]);
                markOutside(current.id, [nextOut]);
              }}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-center font-bold text-[#0b0d12]"
            >
              <ExternalLink size={18} aria-hidden />
              まだ見ていない1本を見る（{topicLabel(nextOut)}）
            </a>
          )}
          {top.length > 0 && (
            <button onClick={shareLink} disabled={linking} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 font-bold disabled:opacity-60">
              <Link2 size={18} aria-hidden />
              {linking ? "リンクを作っています" : "リンクで共有する"}
            </button>
          )}
          <button onClick={share} disabled={drawing} className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 font-bold disabled:opacity-60">
            <Share2 size={18} aria-hidden />
            {drawing ? "画像を作っています" : "画像にして共有する"}
          </button>
          <button onClick={onClose} className="flex h-12 items-center justify-center rounded-full bg-white/15 font-bold">
            くわしい結果を見る
          </button>
        </div>
        {top.length > 0 && <p className="mt-3 text-center text-xs text-white/60">リンクで見られるのは、このまとめだけです</p>}
        {/* カードの答えは「自分が思っているおすすめ」。実際のホーム画面と比べる入口は、まとめの下に小さく置く（締めはまとめのまま） */}
        {diagnosis.source === "swipe" && (
          <a href="/check" className="mt-4 flex min-h-11 items-center justify-center gap-1 text-center text-sm font-bold text-white/80 underline underline-offset-4">
            ここまでは答えから出した結果です。ホーム画面のスクリーンショットで答え合わせする
          </a>
        )}
      </div>
    ),
  });

  const startAt = start ? Math.max(0, slides.findIndex((x) => x.id === start)) : 0;
  return <Player slides={slides} start={startAt} onClose={onClose} />;
}

// スライドを再生する部分（進行バー・押して進む／戻る・押し続けて止める）
export function Player({ slides, start = 0, onClose }: { slides: Slide[]; start?: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [paused, setPaused] = useState(false);
  const [why, setWhy] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  const held = useRef<{ t: number; timer: ReturnType<typeof setTimeout> | null; long: boolean }>({ t: 0, timer: null, long: false });
  const slide = slides[Math.min(index, slides.length - 1)];
  const last = slides.length - 1;
  const stop = paused || why;
  const ms = slide.hold ? null : msFor(slide.text);

  const go = useCallback(
    (d: number) => {
      setWhy(false);
      setIndex((i) => {
        const n = Math.max(0, Math.min(last, i + d));
        if (n !== i) elapsed.current = 0;
        return n;
      });
    },
    [last],
  );

  // 進行バーと自動送り（止めているあいだは時間を進めない）
  useEffect(() => {
    if (ms === null) {
      if (bar.current) bar.current.style.transform = `scaleX(${slide.hold ? 0.04 : 1})`;
      return;
    }
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      if (!stop) elapsed.current += t - prev;
      prev = t;
      const p = Math.min(1, elapsed.current / ms);
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (p >= 1) return go(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, ms, stop, go, slide.hold]);

  // キー操作と、開いているあいだ後ろの画面が動かないようにする
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  function down(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-no-nav],button,a")) return;
    held.current.t = performance.now();
    held.current.long = false;
    held.current.timer = setTimeout(() => {
      held.current.long = true;
      setPaused(true);
    }, 220);
  }
  function up(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-no-nav],button,a")) return;
    if (held.current.timer) clearTimeout(held.current.timer);
    if (held.current.long) {
      setPaused(false);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black text-white" role="dialog" aria-modal aria-label="結果のスライド">
      <div className="relative flex h-dvh w-full max-w-[480px] select-none flex-col overflow-hidden" onPointerDown={down} onPointerUp={up} onPointerCancel={() => setPaused(false)}>
        {/* 背景：スライドごとの色を重ねて、切り替えるときに溶け合わせる */}
        {slides.map((s, i) => (
          <div
            key={s.id}
            aria-hidden
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: i === index ? 1 : 0, background: `radial-gradient(120% 80% at 80% 0%, ${s.bg[1]}, transparent 65%), radial-gradient(100% 70% at 0% 100%, ${s.bg[1]}66, ${s.bg[0]} 75%)` }}
          />
        ))}
        <div aria-hidden className="st-drift pointer-events-none absolute -inset-1/4 opacity-40" style={{ background: `radial-gradient(40% 30% at 30% 60%, ${slide.bg[1]}88, transparent 70%)` }} />

        {/* 進行バーと閉じるボタン */}
        <div className="relative z-10 flex gap-1 px-3 pt-[max(12px,env(safe-area-inset-top))]" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              {i < index && <span className="block h-full w-full bg-white" />}
              {i === index && <span ref={bar} className="st-bar block h-full w-full bg-white" />}
            </span>
          ))}
        </div>
        <div className="relative z-10 flex items-center justify-between px-3 pt-2">
          <span className="text-xs font-bold text-white/70">
            {paused ? (
              <span className="inline-flex items-center gap-1">
                <Pause size={12} aria-hidden />
                止めています
              </span>
            ) : (
              <span className="num">
                {index + 1} / {slides.length}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {index > 0 && (
              <button onClick={() => go(-index)} aria-label="最初から見る" className="grid size-10 place-items-center rounded-full hover:bg-white/10">
                <RotateCcw size={18} aria-hidden />
              </button>
            )}
            <button onClick={onClose} aria-label="スライドを閉じて、くわしい結果を見る" className="grid size-10 place-items-center rounded-full hover:bg-white/10">
              <X size={22} aria-hidden />
            </button>
          </span>
        </div>

        {/* 本文。スライドが変わるたびに作り直して、出てくる動きを最初から流す */}
        <div key={slide.id} className="relative z-0 flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          {slide.node}
          {slide.why && (
            <button onClick={() => setWhy(true)} className="st-fade mt-4 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-bold text-white/75" style={{ animationDelay: "1.2s" }}>
              <CircleHelp size={16} aria-hidden />
              なぜ、この結果？
            </button>
          )}
        </div>

        {why && slide.why && (
          <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-[#0b0d12]/95 p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10" data-no-nav>
            <p className="text-sm leading-relaxed text-white/90">{slide.why}</p>
            <button onClick={() => setWhy(false)} className="mt-4 h-11 w-full rounded-full bg-white/15 font-bold">
              閉じて続きを見る
            </button>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {slide.text}
        </p>
      </div>
    </div>
  );
}

// まとめの画像（1080×1920、縦長。ストーリーに貼れる大きさ）。上下 250px には大事な文字を置かない
async function drawSummary(d: { who: string; kinds: number; top3: number; fogCount: number; typeLabel: string; type: string; top: string[] }) {
  const W = 1080;
  const H = 1920;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1d2b64");
  g.addColorStop(1, "#0b0d12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ff8d28";
  ctx.font = `700 40px ${font}`;
  ctx.fillText("● バブル診断", 90, 330);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 48px ${font}`;
  ctx.fillText(`${d.who}の YouTube のおすすめに、`, 90, 420);
  ctx.fillText("一度も出てこない話題", 90, 480);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 64px ${font}`;
  ctx.fillText("約", 90, 700);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 260px ${font}`;
  ctx.fillText(String(d.fogCount), 170, 720);
  const w = ctx.measureText(String(d.fogCount)).width;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 64px ${font}`;
  ctx.fillText(`/ ${TOPICS.length}`, 200 + w, 700);
  const imgs = await Promise.all(
    d.top.map(
      (t) =>
        new Promise<HTMLImageElement | null>((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = thumb(t);
        }),
    ),
  );
  const tw = 280;
  const th = 158;
  imgs.forEach((im, i) => {
    const x = 90 + i * (tw + 20);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, 800, tw, th, 18);
    ctx.clip();
    if (im) ctx.drawImage(im, x, 800, tw, th);
    else {
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x, 800, tw, th);
    }
    ctx.restore();
  });
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 40px ${font}`;
  ctx.fillText(d.top3 >= 15 ? `よく出る3つの話題で ${d.top3}%` : "よく出る3つの話題", 90, 1040);
  ctx.font = `500 36px ${font}`;
  ctx.fillText(d.top.map(topicLabel).join("・").slice(0, 26), 90, 1100);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 38px ${font}`;
  ctx.fillText("見方のタイプ", 90, 1260);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 84px ${font}`;
  ctx.fillText(d.typeLabel, 90, 1360);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 40px ${font}`;
  ctx.fillText(`おすすめに出てくる話題　約 ${d.kinds} / ${TOPICS.length}`, 90, 1500);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `500 32px ${font}`;
  ctx.fillText("あなたのおすすめに、出てこない話題はいくつ？", 90, 1640);
  return new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
}

// 前回とくらべる1枚。前回の大きさ（点線の円）から、今回の大きさへ円が広がる（せまくなる）
function compareSlide({ previous, diff, added, reached }: Change, kinds: number): Slide {
  const grew = diff > 0;
  const narrowed = diff < 0;
  const head = grew ? `出てくる話題が ${diff} 増えた` : narrowed ? `出てくる話題が ${-diff} 減った` : `前回と同じ、約${kinds}`;
  const big = Math.max(kinds, previous.kinds, 1);
  const from = Math.sqrt(previous.kinds / big);
  const to = Math.sqrt(kinds / big);
  const date = shortDate(previous.at);
  const note =
    reached.length > 0
      ? `前回開いた「${topicLabel(reached[0])}」が、おすすめに出てくるようになりました`
      : added.length > 0
        ? `前回は出てこなかった ${added.length} の話題が、出てくるようになりました`
        : narrowed
          ? "いつもと違う話題の動画を1本見ると、おすすめは変わりはじめます"
          : "";
  const thumbs = (reached.length > 0 ? reached : added).slice(0, 3);
  return {
    id: "compare",
    bg: grew ? ["#03140d", "#15803d"] : narrowed ? ["#1a1206", "#a16207"] : ["#0b0d12", "#334155"],
    text: `前回（${date}）は、出てくる話題が約 ${previous.kinds}。${head}。${note}`,
    why: "この端末に残っている、同じ調べ方の前回の記録とくらべました。円の面積が、おすすめに出てくる話題の数を表しています。点線の円が前回です。",
    node: (
      <div className="my-auto text-center">
        <Rise className="text-sm font-bold text-white/70">前回（{date}）とくらべて</Rise>
        <div className="relative mx-auto mt-6 grid size-[min(64vw,260px)] place-items-center">
          <span
            aria-hidden
            className="absolute rounded-full border-2 border-dashed border-white/45"
            style={{ width: `${from * 100}%`, height: `${from * 100}%` }}
          />
          <span
            aria-hidden
            className="st-grow absolute rounded-full ring-2 ring-white/70"
            style={{
              width: `${to * 100}%`,
              height: `${to * 100}%`,
              background: "radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.38), rgb(255 255 255 / 0.08) 70%)",
              ["--from" as string]: String(from / to),
            }}
          />
          {grew && (
            <span aria-hidden className="st-ripple absolute rounded-full border-2 border-white/70" style={{ width: `${to * 100}%`, height: `${to * 100}%` }} />
          )}
          <p className="relative font-black leading-none">
            <span className="text-xl">約</span>
            <CountUp from={previous.kinds} to={kinds} delay={700} ms={1500} className="mx-1 text-[clamp(64px,20vw,100px)]" />
            <span className="text-xl">/ {TOPICS.length}</span>
          </p>
        </div>
        <h2 className="mt-6 text-[clamp(26px,7.5vw,38px)] font-black leading-[1.25]">
          <Rise d={2000}>{head}</Rise>
        </h2>
        {note && (
          <Rise d={2300} className="mt-3 text-[15px] leading-relaxed text-white/85">
            {note}
          </Rise>
        )}
        {thumbs.length > 0 && (
          <div className="mt-4 flex justify-center gap-2">
            {thumbs.map((t, i) => (
              <span key={t} className="st-pop w-24" style={{ animationDelay: `${2500 + i * 120}ms` }}>
                <Thumb topic={t} />
                <span className="mt-1 line-clamp-1 block text-[11px] text-white/75">{topicLabel(t)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    ),
  };
}
