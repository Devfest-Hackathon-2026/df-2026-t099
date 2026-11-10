import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ALL_TYPE_CODES, AXES, oppositeType, typeName } from "@/lib/bubble-type";

// 見方のタイプのカード。名前を先に、4文字の記号をそのあとに出し、4つの組のどちら寄りかを並べる。
// topGenre を渡すと「いちばん多いジャンル」を添える
// scores（-1〜+1）を渡すと、目盛りの点をどれだけ寄っているかの位置に置く。ないときは左右の端寄り
export function TypeCard({
  code,
  topGenre,
  scores,
  mine = true,
}: {
  code: string;
  topGenre?: string;
  scores?: number[];
  mine?: boolean;
}) {
  const opposite = oppositeType(code);
  return (
    <section className="overflow-hidden rounded-(--r-card) bg-surface">
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_1.2fr] sm:p-7">
        <div>
          <p className="text-xs font-bold tracking-wider text-muted">{mine ? "あなたの見方のタイプ" : "このタイプ"}</p>
          <p className="mt-3 text-3xl font-bold leading-tight text-accent">{typeName(code)}</p>
          <p className="num mt-1 text-xl font-bold tracking-[0.12em]">{code}</p>
          {topGenre && <p className="mt-2 text-sm text-muted">いちばん多いジャンル：{topGenre}</p>}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            4つの組のどちら側に寄っているかで決まる、{ALL_TYPE_CODES.length} のタイプの1つです。
          </p>
        </div>
        <ul className="flex flex-col justify-center gap-3 text-sm">
          {AXES.map((axis, i) => {
            const isA = code[i] === axis.a;
            return (
              <li key={axis.a} className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center gap-3">
                <span className={isA ? "font-bold" : "text-muted"}>{axis.aLabel}</span>
                <span className="relative h-1.5 rounded-full bg-surface-2">
                  <span
                    className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-accent"
                    style={{
                      left: scores
                        ? `calc(${Math.min(94, Math.max(6, 50 - 50 * scores[i]))}% - 6px)`
                        : isA ? "18%" : "82%",
                    }}
                  />
                </span>
                <span className={`text-right ${isA ? "text-muted" : "font-bold"}`}>{axis.bLabel}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <Link
        href={`/types/${opposite}`}
        className="flex min-h-11 items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm font-bold transition hover:bg-surface-2 sm:px-7"
      >
        <span>
          反対のタイプ「{typeName(opposite)}」（<span className="num">{opposite}</span>）の人の、ホーム画面の例を見る
        </span>
        <ArrowRight size={18} className="shrink-0" aria-hidden />
      </Link>
    </section>
  );
}
