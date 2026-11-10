"use client";

import { postJson } from "@/lib/post-json";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";
import { saveDiagnosis } from "@/lib/diagnosis-store";
import type { Video } from "@/lib/genres";

export default function UrlPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const urls = text.split(/\s+/).filter((s) => s.startsWith("http"));

  async function submit() {
    setBusy(true);
    setError("");
    const { ok, data } = await postJson<{ videos: Video[] }>("/api/from-urls", { urls });
    setBusy(false);
    if (!ok || !data.videos) return setError(data.error ?? "調べられませんでした。もう一度試してください");
    saveDiagnosis("url", data.videos);
    router.push("/result");
  }

  return (
    <PageShell
      title="動画のリンクを貼って調べる"
      lead="YouTube で動画の「共有」から「コピー」を押すと、リンクをコピーできます。最近見た動画のリンクを、1行に1本ずつ貼ってください。5本以上あると、かたよりが分かりやすくなります。一度に調べられるのは30本までです。"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"https://youtu.be/...\nhttps://www.youtube.com/watch?v=..."}
        className="w-full rounded-xl bg-surface-2 p-4 text-sm"
      />
      <p className="mt-2 text-sm text-muted">{urls.length}本のリンク</p>
      <div className="mt-4">
        <PrimaryButton onClick={submit} disabled={urls.length === 0 || busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {busy ? "調べています" : "調べて結果を見る"}
        </PrimaryButton>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </PageShell>
  );
}
