"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";
import { saveDiagnosis } from "@/lib/diagnosis-store";
import type { Video } from "@/lib/genres";
import { shrinkImages } from "@/lib/shrink-image";

export default function ScreenshotPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  // ホームやショートの画面は「流れてきた」、履歴の画面は「見た」として扱う
  const [screen, setScreen] = useState<"shown" | "watched">("shown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const form = new FormData();
    (await shrinkImages(files)).forEach((f) => form.append("images", f));
    const res = await fetch("/api/screenshots", { method: "POST", body: form }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { videos?: Video[]; error?: string }) : {};
    setBusy(false);
    if (!res?.ok || !data.videos) return setError(data.error ?? "読み取れませんでした。もう一度試してください");
    if (data.videos.length === 0) return setError("画像から動画を読み取れませんでした。別の画面のスクリーンショットで試してください");
    saveDiagnosis(
      "screenshot",
      data.videos.map((v) => ({ ...v, exposure: screen })),
    );
    router.push("/result");
  }

  return (
    <PageShell
      title="スクリーンショットで調べる"
      lead="YouTube アプリのホーム、ショート、履歴のどれかの画面を撮って、画像を選んでください。写っている動画を AI が読み取って診断します。ホーム画面にはふつうの動画が1画面に1〜2本しか写らないので、スクロールしながら6枚まで撮ると正確になります。画像は読み取りに使うだけで、保存しません。"
    >
      <p className="text-sm font-bold">どの画面を撮りましたか？</p>
      <div className="mb-5 mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="どの画面を撮ったか">
        {(
          [
            ["shown", "ホーム・ショート", "おすすめに出てきた動画"],
            ["watched", "履歴", "実際に見た動画"],
          ] as const
        ).map(([value, label, note]) => (
          <button
            key={value}
            role="radio"
            aria-checked={screen === value}
            onClick={() => setScreen(value)}
            className={`rounded-(--r-inner) border p-4 text-left transition ${
              screen === value ? "border-accent bg-accent/10" : "border-line bg-surface"
            }`}
          >
            <span className="block font-bold">{label}</span>
            <span className="mt-0.5 block text-xs text-muted">{note}</span>
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-(--r-tile) border-2 border-dashed border-line bg-surface px-4 py-12 text-center hover:border-accent">
        <ImagePlus size={32} className="text-accent" aria-hidden />
        <span className="font-bold">画像を選ぶ（6枚まで）</span>
        {files.length > 0 && <span className="text-sm text-muted">{files.length}枚を選びました</span>}
        <input
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
        />
      </label>

      <div className="mt-6">
        <PrimaryButton onClick={submit} disabled={files.length === 0 || busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {busy ? "読み取っています" : "読み取って結果を見る"}
        </PrimaryButton>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </PageShell>
  );
}
