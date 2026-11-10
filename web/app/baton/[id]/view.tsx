"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";
import { GENRES } from "@/lib/genres";
import { postJson } from "@/lib/post-json";
import { topicLabel, topicsOf } from "@/lib/topics";

// 友だちのおすすめを送る画面。友だちのおすすめに出てこない話題から、自分の好きな動画を1本送る
export default function BatonView() {
  const { id } = useParams<{ id: string }>();
  const [fog, setFog] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ topic: string; title: string } | null>(null);

  useEffect(() => {
    fetch(`/api/batons/to/${id}`)
      .then((r) => r.json() as Promise<{ fog?: string[]; error?: string }>)
      .then((d) => (d.fog ? setFog(d.fog) : setError(d.error ?? "読み込めませんでした")))
      .catch(() => setError("読み込めませんでした"));
  }, [id]);

  async function send() {
    setBusy(true);
    setError("");
    const { ok, data } = await postJson<{ topic: string; title: string }>("/api/batons", { inviteId: id, url, from, message });
    setBusy(false);
    if (!ok || !data.topic) return setError(data.error ?? "送れませんでした");
    setSent({ topic: data.topic, title: data.title ?? "" });
  }

  if (!fog) {
    return (
      <PageShell back={false} title="友だちに、動画を1本すすめてください">
        {error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            読み込んでいます
          </p>
        )}
      </PageShell>
    );
  }

  if (sent) {
    return (
      <PageShell back={false} title="友だちに送りました">
        <p className="leading-relaxed">
          「{sent.title}」を、「{topicLabel(sent.topic)}」の話題の動画として送りました。友だちが見ると、友だちの結果にこの話題が加わり、「{from}」の名前が表示されます。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setSent(null);
              setUrl("");
              setMessage("");
            }}
            className="h-11 rounded-full border border-line px-5 text-sm font-bold"
          >
            別の動画も送る
          </button>
        </div>
        <section className="mt-8 rounded-(--r-card) bg-surface p-5">
          <h2 className="font-bold">あなたも友だちにすすめてもらう</h2>
          <p className="mt-1 text-sm text-muted">
            診断して保存すると、あなた用のリンクができます。友だちに送ると、あなたのおすすめに出てこない話題の動画を、友だちが選んで送ってくれます。
          </p>
          <Link href="/" className="mt-4 inline-flex h-12 items-center rounded-full bg-accent px-6 font-bold text-accent-ink">
            自分も診断する
          </Link>
        </section>
      </PageShell>
    );
  }

  const fogSet = new Set(fog);
  const genres = GENRES.filter((g) => g.id !== "other")
    .map((g) => ({ ...g, total: topicsOf(g.id).length, topics: topicsOf(g.id).filter((t) => fogSet.has(t.id)) }))
    .filter((g) => g.topics.length > 0)
    .sort((a, b) => b.topics.length / b.total - a.topics.length / a.total);

  return (
    <PageShell
      back={false}
      title="友だちに、動画を1本すすめてください"
      lead="友だちの YouTube のおすすめには、下の話題の動画が出てきません。この中から、あなたが好きな動画を1本選んで送ってください。友だちが見ると、友だちの結果にその話題が加わり、あなたの名前が表示されます。"
    >
      <section>
        <h2 className="font-bold">友だちのおすすめに出てこない話題</h2>
        <p className="mt-1 text-sm text-muted">出てこない話題が多いジャンルから順に並べています。</p>
        <ul className="mt-4 grid gap-3">
          {genres.map((g) => (
            <li key={g.id} className="rounded-(--r-inner) bg-surface-2 p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden />
                {g.label}
                {g.topics.length === g.total && <span className="text-xs font-normal text-muted">ジャンルごと出てこない</span>}
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {g.topics.map((t) => (
                  <span key={t.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                    {t.label}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-(--r-card) bg-surface p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <Flame size={18} className="text-light" aria-hidden />
          すすめる動画
        </h2>
        <label className="mt-4 block text-sm text-muted">
          YouTube の動画のリンク（動画の「共有」から「コピー」を押すと取れます）
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="https://youtu.be/..."
            className="mt-1.5 h-12 w-full rounded-xl bg-surface-2 px-4 text-foreground"
          />
        </label>
        <label className="mt-3 block text-sm text-muted">
          あなたの名前（ニックネームでかまいません）
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            maxLength={20}
            className="mt-1.5 h-12 w-full rounded-xl bg-surface-2 px-4 text-foreground"
          />
        </label>
        <label className="mt-3 block text-sm text-muted">
          友だちへのひとこと（なくてもかまいません）
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={80}
            placeholder="これ絶対ハマると思う"
            className="mt-1.5 h-12 w-full rounded-xl bg-surface-2 px-4 text-foreground"
          />
        </label>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          送った動画の題名と、あなたの名前とひとことは、友だちに届きます。どの話題の動画かは、AI が題名から決めます。友だちのおすすめにもう出てくる話題だったときは、別の動画を選んでください。
        </p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="mt-4">
          <PrimaryButton onClick={send} disabled={busy || !url.trim() || !from.trim()}>
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                どの話題の動画かを調べています
              </>
            ) : (
              "友だちに送る"
            )}
          </PrimaryButton>
        </div>
      </section>
    </PageShell>
  );
}
