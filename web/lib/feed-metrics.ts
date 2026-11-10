import { estimateFromSwipes, usesEstimate } from "./estimate";
import { exposureOf, shownVideos } from "./exposure";
import { GENRES, type Diagnosis, type GenreId, type Video } from "./genres";
import { TOPICS, topicsOf } from "./topics";

// 自分を正確に知るための4つの数字。どれも「おすすめに流れてくる動画」を、149 の話題に分けて数える。
// A. 広さ：一度でも流れてくることがある話題の割合（どこまで届いているか）
// B. 注意の広さ：よく流れてくる話題ほど重く数えた割合。全部の話題に同じだけ注意が向いていれば 100%
//    （Σ min(その話題の割合, 1/話題の数)。人が見られる本数には限りがあるので、ふつうは小さい）
// C. 実質の話題の数：おすすめが、実質いくつの話題でできているか（割合のばらつきから出す実効数 = exp(エントロピー)）
// D. 上位3つの割合：おすすめのうち、いちばんよく流れてくる3つの話題が占める割合
//
// 重みは、スワイプの目安を「1週間に流れてくる本数」に直したもの。
// 「よく」＝ほぼ毎日（週7本くらい）、「たまに」＝週に1〜2本（週1.5本）。比はおよそ 4.7 倍。
// あいまいなことばは人によって思い浮かべる回数がばらつくので、具体的な目安を画面に出してそろえる。
// 本当の比は、2人の Takeout の履歴で確かめる。

export const FREQUENCY_WEIGHT = { often: 7, sometimes: 1.5 } as const;
// 「気分しだいで見る」は、流れてきた分の半分くらいを見るとみなす
const MOOD_SHARE = 0.5;

export const FREQUENCY_GUIDE = { often: "ほぼ毎日", sometimes: "週に1〜2本", unseen: "ほとんど見かけない" } as const;

export type FeedMetrics = {
  breadth: number; // A（%）
  breadthLow?: number; // A の確かさの幅（スワイプのときだけ）
  breadthHigh?: number;
  attention: number; // B（%）
  effective: number; // C（話題の数）
  top3: number; // D（%）
  top3Topics: string[]; // D の3つ
  estimated: boolean; // スワイプの答えから、答えていない話題も推定したか
  // 地図用：ジャンルごとの「注意の広さ」を話題の数に直したもの（灯りの面積の合計 = B）
  byGenre: Partial<Record<GenreId, { shownTopics: number; watchedTopics: number }>>;
};

const ALL = TOPICS.length;

// 話題ごとの重み（流れてくる量）と、そのうち見ている分から4つの数字を出す。
// n は「同じ重みの話題がいくつあるか」。スワイプで答えていない話題は「出てくると見込まれる数」（小数もある）を n に入れる
type Item = { topic: string; w: number; watched: number; n?: number };

function fromItems(items: Item[]) {
  const live = items.filter((x) => x.w > 0 && (x.n ?? 1) > 0);
  const total = live.reduce((s, x) => s + x.w * (x.n ?? 1), 0);
  if (total <= 0) return { attention: 0, effective: 0, top3: 0, top3Topics: [], byGenre: {} };
  const cap = 1 / ALL;
  let attention = 0;
  let entropy = 0;
  const byGenre: FeedMetrics["byGenre"] = {};
  for (const { topic, w, watched, n = 1 } of live) {
    const p = w / total;
    const part = Math.min(p, cap) * n;
    attention += part;
    entropy -= n * p * Math.log(p);
    const g = topic.split(".")[0] as GenreId;
    const cur = byGenre[g] ?? { shownTopics: 0, watchedTopics: 0 };
    cur.shownTopics += part * ALL;
    cur.watchedTopics += part * ALL * (watched / w);
    byGenre[g] = cur;
  }
  // 多い3つ：n を持つものは、その数だけ同じ重みの話題があるとみなす
  const sorted = [...live].sort((a, b) => b.w - a.w);
  let left = 3;
  let top = 0;
  for (const x of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, x.n ?? 1);
    top += x.w * take;
    left -= take;
  }
  return {
    attention: Math.round(attention * 1000) / 10,
    effective: Math.round(Math.exp(entropy) * 10) / 10,
    top3: Math.round((top / total) * 100),
    top3Topics: sorted.filter((x) => (x.n ?? 1) === 1).slice(0, 3).map((x) => x.topic),
    byGenre,
  };
}

