"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { topicLabel, TOPICS } from "@/lib/topics";
import { changeFrom, previousOf, shortDate, useHistory, type HistoryEntry } from "@/lib/history";
import { RemindLink } from "./remind-link";

// 前回の診断と比べる。「見たことのない話題を1本見てみる」で動画を見たあと、
// おすすめが本当に変わったかを、話題の数と、新しく出てくるようになった話題で見せる。
// 記録は結果の画面（app/result/page.tsx）が残す。ここは見せるだけ
export function ProgressCompare({ entry }: { entry: HistoryEntry }) {
  const history = useHistory();
  const change = changeFrom(previousOf(history, entry), entry);
  const count = history.filter((h) => h.source !== "sample").length;

  return (
    <section className="mt-6 rounded-(--r-card) bg-surface p-5 sm:p-7">
      <h2 className="text-lg font-bold">{change ? `前回（${shortDate(change.previous.at)}）とくらべて` : "1週間後に、もう一度調べる"}</h2>
      {change ? (
        <>
          <p className="mt-3 text-sm font-bold">
            {change.diff > 0
              ? `出てくる話題が ${change.diff} 増えました`
              : change.diff < 0
                ? `出てくる話題が ${-change.diff} 減りました`
                : "出てくる話題の数は、前回と同じです"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-(--r-inner) bg-surface-2 p-4">
              <p className="text-xs text-muted">出てくる話題（{TOPICS.length} のうち）</p>
              <p className="num mt-1 text-xl font-bold">
                約{change.previous.kinds} → <span className="text-accent">約{entry.kinds}</span>
              </p>
            </div>
            <div className="rounded-(--r-inner) bg-surface-2 p-4">
              <p className="text-xs text-muted">かたよりの少なさ</p>
              <p className="num mt-1 text-xl font-bold">
                {change.previous.attention}% → <span className="text-accent">{entry.attention}%</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed">
            {change.reached.length > 0 ? (
              <>
                前回開いた話題のうち、
                <span className="font-semibold">「{change.reached.slice(0, 3).map(topicLabel).join("」「")}」</span>
                が、おすすめに出てくるようになりました。
              </>
            ) : change.added.length > 0 ? (
              <>
                前回は出てこなかった話題が、{change.added.length}つ出てくるようになりました：
                <span className="font-semibold">「{change.added.slice(0, 5).map(topicLabel).join("」「")}」</span>
              </>
            ) : (
              "前回と比べて、新しく出てくるようになった話題はありませんでした。"
            )}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          下の「見たことのない話題を1本見てみる」で動画を見てから、1週間後にもう一度調べると、おすすめが変わったかがわかります。
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <RemindLink />
        {count > 0 && (
          <Link href="/history" className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-bold text-accent">
            わたしの記録を見る（{count}回）
            <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        記録は、この端末にだけ残します。残すのは日付と数字と話題の名前で、動画の題名は残しません。
      </p>
    </section>
  );
}
