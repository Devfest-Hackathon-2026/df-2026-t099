"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { RemindLink } from "@/components/remind-link";
import { CountUp } from "@/components/result-story";
import { clearHistory, shortDate, useHistory, type HistoryEntry } from "@/lib/history";
import type { DiagnosisSource } from "@/lib/genres";
import { topicLabel, TOPICS } from "@/lib/topics";

// わたしの記録：これまでの診断を日付の順に並べ、出てくる話題の数の変化を小さなグラフで見せる
const METHOD: Record<DiagnosisSource, string> = {
  swipe: "カード",
  screenshot: "スクショ",
  url: "動画のリンク",
  takeout: "視聴履歴",
  sample: "サンプル",
};

export default function HistoryPage() {
  const history = useHistory().filter((h) => h.source !== "sample");
  const last = history.at(-1);

  if (!last) {
    return (
      <PageShell title="わたしの記録" lead="診断すると、この端末に記録が残ります。2回目から、前回とくらべられます。">
        <Link href="/diagnose/swipe" className="inline-flex h-12 items-center rounded-full bg-accent px-7 font-bold text-accent-ink">
          診断をはじめる
        </Link>
      </PageShell>
    );
  }

  // グラフは、いちばん新しい回と同じ調べ方の記録だけで描く（調べ方が違うと数え方も違う）
  const line = history.filter((h) => h.source === last.source);
  const first = line[0];
  const total = last.kinds - first.kinds;

  return (
    <PageShell
      title="わたしの記録"
      lead={
        line.length < 2
          ? "記録は1回です。1週間後にもう一度調べると、おすすめの話題が広がったかがわかります。"
          : total > 0
            ? `最初（${shortDate(first.at)}）より、おすすめに出てくる話題が ${total} 増えました。`
            : total < 0
              ? `最初（${shortDate(first.at)}）より、おすすめに出てくる話題が ${-total} 減りました。`
              : `最初（${shortDate(first.at)}）から、おすすめに出てくる話題の数は変わっていません。`
      }
    >
      <section className="rounded-(--r-card) bg-surface p-5 sm:p-7">
        <p className="text-xs font-bold text-muted">いまのおすすめ（{METHOD[last.source]}で調べた結果）</p>
        <p className="mt-1 font-bold leading-none">
          <span className="text-lg">約</span>
          <CountUp from={first.kinds} to={last.kinds} delay={200} className="mx-1 text-5xl text-accent" />
          <span className="text-lg">/ {TOPICS.length} の話題が出てくる</span>
          {line.length > 1 && total !== 0 && (
            <span className={`num ml-2 rounded-full px-2.5 py-1 text-sm ${total > 0 ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"}`}>
              {total > 0 ? `+${total}` : total}
            </span>
          )}
        </p>
        <KindsChart entries={line} />
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href="/diagnose/swipe" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-accent-ink">
          もう一度診断する
        </Link>
        <RemindLink />
      </div>

      <h2 className="mt-10 text-lg font-bold">これまでの診断</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {[...history].reverse().map((h) => (
          <Row key={h.id} entry={h} before={history.filter((x) => x.source === h.source && x.at < h.at).at(-1)} />
        ))}
      </ol>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        記録は、この端末のこのブラウザにだけ残っています。残すのは日付と数字と話題の名前で、動画の題名は残しません。
      </p>
      <button
        onClick={() => {
          if (window.confirm("この端末の記録をすべて消します。元に戻せません。消しますか？")) clearHistory();
        }}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <Trash2 size={15} aria-hidden />
        この端末の記録を消す
      </button>
    </PageShell>
  );
}

function Row({ entry: h, before }: { entry: HistoryEntry; before?: HistoryEntry }) {
  const diff = before ? h.kinds - before.kinds : 0;
  return (
    <li className="rounded-(--r-inner) bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm">
          <span className="num font-bold">{new Date(h.at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" })}</span>
          <span className="ml-2 text-xs text-muted">{METHOD[h.source]}</span>
        </p>
        <p className="num font-bold">
          約{h.kinds} / {TOPICS.length}
          {before && diff !== 0 && <span className={`ml-1.5 text-sm ${diff > 0 ? "text-accent" : "text-muted"}`}>{diff > 0 ? `+${diff}` : diff}</span>}
        </p>
      </div>
      {h.top && h.top.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          多い話題：<span className="text-foreground">{h.top.map(topicLabel).join("・")}</span>
        </p>
      )}
      {h.outside && h.outside.length > 0 && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          開いた、おすすめに出てこない話題：<span className="text-foreground">{h.outside.map(topicLabel).join("・")}</span>
        </p>
      )}
    </li>
  );
}

// 出てくる話題の数の変化。点は古い順に左から右へ。いちばん新しい点は、前の点より大きければ波が広がる
function KindsChart({ entries }: { entries: HistoryEntry[] }) {
  const W = 320;
  const H = 120;
  const pad = { l: 16, r: 16, t: 26, b: 22 };
  const max = Math.max(...entries.map((e) => e.kinds), 1);
  const min = Math.min(...entries.map((e) => e.kinds));
  const lo = Math.max(0, min - Math.max(2, (max - min) * 0.5));
  const hi = max + Math.max(1, (max - min) * 0.2);
  const x = (i: number) => (entries.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (entries.length - 1));
  const y = (k: number) => pad.t + (1 - (k - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const pts = entries.map((e, i) => [x(i), y(e.kinds)] as const);
  const n = entries.length;
  const grew = n > 1 && entries[n - 1].kinds > entries[n - 2].kinds;
  // 点が多いときは、日付と数字を間引く（最初・最後と、数が変わった所は残す）
  const step = Math.ceil(n / 6);
  const label = (i: number) => i === 0 || i === n - 1 || i % step === 0;

  return (
    <figure className="mt-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`出てくる話題の数の変化：${entries.map((e) => `${shortDate(e.at)} 約${e.kinds}`).join("、")}`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="currentColor" strokeOpacity="0.15" />
        {n > 1 && (
          <polyline
            points={pts.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="hist-line"
          />
        )}
        {pts.map(([px, py], i) => (
          <g key={entries[i].id}>
            {i === n - 1 && grew && <circle cx={px} cy={py} r="6" fill="none" stroke="var(--accent)" strokeWidth="2" className="hist-ripple" style={{ transformOrigin: `${px}px ${py}px` }} />}
            <circle
              cx={px}
              cy={py}
              r={i === n - 1 ? 6 : 4}
              fill={i === n - 1 ? "var(--accent)" : "var(--surface)"}
              stroke="var(--accent)"
              strokeWidth="2"
              className="st-dot"
              style={{ transformOrigin: `${px}px ${py}px`, animationDelay: `${200 + i * 120}ms` }}
            />
            {label(i) && (
              <>
                <text x={px} y={py - 11} textAnchor="middle" className="num fill-current text-[11px] font-bold">
                  約{entries[i].kinds}
                </text>
                <text x={px} y={H - 6} textAnchor="middle" className="num fill-current text-[10px] opacity-60">
                  {shortDate(entries[i].at)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">おすすめに一度でも出てくる話題の数（{TOPICS.length} のうち）</figcaption>
    </figure>
  );
}