function fromWeights(weights: Map<string, { w: number; watched: number }>) {
  return fromItems([...weights.entries()].map(([topic, x]) => ({ topic, ...x })));
}

function answerWeight(v: Video) {
  const e = exposureOf(v);
  if (e === "unseen") return 0;
  return v.frequency ? FREQUENCY_WEIGHT[v.frequency] : FREQUENCY_WEIGHT.sometimes;
}

// 外へ出た話題（結果を見たあとに自分で見に行った話題）の重み。1本見ただけなので「たまに出る」と同じにする
const OUTSIDE_WEIGHT = FREQUENCY_WEIGHT.sometimes;

// スワイプ：答えた話題はその重み、答えていない話題はジャンルの平均の重みで推定する
// outside：外へ出た話題。答えで出てこなかった話題、答えていない話題を、見ている話題として足す
export function metricsFromSwipes(videos: Video[], corrections?: Partial<Record<GenreId, number>>, outside: string[] = []): FeedMetrics {
  const answered = new Map<string, { w: number; watched: number }>();
  videos.forEach((v) => {
    if (!v.topic || v.topic.startsWith("other")) return;
    const w = answerWeight(v);
    const prev = answered.get(v.topic);
    if (!prev || w > prev.w) answered.set(v.topic, { w, watched: exposureOf(v) === "watched" ? w * (v.mood ? MOOD_SHARE : 1) : 0 });
  });

  const all = [...answered.values()];
  const shownAll = all.filter((x) => x.w > 0);
  const meanShownWeight = shownAll.length ? shownAll.reduce((s, x) => s + x.w, 0) / shownAll.length : FREQUENCY_WEIGHT.sometimes;
  const overallWatchedFrac = shownAll.length ? shownAll.reduce((s, x) => s + x.watched, 0) / shownAll.reduce((s, x) => s + x.w, 0) : 0.5;

  // 答えていない話題に「ジャンルの平均の重み」を薄く配ると、出てこない話題まで少しずつ出てくることになり、
  // 話題の種類が「一度でも出てくる話題の数」より多くなってしまう。
  // そこで、答えていない話題は「出てくると見込まれる数（ジャンルで出てきた割合 × 答えていない数）」だけ、
  // 出てくる話題のふつうの重みで出てくるとみなす
  const shownMean = (xs: { w: number }[]) => xs.reduce((s, x) => s + x.w, 0) / xs.length;
  const overallShownRate = all.length ? shownAll.length / all.length : 0;
  const items: Item[] = [];
  for (const g of GENRES.filter((x) => x.id !== "other")) {
    const topics = topicsOf(g.id);
    const tested = topics.map((t) => answered.get(t.id)).filter((x) => x !== undefined);
    const shownTested = tested.filter((x) => x.w > 0);
    const watchedFrac = shownTested.length
      ? shownTested.reduce((s, x) => s + x.watched, 0) / shownTested.reduce((s, x) => s + x.w, 0)
      : overallWatchedFrac;
    const w = shownTested.length ? shownMean(shownTested) : meanShownWeight;
    // このジャンルの外へ出た話題のうち、答えでは出てこなかった・答えていない話題（見ている話題として、別に足す）
    const out = topics.filter((t) => outside.includes(t.id) && !((answered.get(t.id)?.w ?? 0) > 0)).map((t) => t.id);
    const outItems = out.map((topic) => ({ topic, w: OUTSIDE_WEIGHT, watched: OUTSIDE_WEIGHT }));
    const fixed = corrections?.[g.id];
    if (fixed !== undefined) {
      // 直したジャンルは、答えより直しを優先する：ジャンルの話題のうち「直した割合」が、ふつうの重みで出てくる
      items.push({ topic: `${g.id}.*`, w: meanShownWeight, watched: meanShownWeight * watchedFrac, n: fixed * (topics.length - out.length) }, ...outItems);
      continue;
    }
    for (const t of topics) {
      const a = answered.get(t.id);
      // 出てくるが見ないと答えた話題でも、外へ出て見たなら、見ている話題にする
      if (a) items.push({ topic: t.id, ...a, watched: outside.includes(t.id) ? a.w : a.watched });
    }
    const rest = topics.length - tested.length - out.filter((t) => !answered.has(t)).length;
    const rate = tested.length ? shownTested.length / tested.length : overallShownRate;
    if (rest > 0 && rate > 0) items.push({ topic: `${g.id}.*`, w, watched: w * watchedFrac, n: rate * rest });
    items.push(...outItems);
  }

  const breadth = estimateFromSwipes(videos, corrections, outside);
  const base = fromItems(items);
  // 名前を挙げる上位3つは、本人が答えた話題から選ぶ（推定しただけの話題を「よく流れてくる」と言わない）
  const named = [...answered.entries()]
    .filter(([, x]) => x.w > 0)
    .sort((a, b) => b[1].w - a[1].w)
    .slice(0, 3)
    .map(([t]) => t);
  return {
    breadth: breadth.shown,
    breadthLow: breadth.low,
    breadthHigh: breadth.high,
    estimated: true,
    ...base,
    top3Topics: named,
  };
}

