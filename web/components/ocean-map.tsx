"use client";

import { useId, useState } from "react";
import { GENRES, type GenreId } from "@/lib/genres";
import { formatPercent, type TopicCounts } from "@/lib/bubble-metrics";
import type { GenreCounts } from "@/lib/compare";
import { TOPICS, topicsOf } from "@/lib/topics";
import { IslandPanel } from "./island-panel";

// 話題の地図。137 の話題を点で描き、ジャンルごとにまとめて並べる。
// おすすめに出てくる話題のまわりを明るくする。明るい所の面積の合計が、地図全体のちょうど「かたよりの少なさ」になるように描く。
const W = 400;
const H = 280;

// 島の中心。似たジャンルを近くに置いた
export const CENTERS: Record<GenreId, [number, number]> = {
  game: [62, 58],
  anime: [128, 40],
  movie: [182, 76],
  music: [240, 42],
  variety: [292, 82],
  vlog: [348, 48],
  beauty: [356, 128],
  learning: [48, 138],
  tech: [110, 118],
  news: [166, 150],
  money: [94, 196],
  food: [234, 134],
  travel: [292, 168],
  animal: [348, 206],
  sports: [212, 214],
  vehicle: [44, 240],
  hobby: [148, 240],
  other: [282, 244],
};

const RING = 13;

// 話題の小島の位置：島の中心のまわりに円く並べる
function islet(genre: GenreId, index: number, count: number): [number, number] {
  const [cx, cy] = CENTERS[genre];
  if (count === 1) return [cx, cy];
  const a = (index / count) * Math.PI * 2 - Math.PI / 2;
  return [cx + Math.cos(a) * RING, cy + Math.sin(a) * RING];
}

type Light = { x: number; y: number; r: number; topic?: string };

// 灯りの円。1つの話題が照らせる面積は「全体 ÷ 話題の数」まで（見えている割合の計算と同じ上限）
function lightsFromTopics(topics: TopicCounts): Light[] {
  const total = Object.values(topics).reduce((s, n) => s + n, 0) || 1;
  const cap = 1 / TOPICS.length;
  return GENRES.flatMap((g) =>
    topicsOf(g.id).flatMap((t, i, all) => {
      const n = topics[t.id] ?? 0;
      if (!n) return [];
      const area = Math.min(n / total, cap) * W * H;
      const [x, y] = islet(g.id, i, all.length);
      return [{ x, y, r: Math.sqrt(area / Math.PI), topic: t.id }];
    }),
  );
}

// 話題が分からない古い結果は、ジャンル単位で同じ考え方で照らす
function lightsFromGenres(counts: GenreCounts): Light[] {
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0) || 1;
  const cap = 1 / TOPICS.length;
  return GENRES.filter((g) => counts[g.id]).map((g) => {
    const [x, y] = CENTERS[g.id];
    const area = Math.min((counts[g.id] ?? 0) / total, cap) * W * H;
    return { x, y, r: Math.sqrt(area / Math.PI) };
  });
}

