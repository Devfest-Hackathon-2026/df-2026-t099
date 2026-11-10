"use client";

import { useState } from "react";
import { PageShell, PrimaryButton } from "@/components/page-shell";
import { TOPICS } from "@/lib/topics";

// 結果を見る前に、自分で予想してもらう。予想と結果の差が、いちばん強い気づきになる
export function PredictGate({ onDone, who = "あなた" }: { onDone: (prediction: number | null) => void; who?: string }) {
  const [value, setValue] = useState(75);
  // 初めの位置のまま押すと、考えずに予想したことになる。一度動かしてから押せるようにする
  const [moved, setMoved] = useState(false);

  return (
    <PageShell
      title="結果を見る前に、予想してください"
      lead={`YouTube の動画を ${TOPICS.length} の話題に分けました。そのうち、${who}のおすすめに一度も出てこない話題は、いくつだと思いますか。`}
    >
      <div className="mx-auto max-w-md rounded-(--r-card) bg-surface p-6 text-center sm:p-8">
        <p className="num text-7xl font-bold text-accent">
          {value}
          <span className="ml-2 text-2xl text-muted">/ {TOPICS.length}</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          {value < 15 ? "ほとんどの話題が出てくると思う" : value < 50 ? "出てこない話題は少しだと思う" : value < 100 ? "かなりの話題が出てこないと思う" : "ほとんどの話題が出てこないと思う"}
        </p>
        <input
          type="range"
          min={0}
          max={TOPICS.length}
          step={1}
          value={value}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setMoved(true);
          }}
          aria-label="おすすめに一度も出てこないと思う話題の数"
          className="mt-6 w-full accent-[var(--accent)]"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>0</span>
          <span>{TOPICS.length}</span>
        </div>
        <div className="mt-8">
          <PrimaryButton onClick={() => onDone(value)} disabled={!moved}>
            {moved ? "この予想で結果を見る" : "つまみを動かして予想してください"}
          </PrimaryButton>
        </div>
        <button onClick={() => onDone(null)} className="mt-4 min-h-11 text-sm text-muted hover:text-foreground">
          予想しないで結果を見る
        </button>
      </div>
    </PageShell>
  );
}

// 予想と結果の差。思っていたより狭いのか広いのかを、2本の棒で並べて見せる
export function PredictionGap({ predicted, actual: raw }: { predicted: number; actual: number }) {
  // 見出しの「約○」とそろえて、整数で比べる
  const actual = Math.max(0, Math.round(raw));
  const diff = predicted - actual;
  // 予想も結果も「149 の話題のうち、おすすめに一度も出てこない話題の数」。差が2つ以上あれば、思い込みとのずれとして伝える
  const message =
    diff >= 2
      ? `一度も出てこない話題は、思っていたより ${diff} 少なめでした。`
      : diff <= -2
        ? `思っていたより ${-diff} 多くの話題が、一度も出てきませんでした。`
        : "ほぼ予想どおりでした。";
  const note =
    diff >= 2
      ? `それでも、約 ${actual} の話題はおすすめに一度も出てきません。`
      : diff <= -2
        ? "あなたが思っていたより、おすすめはせまい範囲から選ばれています。"
        : "あなたのかたよりを、かなり正しくつかめています。";
  const max = Math.max(predicted, actual, 1);
  return (
    <section className="mt-6 rounded-(--r-card) bg-surface p-6">
      <p className="text-xl font-bold">{message}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-5 flex flex-col gap-3 text-sm">
        {[
          ["あなたの予想", predicted, "bg-[#64d2ff]"],
          ["診断の結果", actual, "bg-accent"],
        ].map(([label, v, color]) => (
          <div key={label as string} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3">
            <span className="text-muted">{label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
              <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max(2, ((v as number) / max) * 100)}%` }} />
            </span>
            <span className="num text-right font-bold">{v as number}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
