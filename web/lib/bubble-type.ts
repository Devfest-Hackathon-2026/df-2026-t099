import type { GenreId, Video } from "./genres";

// 見方のタイプ。MBTI のように4つの組の頭文字を並べる。組と名前は試作用の仮。
// 画面では、名前を先に出し、4文字の記号はそのあとに添える
export const AXES = [
  { a: "W", b: "F", aLabel: "広く浅く", bLabel: "狭く深く", question: "いろいろなジャンルを少しずつ見るか、決まったジャンルを多く見るか" },
  { a: "L", b: "E", aLabel: "学び", bLabel: "娯楽", question: "知りたくて見る動画が多いか、楽しみたくて見る動画が多いか" },
  { a: "P", b: "T", aLabel: "人", bLabel: "物事", question: "人が主役の動画が多いか、物事が主役の動画が多いか" },
  { a: "R", b: "V", aLabel: "現実", bLabel: "画面の中", question: "現実の世界の動画が多いか、画面の中の世界の動画が多いか" },
] as const;

const LEARN: GenreId[] = ["learning", "news", "tech", "money"];
const PEOPLE: GenreId[] = ["vlog", "variety", "music", "beauty"];
const THINGS: GenreId[] = ["game", "tech", "vehicle", "hobby", "food"];
const REAL: GenreId[] = ["sports", "travel", "food", "animal", "vlog"];
const VIRTUAL: GenreId[] = ["game", "anime", "movie", "music"];

// 名前は「人・物事 × 現実・画面の中」の好み ＋「広さ × 学び・娯楽」の呼び名（例：スター好きの物知り）
const ROLE: Record<string, string> = { WL: "物知り", WE: "遊び上手", FL: "探究者", FE: "一筋派" };
const STYLE: Record<string, string> = { PR: "日常好きの", PV: "スター好きの", TR: "アウトドア好きの", TV: "インドア好きの" };

export const ALL_TYPE_CODES = ["W", "F"].flatMap((x) =>
  ["L", "E"].flatMap((y) => ["P", "T"].flatMap((z) => ["R", "V"].map((w) => x + y + z + w))),
);

export function isTypeCode(code: string) {
  return ALL_TYPE_CODES.includes(code);
}

export function typeName(code: string) {
  return `${STYLE[code[2] + code[3]]}${ROLE[code[0] + code[1]]}`;
}

export function oppositeType(code: string) {
  return AXES.map((axis, i) => (code[i] === axis.a ? axis.b : axis.a)).join("");
}

export function typeOf(videos: Video[]) {
  const count = (ids: GenreId[]) => videos.filter((v) => ids.includes(v.genre)).length;
  const total = videos.length || 1;

  const byGenre = new Map<GenreId, number>();
  videos.forEach((v) => byGenre.set(v.genre, (byGenre.get(v.genre) ?? 0) + 1));
  const top3 = [...byGenre.values()].sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0);

  const wide = top3 / total < 0.7;
  const learn = count(LEARN) / total >= 0.25;
  const people = count(PEOPLE) >= count(THINGS);
  const real = count(REAL) >= count(VIRTUAL);

  return [wide ? "W" : "F", learn ? "L" : "E", people ? "P" : "T", real ? "R" : "V"].join("");
}

export function describeType(code: string) {
  return AXES.map((axis, i) => (code[i] === axis.a ? axis.aLabel : axis.bLabel));
}