export function OceanMap({
  counts,
  topics,
  coverage,
  watched,
  estimate,
  outside,
  who = "あなた",
  bare = false,
}: {
  counts: GenreCounts;
  topics?: TopicCounts;
  coverage?: number;
  // 見ている話題。渡すと、見ている話題はオレンジ色、おすすめに出てくるが見ない話題は青白い色で明るくする
  watched?: TopicCounts;
  // カードの答えからの推定（ジャンルごとの、出てくる・見ている話題の推定数）。渡すと、明るい所を推定の面積にする
  estimate?: Partial<Record<GenreId, { shownTopics: number; watchedTopics: number }>>;
  // 外へ出た話題（結果を見たあとに、自分で見に行った話題）。点のまわりに輪をつける
  outside?: string[];
  who?: string;
  // トップの「製品の画面」のように、地図だけを見せる（説明・凡例・島を押す操作を出さない）
  bare?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<GenreId | null>(null);
  const hasTopics = Boolean(topics && Object.keys(topics).length > 0);
  const isWatched = (topic?: string) => !watched || (topic !== undefined && (watched[topic] ?? 0) > 0);
  const showLegend = Boolean(watched && Object.keys(topics ?? {}).some((t) => !(watched[t] ?? 0)));
  // 色の見方は、色が2つに分かれるときだけ出す
  const showColors = showLegend || Boolean(estimate);
  const genreCount = GENRES.filter((g) => g.id !== "other").length;
  // 推定があるときは、ジャンルの島ごとに「推定の話題数 ÷ 137」の面積で照らす（灯りの合計 = 推定の割合）
  const radius = (topicCount: number) => Math.sqrt(((topicCount / TOPICS.length) * W * H) / Math.PI);
  const estimated = estimate
    ? GENRES.flatMap((g) => {
        const e = estimate[g.id];
        if (!e || e.shownTopics <= 0) return [];
        const [x, y] = CENTERS[g.id];
        return [{ x, y, r: radius(e.shownTopics), warm: radius(e.watchedTopics) }];
      })
    : null;
  const lights: Light[] = estimated ?? (hasTopics ? lightsFromTopics(topics!) : lightsFromGenres(counts));
  const seen =
    coverage ?? Math.round((lights.reduce((s, l) => s + Math.PI * l.r * l.r, 0) / (W * H)) * 1000) / 10;

  return (
    <figure>
      <div className="relative overflow-hidden rounded-(--r-tile) shadow-[0_24px_48px_-24px_rgba(0,0,0,0.45)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`話題の地図。${who}のおすすめに出てくる話題が、明るく表示されています。明るい所は地図全体の ${formatPercent(seen)}% です。`}>
          <defs>
            <radialGradient id={`${id}-sea`} cx="50%" cy="40%" r="75%">
              <stop offset="0" stopColor="#0f3a6b" />
              <stop offset="1" stopColor="#061529" />
            </radialGradient>
            <radialGradient id={`${id}-hole`}>
              <stop offset="0.6" stopColor="black" />
              <stop offset="1" stopColor="white" />
            </radialGradient>
            <radialGradient id={`${id}-beam`}>
              <stop offset="0" stopColor="#ff9f0a" stopOpacity="0.28" />
              <stop offset="1" stopColor="#ff9f0a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-beam-cool`}>
              <stop offset="0" stopColor="#64d2ff" stopOpacity="0.2" />
              <stop offset="1" stopColor="#64d2ff" stopOpacity="0" />
            </radialGradient>
            <mask id={`${id}-fog`}>
              <rect width={W} height={H} fill="white" />
              {lights.map((l, i) => (
                <circle key={i} cx={l.x} cy={l.y} r={l.r * 1.12} fill={`url(#${id}-hole)`} />
              ))}
            </mask>
          </defs>

          <rect width={W} height={H} fill={`url(#${id}-sea)`} />

          {/* 話題の点 */}
          {GENRES.map((g) =>
            topicsOf(g.id).map((t, i, all) => {
              const [x, y] = islet(g.id, i, all.length);
              const lit = hasTopics ? (topics![t.id] ?? 0) > 0 : (counts[g.id] ?? 0) > 0;
              const fill = !lit ? "#7f93b0" : isWatched(t.id) ? g.color : "#cfe0f5";
              return <circle key={t.id} cx={x} cy={y} r={lit ? 3.4 : 2.4} fill={fill} />;
            }),
          )}
          {/* 外へ出た話題の輪。加わったときは、輪が広がって消える */}
          {GENRES.map((g) =>
            topicsOf(g.id).map((t, i, all) => {
              if (!outside?.includes(t.id)) return null;
              const [x, y] = islet(g.id, i, all.length);
              return (
                <g key={`out-${t.id}`}>
                  <circle cx={x} cy={y} r={3.4} className="ob-ripple" strokeWidth={0.8} />
                  <circle cx={x} cy={y} r={6} fill="none" stroke="#7ff0dd" strokeWidth={1.4} />
                </g>
              );
            }),
          )}

          {/* 明るい所のにじみ。見ている話題はオレンジ色、おすすめに出てくるが見ない話題は青白く */}
          {estimated
            ? estimated.map((l, i) => (
                <g key={i}>
                  <circle cx={l.x} cy={l.y} r={l.r * 1.3} fill={`url(#${id}-beam-cool)`} />
                  {l.warm > 0 && <circle cx={l.x} cy={l.y} r={l.warm * 1.3} fill={`url(#${id}-beam)`} />}
                </g>
              ))
            : lights.map((l, i) => (
                <circle
                  key={i}
                  cx={l.x}
                  cy={l.y}
                  r={l.r * 1.4}
                  fill={`url(#${id}-${isWatched(l.topic) ? "beam" : "beam-cool"})`}
                />
              ))}

          {/* 出てこない話題を暗くする */}
          <rect width={W} height={H} fill="#040a14" opacity="0.9" mask={`url(#${id}-fog)`} pointerEvents="none" />

          {/* ジャンルの名前。出てこないジャンルはうっすら */}
          {GENRES.map((g) => {
            const [x, y] = CENTERS[g.id];
            const lit = (counts[g.id] ?? 0) > 0;
            return (
              <text key={g.id} x={x} y={y + RING + 13} textAnchor="middle" fontSize="11" fontWeight={lit ? 700 : 400} fill="#eaf0f8" opacity={lit ? 0.95 : 0.22}>
                {g.label}
              </text>
            );
          })}

          {/* 押せる範囲 */}
          {!bare && GENRES.map((g) => {
            const [x, y] = CENTERS[g.id];
            return (
              <circle
                key={g.id}
                cx={x}
                cy={y}
                r={RING + 6}
                fill="transparent"
                stroke={selected === g.id ? "#ff9f0a" : "none"}
                strokeWidth={1.5}
                className="cursor-pointer"
                role="button"
                aria-label={`「${g.label}」をくわしく見る`}
                onClick={() => setSelected(g.id)}
              />
            );
          })}
        </svg>

      </div>
      {!bare && (
        <>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <p className="rounded-full bg-surface px-3 py-1.5">
          明るい所の広さ：地図全体の <span className="num font-bold text-light-ink">{formatPercent(seen)}%</span>（上の「かたよりの少なさ」と同じ数字）
        </p>
        {showColors && (
          <>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
              <span className="size-2 rounded-full bg-light" aria-hidden />
              オレンジ色：見る話題
            </p>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
              <span className="size-2 rounded-full bg-[#cfe0f5]" aria-hidden />
              青白い色：おすすめに出てくるが、見ない話題
            </p>
          </>
        )}
        {outside && outside.length > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
            <span className="size-2.5 rounded-full border-[1.5px] border-[#2bb3a0] dark:border-[#7ff0dd]" aria-hidden />
            緑の輪：外へ出た話題
          </p>
        )}
      </div>
      <figcaption className="mt-3 text-sm leading-[1.8] text-muted">
        {genreCount} のジャンルに分けて、{TOPICS.length} の話題を点で並べた地図です。{who}のおすすめに出てくる話題のまわりが明るくなり、出てこない話題は暗いままです。明るい所が広いほど、多くの話題がかたよりなく出てきています。
        {estimate && "カードで答えていない話題は、答えからジャンルごとに推定して明るくしています。"}
        ジャンルを押すと、そのジャンルをよく見る人と、動画の例が出ます。
      </figcaption>
      {selected && (
        <IslandPanel key={selected} genre={selected} mine={counts[selected] ?? 0} onClose={() => setSelected(null)} />
      )}
        </>
      )}
    </figure>
  );
}
