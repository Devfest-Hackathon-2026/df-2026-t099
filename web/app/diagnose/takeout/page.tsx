"use client";

import { postJson } from "@/lib/post-json";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";
import { saveDiagnosis } from "@/lib/diagnosis-store";
import type { Video } from "@/lib/genres";
import { parseWatchHistory } from "@/lib/takeout";

// 新しい順にこの本数だけ Gemini に送る。費用と待ち時間を抑えるため
const LIMIT = 300;
const CHUNK = 150;

export default function TakeoutPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<{ title: string; channel?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    setError("");
    setEntries([]);
    if (!file) return;
    try {
      setEntries(parseWatchHistory(JSON.parse(await file.text()), LIMIT));
    } catch {
      setError("watch-history.json を読めませんでした。Takeout で形式を JSON にして書き出したファイルを選んでください");
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    const videos: Video[] = [];
    for (let i = 0; i < entries.length; i += CHUNK) {
      const { ok, data } = await postJson<{ videos: Video[] }>("/api/classify", { videos: entries.slice(i, i + CHUNK) });
      if (!ok || !data.videos) {
        setBusy(false);
        return setError(data.error ?? "話題を分けられませんでした。もう一度試してください");
      }
      videos.push(...data.videos);
    }
    saveDiagnosis("takeout", videos);
    router.push("/result");
  }

  return (
    <PageShell
      title="視聴履歴から詳しく調べる"
      lead={`Google の Takeout で「YouTube と YouTube Music」の履歴を、形式を JSON にして書き出してください。書き出した zip を展開すると、中に watch-history.json があります。ファイルはこの端末の中で読み、新しい順に ${LIMIT} 本の題名とチャンネル名だけを AI に送って、話題を分けます。`}
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-(--r-tile) border-2 border-dashed border-line bg-surface px-4 py-12 text-center hover:border-accent">
        <FileUp size={32} className="text-accent" aria-hidden />
        <span className="font-bold">watch-history.json を選ぶ</span>
        {entries.length > 0 && <span className="text-sm text-muted">{entries.length}本の動画を読み込みました</span>}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      <div className="mt-6">
        <PrimaryButton onClick={submit} disabled={entries.length === 0 || busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {busy ? "話題を分けています" : "調べて結果を見る"}
        </PrimaryButton>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </PageShell>
  );
}
