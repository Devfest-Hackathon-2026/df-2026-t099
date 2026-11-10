"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink, Flame } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Baton } from "@/lib/db";
import { topicLabel } from "@/lib/topics";

// 友だちのおすすめの受け取り口。届いた動画を見てボタンを押すと、その話題が地図に加わり、送ってくれた人の名前が出る
export function BatonInbox({ id, inviteId, onLit }: { id: string; inviteId?: string; onLit: (batons: Baton[]) => void }) {
  const [batons, setBatons] = useState<Baton[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/batons/mine/${id}`)
      .then((r) => r.json() as Promise<{ batons?: Baton[] }>)
      .then((d) => {
        setBatons(d.batons ?? []);
        onLit(d.batons ?? []);
      })
      .catch(() => {});
  }, [id, onLit]);

  async function light(batonId: string) {
    const res = await fetch(`/api/batons/mine/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batonId }),
    }).catch(() => null);
    const d = res?.ok ? ((await res.json()) as { batons?: Baton[] }) : null;
    if (d?.batons) {
      setBatons(d.batons);
      onLit(d.batons);
    }
  }

  const link = typeof window !== "undefined" && inviteId ? `${window.location.origin}/baton/${inviteId}` : "";

  async function share() {
    const text =
      "YouTube のおすすめのかたよりを調べる「BubbLens」で、私のおすすめに出てこない話題がわかったよ。リンク先の一覧から、好きな動画を1本すすめてくれない？ 私が見たら、私の結果にあなたの名前が残るよ。";
    if (navigator.share) {
      await navigator.share({ text, url: link }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${link}`);
    setCopied(true);
    toast("リンクをコピーしました。LINE などに貼って送れます");
  }

  return (
    <section className="mt-8 rounded-(--r-card) bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Flame size={18} className="text-light" aria-hidden />
        友だちのおすすめ
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        友だちにリンクを送ると、あなたのおすすめに出てこない話題の中から、友だちが好きな動画を1本選んで送ってくれます。届いた動画を見たら「見たので地図に加える」を押してください。その話題が結果の地図に加わり、友だちの名前が表示されます。リンクを開いた人に見えるのは、あなたのおすすめに出てこない話題の一覧だけです。
      </p>
      <button
        onClick={share}
        disabled={!link}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-5 font-semibold"
      >
        <Copy size={16} aria-hidden />
        {copied ? "コピーしました" : "友だちにすすめてもらうリンクを送る"}
      </button>

      {batons.length > 0 && (
        <ul className="mt-6 grid gap-3">
          {batons.map((b) => (
            <li key={b.id} className="rounded-(--r-inner) bg-surface-2 p-4">
              <p className="text-xs text-muted">
                {b.from} から ／ 「{topicLabel(b.topic)}」の話題
              </p>
              <p className="mt-1 font-bold leading-snug">{b.title}</p>
              {b.message && <p className="mt-1 text-sm leading-relaxed">「{b.message}」</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-accent"
                >
                  <ExternalLink size={15} aria-hidden />
                  YouTube で見る
                </a>
                {b.litAt ? (
                  <span className="text-sm text-muted">地図に加わりました</span>
                ) : (
                  <button onClick={() => light(b.id)} className="h-11 rounded-full bg-accent px-5 text-sm font-bold text-accent-ink">
                    見たので地図に加える
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
