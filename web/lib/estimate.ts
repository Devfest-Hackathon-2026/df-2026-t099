import { exposureOf } from "./exposure";
import { GENRES, type GenreId, type Video } from "./genres";
import { TOPICS, genreOfTopic, topicsOf } from "./topics";

// スワイプの答えから、149 の話題全体を推定する（答えた話題だけで数えると、24 枚では最大 17.5% にしかならないため）。
//
// 考え方（層別の推定）：
// - カードはジャンルごとにまんべんなく引いている。ジャンルごとに「試した話題のうち、流れてくる話題の割合」を出す
// - その割合を、そのジャンルの試していない話題にも当てはめる
// - 全体の推定 = ジャンルごとの「流れてくる話題の推定数」の合計 ÷ 話題の数
// 確かさの幅は、ジャンルごとのばらつきを足し合わせた 95% のおよその幅（試した数が少ないほど広い）。
// 0 か 1 に張り付いて幅が 0 にならないよう、ばらつきは (流れてくる数 + 1) / (試した数 + 2) で見積もる。

export type GenreEstimate = { tested: number; shown: number; watched: number; total: number };

export type Estimate = {
  shown: number; // 流れてくる世界の推定（%）
  watched: number; // 見ている世界の推定（%）
  low: number; // 流れてくる世界の 95% のおよその幅
  high: number;
  tested: number; // 答えた話題の数
  byGenre: Record<GenreId, { shownTopics: number; watchedTopics: number }>; // 推定の話題数（地図に使う）
  margin: number; // 幅の半分（ポイント）
  // ジャンルごとの「推定のぶれ」への効き具合。大きいジャンルほど、次に聞くと幅が狭くなる（適応型の診断で使う）
  uncertainty: Record<GenreId, number>;
};

const ALL = TOPICS.length;

// corrections：本人がジャンルごとに直した「流れてくる割合」（0〜1）。直したジャンルは、その割合で数え、ぶれは 0 とする
// outside：結果を見たあとに、自分で見に行った話題（外へ出た話題）。出てくる話題・見ている話題として数え直す
export function estimateFromSwipes(videos: Video[], corrections?: Partial<Record<GenreId, number>>, outside: string[] = []): Estimate {
  // 同じ話題に複数の答えがあるときは、いちばん近いもの（見る＞見送る＞流れてこない）を使う
  const best = new Map<string, "watched" | "skipped" | "unseen">();
  const rank = { watched: 3, shown: 2, skipped: 2, unseen: 1 } as const;
  videos.forEach((v) => {
    if (!v.topic || v.topic.startsWith("other")) return;
    const e = exposureOf(v);
    const value = e === "shown" ? "skipped" : e;
    const prev = best.get(v.topic);
    if (!prev || rank[value] > rank[prev]) best.set(v.topic, value);
  });

  const per = new Map<GenreId, GenreEstimate>();
  GENRES.filter((g) => g.id !== "other").forEach((g) => {
    const topics = topicsOf(g.id);
    const answered = topics.filter((t) => best.has(t.id));
    per.set(g.id, {
      total: topics.length,
      tested: answered.length,
      shown: answered.filter((t) => best.get(t.id) !== "unseen").length,
      watched: answered.filter((t) => best.get(t.id) === "watched").length,
    });
  });

  // 一度も試していないジャンルには、全体の割合を当てはめる
  const sum = [...per.values()].reduce(
    (a, g) => ({ tested: a.tested + g.tested, shown: a.shown + g.shown, watched: a.watched + g.watched }),
    { tested: 0, shown: 0, watched: 0 },
  );
  const overallShown = sum.tested ? sum.shown / sum.tested : 0;
  const overallWatched = sum.tested ? sum.watched / sum.tested : 0;

  let shownTopics = 0;
  let watchedTopics = 0;
  let variance = 0;
  const byGenre = {} as Estimate["byGenre"];
  const uncertainty = {} as Estimate["uncertainty"];
  for (const [g, e] of per) {
    const fixed = corrections?.[g];
    if (fixed !== undefined) {
      const s = fixed * e.total;
      // 見ている割合は、答えの「見る ÷ 流れてくる」の比をそのまま使う（答えがなければ半分）
      const ratio = e.shown ? e.watched / e.shown : 0.5;
      shownTopics += s;
      watchedTopics += s * ratio;
      byGenre[g] = { shownTopics: s, watchedTopics: s * ratio };
      uncertainty[g] = 0;
      continue;
    }
    const pShown = e.tested ? e.shown / e.tested : overallShown;
    const pWatched = e.tested ? e.watched / e.tested : overallWatched;
    // 答えた話題は答えのまま、答えていない話題だけ推定する
    const rest = e.total - e.tested;
    const s = e.shown + pShown * rest;
    const w = e.watched + pWatched * rest;
    shownTopics += s;
    watchedTopics += w;
    byGenre[g] = { shownTopics: s, watchedTopics: w };

    const n = Math.max(e.tested, 1);
    const p = (e.shown + 1) / (e.tested + 2);
    const v = rest * rest * ((p * (1 - p)) / n);
    variance += v;
    uncertainty[g] = rest > 0 ? v : 0;
  }

  // 外へ出た話題：見に行った話題は、出てくる・見ている話題に数え直す。
  // 推定で「出てくる」と見込んでいた分（そのジャンルの割合）は、すでに数えてあるので、残りの分だけ足す
  let lift = 0;
  for (const t of new Set(outside)) {
    const g = genreOfTopic(t);
    const e = per.get(g);
    if (!e) continue;
    const b = best.get(t);
    const fixed = corrections?.[g];
    const pShown = b ? (b === "unseen" ? 0 : 1) : fixed ?? (e.tested ? e.shown / e.tested : overallShown);
    const pWatched = b ? (b === "watched" ? 1 : 0) : fixed !== undefined ? fixed * (e.shown ? e.watched / e.shown : 0.5) : e.tested ? e.watched / e.tested : overallWatched;
    lift += 1 - pShown;
    shownTopics += 1 - pShown;
    watchedTopics += 1 - pWatched;
    byGenre[g] = { shownTopics: byGenre[g].shownTopics + 1 - pShown, watchedTopics: byGenre[g].watchedTopics + 1 - pWatched };
  }

  const toPercent = (x: number) => Math.round((x / ALL) * 1000) / 10;
  const margin = 1.96 * Math.sqrt(variance);
  const corrected = Boolean(corrections && Object.keys(corrections).length);
  return {
    shown: toPercent(shownTopics),
    watched: toPercent(watchedTopics),
    // 本人が直したときは、答えより直しを優先するので、答えから決まる下限・上限は使わない
    low: corrected
      ? Math.max(0, toPercent(shownTopics - margin))
      : Math.max(toPercent(sum.shown + lift), toPercent(shownTopics - margin)),
    high: corrected
      ? Math.min(toPercent(ALL - 1), toPercent(shownTopics + margin))
      : Math.min(toPercent(ALL - 1 - (sum.tested - sum.shown) + lift), toPercent(shownTopics + margin)),
    tested: sum.tested,
    byGenre,
    margin: Math.round((margin / ALL) * 1000) / 10,
    uncertainty,
  };
}

// 推定を使うか（「流れてこない」まで答えるスワイプのときだけ。スクショや履歴は実際に流れてきたものなので推定しない）
export function usesEstimate(source: string) {
  return source === "swipe" || source === "sample";
}
