"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";

// 試作のあいだは、合言葉を知っている人だけが入れる
export default function GatePage() {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      return setError(data.error ?? "入れませんでした。もう一度試してください");
    }
    // 来ようとしていた画面へ戻る。外のサイトへは飛ばさない
    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    // 「/evil.com」のような書き方も外のサイトになるので、同じサイトの中かを URL として確かめる
    let target = "/";
    try {
      const u = new URL(next, window.location.origin);
      if (u.origin === window.location.origin) target = u.pathname + u.search + u.hash;
    } catch {}
    window.location.href = target;
  }

  return (
    <PageShell back={false} title="合言葉を入れてください" lead="試作中のため、合言葉を知っている人だけが使えます。">
      <form onSubmit={enter} className="max-w-sm">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          autoFocus
          aria-label="合言葉"
          className="h-12 w-full rounded-xl bg-surface-2 px-4"
        />
        <div className="mt-5">
          <PrimaryButton type="submit" disabled={!word.trim() || busy}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            入る
          </PrimaryButton>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </form>
    </PageShell>
  );
}