// スクショ・URL・Takeout：写っていた（見ていた）動画の本数をそのまま重みにする。推定はしない
// outside：外へ出た話題。まだない話題は1本ぶん、見ている話題として足す
export function metricsFromVideos(videos: Video[], outside: string[] = []): FeedMetrics {
  const weights = new Map<string, { w: number; watched: number }>();
  videos.forEach((v) => {
    if (!v.topic || exposureOf(v) === "unseen") return;
    const cur = weights.get(v.topic) ?? { w: 0, watched: 0 };
    cur.w += 1;
    if (exposureOf(v) === "watched") cur.watched += 1;
    weights.set(v.topic, cur);
  });
  for (const t of new Set(outside)) {
    const cur = weights.get(t);
    weights.set(t, cur ? { w: cur.w, watched: cur.w } : { w: 1, watched: 1 });
  }
  return {
    breadth: Math.round((weights.size / ALL) * 1000) / 10,
    estimated: false,
    ...fromWeights(weights),
  };
}

// 外へ出た話題（同じ話題は1つ）
export function outsideTopics(d: Diagnosis) {
  return [...new Set((d.outside ?? []).map((s) => s.topic))];
}

// 結果の画面と同じ数え方で、診断の4つの数字を出す。outside を渡すと、外へ出た話題も足す
export function diagnosisMetrics(d: Diagnosis, outside: string[] = []) {
  return usesEstimate(d.source) ? metricsFromSwipes(d.videos, d.corrections, outside) : metricsFromVideos(shownVideos(d.videos), outside);
}

// 外へ出る前と後の「約○種類」「一度も出てこない話題 約○」（スライドと同じく「その他」を除く話題で数える）
export function bubbleCounts(before: FeedMetrics, after: FeedMetrics) {
  const list = TOPICS.filter((t) => t.genre !== "other").length;
  const fog = list - Math.round((list * before.breadth) / 100);
  // 外へ出たぶん増えた「出てくる話題」の数だけ減らす（丸めで ±1 ずれないよう、差を話題の数に直してから引く）
  const gained = Math.round(((after.breadth - before.breadth) * ALL) / 100);
  return {
    kinds: Math.max(1, Math.round(before.effective)),
    kindsAfter: Math.max(1, Math.round(after.effective)),
    fog,
    fogAfter: Math.max(0, fog - gained),
  };
}

// 149 の話題のうち、おすすめに一度でも出てくる話題（約）と、一度も出てこない話題（約）。
// 画面の主役の数。足すと 149 になるようにそろえる（「その他」は出てくる側に数える）
export function topicSplit(fm: Pick<FeedMetrics, "breadth">) {
  const counted = TOPICS.filter((t) => t.genre !== "other").length;
  const fog = counted - Math.round((counted * fm.breadth) / 100);
  return { shown: TOPICS.length - fog, fog, total: TOPICS.length };
}
