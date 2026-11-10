import { GENRES, type GenreId, type Video } from "./genres";
import { TOPICS } from "./topics";

// どんな動画に寄っているか：MBTI の結果画面のように、組ごとにどちら寄りかを5段階で出す。
// 見方のタイプの4文字（bubble-type.ts）と同じ組に、作り手と言語の2つの組を足した。
// score は -1（b 側に振り切れ）〜 +1（a 側に振り切れ）。

export const LEVELS = ["とても", "やや", "どちらでもない", "やや", "とても"] as const;

export type AxisResult = {
  key: string;
  aLabel: string;
  bLabel: string;
  score: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = とても a、2 = どちらでもない、4 = とても b
  aPercent: number;
  evidence: string;
  meaning: string;
  // 反対側にあって、まだ出てこないジャンル
  blindSpots: string[];
  core: boolean;
};

const LEARN: GenreId[] = ["learning", "news", "tech", "money"];
const FUN: GenreId[] = ["game", "variety", "anime", "music", "movie", "vlog"];
const PEOPLE: GenreId[] = ["vlog", "variety", "music", "beauty"];
const THINGS: GenreId[] = ["game", "tech", "vehicle", "hobby", "food"];
const REAL: GenreId[] = ["sports", "travel", "food", "animal", "vlog"];
const VIRTUAL: GenreId[] = ["game", "anime", "movie", "music"];

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

function levelOf(score: number): AxisResult["level"] {
  if (score >= 0.6) return 0;
  if (score >= 0.2) return 1;
  if (score > -0.2) return 2;
  if (score > -0.6) return 3;
  return 4;
}

// 例：「とても「広く浅く」寄り」「やや「人」寄り」
export function levelText(r: AxisResult) {
  if (r.level === 2) return "どちらでもない";
  return `${LEVELS[r.level]}「${r.level < 2 ? r.aLabel : r.bLabel}」寄り`;
}

function label(ids: GenreId[]) {
  return ids.map((id) => GENRES.find((g) => g.id === id)!.label);
}

export function analyze(videos: Video[]): AxisResult[] {
  const total = videos.length || 1;
  const n = (ids: GenreId[]) => videos.filter((v) => ids.includes(v.genre)).length;
  const visited = new Set(videos.map((v) => v.genre));
  const unvisited = (ids: GenreId[]) => label(ids.filter((id) => !visited.has(id)));

  const byGenre = new Map<GenreId, number>();
  videos.forEach((v) => byGenre.set(v.genre, (byGenre.get(v.genre) ?? 0) + 1));
  const ranked = [...byGenre.entries()].sort((a, b) => b[1] - a[1]);
  const top3 = ranked.slice(0, 3).reduce((s, [, c]) => s + c, 0);
  const top3Share = top3 / total;

  const results: Omit<AxisResult, "level" | "aPercent">[] = [];

  results.push({
    key: "breadth",
    aLabel: "広く浅く",
    bLabel: "狭く深く",
    score: clamp((0.7 - top3Share) / 0.3),
    // ジャンルの数は「その他」を除いた 17 で数える（地図の説明とそろえる）
    evidence:
      `多い3つのジャンル（「${label(ranked.slice(0, 3).map(([g]) => g)).join("」「")}」）で、動画の ${Math.round(top3Share * 100)}% を占めます。` +
      `出てくるジャンルは ${GENRES.filter((g) => g.id !== "other").length} のうち ${[...visited].filter((id) => id !== "other").length}、` +
      `話題は ${TOPICS.length} のうち ${new Set(videos.map((v) => v.topic).filter(Boolean)).size} です。`,
    meaning: "いろいろなジャンルを少しずつ見るか、決まったジャンルを多く見るか。",
    blindSpots: label(GENRES.map((g) => g.id).filter((id) => id !== "other" && !visited.has(id))).slice(0, 4),
    core: true,
  });

  const learn = n(LEARN) / total;
  results.push({
    key: "purpose",
    aLabel: "学び",
    bLabel: "娯楽",
    score: clamp((learn - 0.25) / 0.25),
    evidence: `${label(LEARN).join("、")}の動画が ${Math.round(learn * 100)}% です（${videos.length} 本のうち ${n(LEARN)} 本）。`,
    meaning: "知りたくて見る動画が多いか、楽しみたくて見る動画が多いか。",
    blindSpots: learn >= 0.25 ? unvisited(FUN) : unvisited(LEARN),
    core: true,
  });

  const people = n(PEOPLE);
  const things = n(THINGS);
  results.push({
    key: "object",
    aLabel: "人",
    bLabel: "物事",
    score: people + things ? (people - things) / (people + things) : 0,
    evidence: `人が主役の動画が ${people} 本、物事が主役の動画が ${things} 本です。`,
    meaning: `人が主役のジャンル（${label(PEOPLE).join("、")}）と、物事が主役のジャンル（${label(THINGS).join("、")}）の、どちらの動画が多いか。`,
    blindSpots: people >= things ? unvisited(THINGS) : unvisited(PEOPLE),
    core: true,
  });

  const real = n(REAL);
  const virtual = n(VIRTUAL);
  results.push({
    key: "world",
    aLabel: "現実",
    bLabel: "画面の中",
    score: real + virtual ? (real - virtual) / (real + virtual) : 0,
    evidence: `現実の世界の動画が ${real} 本、画面の中の世界の動画が ${virtual} 本です。`,
    meaning: `現実の世界のジャンル（${label(REAL).join("、")}）と、画面の中の世界のジャンル（${label(VIRTUAL).join("、")}）の、どちらの動画が多いか。`,
    blindSpots: real >= virtual ? unvisited(VIRTUAL) : unvisited(REAL),
    core: true,
  });

  // 作り手：チャンネル名が分かる動画が5本以上あるときだけ
  const withChannel = videos.filter((v) => v.channel);
  if (withChannel.length >= 5) {
    const byChannel = new Map<string, number>();
    withChannel.forEach((v) => byChannel.set(v.channel!, (byChannel.get(v.channel!) ?? 0) + 1));
    const top = [...byChannel.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, c) => s + c, 0);
    const share = top / withChannel.length;
    results.push({
      key: "makers",
      aLabel: "多くの作り手",
      bLabel: "同じ作り手",
      score: clamp((0.6 - share) / 0.4),
      evidence: `チャンネル名が分かる動画のうち、多い3つのチャンネルの動画が ${Math.round(share * 100)}% を占めます（全部で ${byChannel.size} チャンネル）。`,
      meaning: "いろいろなチャンネルの動画を見るか、決まったチャンネルの動画を多く見るか。",
      blindSpots: [],
      core: false,
    });
  }

  // 言語：言語が分かる動画が5本以上あるときだけ
  const withLanguage = videos.filter((v) => v.language);
  if (withLanguage.length >= 5) {
    const foreign = withLanguage.filter((v) => v.language !== "ja").length / withLanguage.length;
    results.push({
      key: "language",
      aLabel: "日本語以外",
      bLabel: "日本語",
      score: clamp((foreign - 0.2) / 0.2),
      evidence: `言語が分かる動画のうち、日本語以外の動画は ${Math.round(foreign * 100)}% です。`,
      meaning: "日本語以外の動画も多いか、日本語の動画がほとんどか。",
      blindSpots: [],
      core: false,
    });
  }

  return results.map((r) => ({
    ...r,
    score: Math.round(r.score * 100) / 100,
    level: levelOf(r.score),
    aPercent: Math.round(50 + 50 * r.score),
  }));
}
