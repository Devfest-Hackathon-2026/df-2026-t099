"use client";

import { SlidersHorizontal } from "lucide-react";
import { saveCorrection } from "@/lib/diagnosis-store";
import type { Estimate } from "@/lib/estimate";
import { GENRES, type GenreId } from "@/lib/genres";
import { topicsOf } from "@/lib/topics";

// 結果を本人が直す：ジャンルごとに「どれくらい流れてくるか」を選び直すと、推定に反映する。
// 自分で確かめて直した結果のほうが、納得しやすい
const LEVELS = [
  { share: 0, label: "出てこない" },
  { share: 0.25, label: "たまに" },
  { share: 0.6, label: "わりと" },
  { share: 1, label: "よく" },
] as const;

export function CorrectionPanel({
  estimate,
  corrections,
}: {
  estimate: Estimate;
  corrections: Partial<Record<GenreId, number>>;
}) {
  const genres = GENRES.filter((g) => g.id !== "other");
  const count = Object.keys(corrections).length;

  return (
    <details className="group rounded-(--r-card) bg-surface p-6" open={count > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span>
          <span className="flex items-center gap-2 font-bold">
            <SlidersHorizontal size={18} className="text-accent" aria-hidden />
            感覚と違うジャンルを直す
          </span>
          <span className="mt-1 block text-sm text-muted">
            {count > 0
              ? `${count} つのジャンルを直しました。上の数字と地図は、直した内容で計算しています。`
              : "自分の感覚と違うジャンルだけ、おすすめに出てくる量を選び直してください。選ぶと、上の数字と地図が計算し直されます。"}
          </span>
        </span>
      </summary>
      <ul className="mt-5 flex flex-col gap-3">
        {genres.map((g) => {
          const fixed = corrections[g.id];
          const share = fixed ?? (estimate.byGenre[g.id]?.shownTopics ?? 0) / topicsOf(g.id).length;
          const nearest = LEVELS.reduce((a, b) => (Math.abs(b.share - share) < Math.abs(a.share - share) ? b : a));
          return (
            <li key={g.id} className="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
              <span className="text-sm font-bold">
                {g.label}
                {fixed !== undefined && <span className="ml-2 text-xs font-normal text-accent">直した</span>}
              </span>
              <span className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={`${g.label}がどれくらいおすすめに出てくるか`}>
                {LEVELS.map((l) => {
                  const on = nearest.share === l.share;
                  return (
                    <button
                      key={l.share}
                      role="radio"
                      aria-checked={on}
                      onClick={() => saveCorrection(g.id, l.share)}
                      className={`h-11 rounded-lg text-xs transition ${
                        on ? (fixed !== undefined ? "bg-accent font-bold text-accent-ink" : "bg-surface-2 font-bold text-foreground ring-1 ring-accent/50") : "bg-surface-2/50 text-muted hover:text-foreground"
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      {count > 0 && (
        <button
          onClick={() => Object.keys(corrections).forEach((g) => saveCorrection(g, null))}
          className="mt-4 min-h-11 text-sm text-muted hover:text-foreground"
        >
          直す前に戻す
        </button>
      )}
    </details>
  );
}
