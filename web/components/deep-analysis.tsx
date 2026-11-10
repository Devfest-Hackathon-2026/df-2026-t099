"use client";

import { levelText, type AxisResult } from "@/lib/bubble-analysis";
import { buildReading } from "@/lib/reading";

// 5段階の目盛り。左が a 側、右が b 側。どちら寄りかは上の見出しで読めるので、目盛りは読み上げない
function Scale({ r }: { r: AxisResult }) {
  return (
    <div aria-hidden className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
      <span className={r.level < 2 ? "font-bold text-accent" : "text-muted"}>{r.aLabel}</span>
      <span className="flex items-center justify-between gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i === r.level;
          const size = [16, 12, 9, 12, 16][i];
          return (
            <span
              key={i}
              className={`rounded-full ${on ? "bg-accent" : "bg-surface-2"}`}
              style={{ width: size, height: size }}
            />
          );
        })}
      </span>
      <span className={r.level > 2 ? "font-bold text-accent" : "text-muted"}>{r.bLabel}</span>
    </div>
  );
}

export function DeepAnalysis({
  axes,
  type,
  coverage,
  topTopics,
  prediction,
  metrics,
}: {
  axes: AxisResult[];
  type: string;
  coverage: number;
  topTopics: string[];
  // 結果を見る前の本人の予想（約何種類か）。まとめに「予想とのずれ」も書く
  prediction?: number;
  metrics?: { effective: number; top3: number; attention: number; breadth: number };
}) {
  // まとめの文は、計算した数字からプログラムで作る（lib/reading.ts）。Gemini は呼ばない
  const reading = buildReading({ axes, topTopics, prediction, metrics: metrics ?? { effective: 0, top3: 0 } });
  void type;
  void coverage;

  return (
    <section>
      <h2 className="text-2xl font-bold">どんな動画に寄っているか</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        診断に使った動画が、6つの組のそれぞれでどちら側に寄っているかを、5段階で示します。作り手と言語の組は、チャンネル名や言語が分かる動画が5本以上あるときだけ出します。
      </p>

      <div className="mt-6 rounded-(--r-card) bg-surface p-6 sm:p-7">
        <p className="text-xs font-bold tracking-wider text-muted">まとめ</p>
        <div className="mt-3 flex flex-col gap-5 leading-[1.9]">
            <p className="text-[17px]">{reading.summary}</p>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              {[
                ["よく出てくるもの", reading.strength],
                ["ほとんど出てこないもの", reading.blindSpot],
                ["次にできること", reading.nextStep],
              ].map(([k, v]) => (
                <div key={k} className="rounded-(--r-inner) bg-surface-2 p-4">
                  <dt className="text-xs font-bold text-accent">{k}</dt>
                  <dd className="mt-1.5 text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {axes.map((r) => (
          <li key={r.key} className="rounded-(--r-card) bg-surface p-5">
            <p className="text-lg font-bold">{levelText(r)}</p>
            <div className="mt-4">
              <Scale r={r} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">{r.meaning}</p>
            <p className="mt-2 text-sm leading-relaxed">{r.evidence}</p>
            {r.blindSpots.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">まだ出てこないジャンル</span>
                {r.blindSpots.slice(0, 3).map((b) => (
                  <span key={b} className="rounded-full bg-surface-2 px-2.5 py-1">
                    {b}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
