"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Card, Chip, ErrorText, PageShell, PrimaryButton, SectionTitle } from "@/components/page-shell";
import { AXES, typeName } from "@/lib/bubble-type";
import { loadDiagnosis, subscribeDiagnosis } from "@/lib/diagnosis-store";
import { compareWithHome, type Gap } from "@/lib/gap";
import { genreOf, type Video } from "@/lib/genres";
import { shrinkImages } from "@/lib/shrink-image";

// 答え合わせ：スワイプの答え（自分が思う自分）と、ホーム画面のスクショ（アルゴリズムが見ている自分）を重ねる
export default function CheckPage() {
  const diagnosis = useSyncExternalStore(subscribeDiagnosis, loadDiagnosis, () => null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gap, setGap] = useState<Gap | null>(null);

  const swipes = diagnosis && (diagnosis.source === "swipe" || diagnosis.source === "sample") ? diagnosis.videos : null;

  if (!swipes) {
    return (
      <PageShell title="先にカードの質問に答えてください">
        <Link href="/diagnose/swipe" className="inline-flex min-h-11 items-center font-bold text-accent">
          カードの質問に答える
        </Link>
      </PageShell>
    );
  }

  async function check() {
    setBusy(true);
    setError("");
    const form = new FormData();
    (await shrinkImages(files)).forEach((f) => form.append("images", f));
    const res = await fetch("/api/screenshots", { method: "POST", body: form }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { videos?: Video[]; error?: string }) : {};
    setBusy(false);
    if (!res?.ok || !data.videos) return setError(data.error ?? "読み取れませんでした。もう一度試してください");
    if (data.videos.length === 0) return setError("画像から動画を読み取れませんでした。ホーム画面のスクリーンショットで試してください");
    setGap(compareWithHome(swipes!, data.videos));
  }

  if (!gap) {
    return (
      <PageShell
        title="実際のホーム画面と比べる"
        lead="カードの答えは、あなたが思うあなたのおすすめです。YouTube アプリのホーム画面のスクリーンショットを選ぶと、実際におすすめに出てきた動画と比べて、思っていたこととの違いを出します。ホーム画面にはふつうの動画が1画面に1〜2本しか写らないので、スクロールしながら6枚まで撮ると正確になります。画像は読み取りに使うだけで、保存しません。"
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-(--r-tile) border-2 border-dashed border-line bg-surface px-4 py-12 text-center hover:border-accent">
          <ImagePlus size={32} className="text-accent" aria-hidden />
          <span className="font-bold">ホーム画面のスクショを選ぶ（6枚まで）</span>
          <span className="text-sm text-muted">{files.length > 0 ? `${files.length}枚を選びました` : "ショートの画面でもかまいません"}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
          />
        </label>
        <div className="mt-6">
          <PrimaryButton onClick={check} disabled={files.length === 0 || busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {busy ? "読み取っています" : "読み取って比べる"}
          </PrimaryButton>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </PageShell>
    );
  }

  const label = { expected: "思っていたとおり", surprise: "意外", unsure: "どちらとも言えない" } as const;
  const sameAxes = AXES.filter((_, i) => gap.selfType[i] === gap.algoType[i]).length;

  return (
    <PageShell
      title={
        <>
          ホーム画面に出てきた動画の <span className="num text-[1.4em] text-accent">{gap.surpriseShare}%</span> は、
          <br />
          「出てこない」と思っていた話題でした
        </>
      }
      lead={`スクリーンショットから ${gap.items.length} 本の動画を読み取り、カードの答えと比べました。この割合が大きいほど、あなたが思うおすすめと、実際のホーム画面が違っています。`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["あなたが思うあなた", gap.selfType, "カードの答えから"],
          ["ホーム画面のあなた", gap.algoType, "ホーム画面から"],
        ].map(([k, code, note]) => (
          <div key={k} className="rounded-(--r-card) bg-surface p-6">
            <p className="text-xs font-bold tracking-wider text-muted">{k}</p>
            <p className="mt-2 text-2xl font-bold text-accent">{typeName(code)}</p>
            <p className="num mt-1 text-sm font-semibold tracking-[0.12em] text-muted">{code}</p>
            <p className="mt-1 text-xs text-muted">{note}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        4つの見方のうち {sameAxes} つが同じでした。
        {AXES.filter((_, i) => gap.selfType[i] !== gap.algoType[i])
          .map((a) => {
            const idx = AXES.indexOf(a);
            const mine = gap.selfType[idx] === a.a ? a.aLabel : a.bLabel;
            const algo = gap.algoType[idx] === a.a ? a.aLabel : a.bLabel;
            return `あなたの答えでは「${mine}」寄りですが、YouTube は「${algo}」寄りと見ています。`;
          })
          .join("")}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <SectionTitle note="出てこないと思っていたのに、ホーム画面に出てきた話題です">思ったより出てきた話題</SectionTitle>
          <p className="mt-4 flex flex-wrap gap-2">
            {gap.surpriseTopics.length ? gap.surpriseTopics.map((t) => <Chip key={t}>{t}</Chip>) : <span className="text-sm text-muted">ありません</span>}
          </p>
        </Card>
        <Card>
          <SectionTitle note="出てくると思っていたのに、このスクリーンショットには1本もなかったジャンルです。枚数が少ないと、ここに入りやすくなります">
            思ったより出てこないジャンル
          </SectionTitle>
          <p className="mt-4 flex flex-wrap gap-2">
            {gap.quietGenres.length ? gap.quietGenres.map((g) => <Chip key={g}>{g}</Chip>) : <span className="text-sm text-muted">ありません</span>}
          </p>
        </Card>
      </div>

      <details className="mt-8 text-sm" open>
        <summary className="cursor-pointer text-muted">読み取った動画の一覧</summary>
        <ul className="mt-3 flex flex-col gap-2">
          {gap.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  item.belief === "surprise" ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"
                }`}
              >
                {label[item.belief]}
              </span>
              <span>
                {item.title}
                <span className="text-muted">（{genreOf(item.genre).label}）</span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      <Link href="/result" className="mt-10 inline-flex min-h-11 items-center text-sm font-bold text-accent">
        診断の結果に戻る
      </Link>
    </PageShell>
  );
}
