"use client";

import { postJson } from "@/lib/post-json";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorText, PageShell, PrimaryButton } from "@/components/page-shell";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const { ok, data } = await postJson<{ id: string }>("/api/groups", { name });
    if (!ok || !data.id) {
      setBusy(false);
      return setError(data.error ?? "グループを作れませんでした");
    }
    router.push(`/group/${data.id}`);
  }

  return (
    <PageShell
      title="グループで診断する"
      lead="ゼミ、サークル、クラスなどのメンバーで診断すると、誰のおすすめにも出てこないジャンルがわかります。3人以上が診断すると、結果が出ます。見せるのは全員を合わせた結果だけで、1人ひとりの結果はほかのメンバーには見せません。"
    >
      <label className="text-sm">
        グループの名前
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：〇〇ゼミ"
          maxLength={40}
          className="mt-1 h-12 w-full rounded-xl bg-surface-2 px-4"
        />
      </label>
      <div className="mt-5">
        <PrimaryButton onClick={create} disabled={!name.trim() || busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          グループを作る
        </PrimaryButton>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </PageShell>
  );
}
