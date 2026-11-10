import { GENRES, type GenreId, type Video } from "./genres";

export const AGE_BANDS = ["10代", "20代", "30代", "40代", "50代以上"] as const;
export const REGIONS = ["北海道・東北", "関東", "中部", "近畿", "中国・四国", "九州・沖縄", "海外"] as const;

export type GenreCounts = Partial<Record<GenreId, number>>;

// 保存するのはジャンルの本数と型、本人が選んだ年代・地域だけ。動画の題名は保存しない
export type SavedDiagnosis = {
  id: string;
  counts: GenreCounts;
  // 細かい話題ごとの本数（topics.ts の id）。サンプルと古い保存にはない
  topicCounts?: Record<string, number>;
  total: number;
  type: string;
  ageBand?: (typeof AGE_BANDS)[number];
  region?: (typeof REGIONS)[number];
  channels?: string[];
  groupId?: string;
  // 友だちに渡す招待リンク用の鍵。本人用の id とは別にして、招待リンクから本人の結果を読めないようにする
  inviteId?: string;
  sample?: boolean;
};

export function countGenres(videos: Video[]): GenreCounts {
  const counts: GenreCounts = {};
  videos.forEach((v) => (counts[v.genre] = (counts[v.genre] ?? 0) + 1));
  return counts;
}

export function topChannels(videos: Video[], n: number) {
  const byChannel = new Map<string, number>();
  videos.forEach((v) => v.channel && byChannel.set(v.channel, (byChannel.get(v.channel) ?? 0) + 1));
  return [...byChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
}

function shares(counts: GenreCounts) {
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0) || 1;
  return GENRES.map((g) => (counts[g.id] ?? 0) / total);
}

// ジャンルの割合がどれだけ似ているか（コサイン類似度を 0〜100 にしたもの）
export function matchPercent(a: GenreCounts, b: GenreCounts) {
  const x = shares(a);
  const y = shares(b);
  const dot = x.reduce((s, v, i) => s + v * y[i], 0);
  const norm = Math.hypot(...x) * Math.hypot(...y);
  return norm === 0 ? 0 : Math.round((dot / norm) * 100);
}

// 何人かの結果を足して、1人分の平均の形にする
export function averageCounts(list: { counts: GenreCounts }[]): GenreCounts {
  const sum: GenreCounts = {};
  list.forEach(({ counts }) => {
    const s = shares(counts);
    GENRES.forEach((g, i) => (sum[g.id] = (sum[g.id] ?? 0) + s[i]));
  });
  return sum;
}

export function topGenres(counts: GenreCounts, n: number) {
  return GENRES.filter((g) => (counts[g.id] ?? 0) > 0)
    .sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0))
    .slice(0, n);
}

// 2人の比較：両方が見ているジャンル、片方だけが見ているジャンル
export function genreOverlap(a: GenreCounts, b: GenreCounts) {
  const has = (c: GenreCounts, id: GenreId) => (c[id] ?? 0) > 0;
  return {
    both: GENRES.filter((g) => has(a, g.id) && has(b, g.id)),
    onlyA: GENRES.filter((g) => has(a, g.id) && !has(b, g.id)),
    onlyB: GENRES.filter((g) => !has(a, g.id) && has(b, g.id)),
  };
}
