import type { AxisResult } from "./bubble-analysis";
import { TOPICS } from "./topics";
import { topicSplit } from "./feed-metrics";

// くわしい分析の「まとめ」の文。前は Gemini に書いてもらっていたが、
// 計算した数字を言い直しているだけなので、プログラムで作る（待ち時間なし・毎回同じ・Gemini の回数を減らす）。
// 言葉は 15_画面の言葉の決まり.md のとおり
export type Reading = { summary: string; strength: string; blindSpot: string; nextStep: string };

export function buildReading({
  axes,
  topTopics,
  prediction,
  metrics,
}: {
  axes: AxisResult[];
  topTopics: string[];
  prediction?: number;
  metrics: { effective: number; top3: number; breadth?: number };
}): Reading {
  const kinds = Math.max(1, Math.round(metrics.effective));
  // 予想と比べるのは、予想と同じ「一度も出てこない話題の数（149 のうち）」
  const split = metrics.breadth !== undefined ? topicSplit({ breadth: metrics.breadth }) : null;
  const shown = split?.shown ?? null;

  const breadth =
    kinds <= 10
      ? "少しの話題にかたよっています。"
      : kinds <= 30
        ? "いくつかの話題が中心で、ほかの話題も少し出てきます。"
        : "多くの話題が、わりと広く出てきています。";
  let guess = "";
  if (prediction !== undefined) {
    const fog = split?.fog ?? null;
    const diff = fog === null ? 0 : fog - prediction;
    guess =
      fog === null
        ? ""
        : Math.abs(diff) < 2
          ? `一度も出てこない話題の数は、予想した約${prediction}とほぼ同じでした。`
          : diff > 0
            ? `一度も出てこない話題は、予想した約${prediction}より多くありました。`
            : `一度も出てこない話題は、予想した約${prediction}より少なめでした。`;
  }
  const summary = `${TOPICS.length} の話題のうち、あなたのおすすめに出てくる話題は約${shown ?? kinds}。よく出てくる話題ほど重く数えると約${kinds}で、${breadth}${guess}`;

  const top = topTopics.slice(0, 3);
  const strength = top.length
    ? `よく出てくるのは「${top.join("」「")}」です。多い3つの話題で、おすすめの ${metrics.top3}% を占めます。`
    : "よく出てくる話題を数えられるだけの動画がありませんでした。";

  // いちばん強く片寄っている組（5段階の端）から、反対側のジャンルを挙げる
  const leaning = axes
    .filter((a) => a.level !== 2 && a.blindSpots.length > 0)
    .sort((a, b) => Math.abs(b.level - 2) - Math.abs(a.level - 2))[0];
  const blindSpot = leaning
    ? `「${leaning.level < 2 ? leaning.bLabel : leaning.aLabel}」の動画が、ほとんど出てきません。たとえば「${leaning.blindSpots
        .slice(0, 3)
        .join("」「")}」のジャンルです。`
    : "どの組でも、大きなかたよりはありませんでした。";
  const nextStep = leaning
    ? `「${leaning.blindSpots[0]}」の動画を1本見てみてください。1本見るだけでも、おすすめは少しずつ変わります。`
    : "まだ見たことのない話題の動画を、1本見てみてください。1本見るだけでも、おすすめは少しずつ変わります。";

  return { summary, strength, blindSpot, nextStep };
}
