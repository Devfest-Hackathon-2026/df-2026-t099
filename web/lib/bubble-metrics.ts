import type { Video } from "./genres";
import { TOPICS } from "./topics";

// バブルの大きさを、ジャンルだけでなくいくつかの面から測る。

export type TopicCounts = Record<string, number>;

export function countTopics(videos: Video[]): TopicCounts {
  const counts: TopicCounts = {};
  videos.forEach((v) => v.topic && (counts[v.topic] = (counts[v.topic] ?? 0) + 1));
  return counts;
}

// 見えている世界の割合。
// すべての話題を同じ広さの海とみなし、自分の見ている動画の散らばり方がその海とどれだけ重なるかを出す
// （ヒストグラムの重なり：Σ min(自分の割合, 1/話題の数)）。
// 1つの話題だけを見ていれば 1/話題の数、すべての話題を同じだけ見ていれば 100%。
export function worldCoverage(topics: TopicCounts) {
  const total = Object.values(topics).reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  const even = 1 / TOPICS.length;
  const overlap = Object.values(topics).reduce((s, n) => s + Math.min(n / total, even), 0);
  return Math.round(overlap * 1000) / 10;
}

export function formatPercent(p: number) {
  return p < 10 ? p.toFixed(1) : String(Math.round(p));
}

// 作り手の偏り：上位3チャンネルが見ている動画のどれだけを占めるか
export function channelConcentration(videos: Video[]) {
  const withChannel = videos.filter((v) => v.channel);
  if (withChannel.length < 5) return null;
  const byChannel = new Map<string, number>();
  withChannel.forEach((v) => byChannel.set(v.channel!, (byChannel.get(v.channel!) ?? 0) + 1));
  const top3 = [...byChannel.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0);
  return { top3Share: Math.round((top3 / withChannel.length) * 100), channels: byChannel.size, videos: withChannel.length };
}

// 言語の偏り：日本語以外の動画の割合
export function languageMix(videos: Video[]) {
  const known = videos.filter((v) => v.language);
  if (known.length < 5) return null;
  const foreign = known.filter((v) => v.language !== "ja").length;
  return { foreignShare: Math.round((foreign / known.length) * 100), videos: known.length };
}
