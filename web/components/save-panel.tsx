"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorText, PrimaryButton } from "@/components/page-shell";
import { AGE_BANDS, REGIONS } from "@/lib/compare";
import { rememberGroupId, rememberMine, takeFriendId, takeGroupId } from "@/lib/diagnosis-store";
import { postJson } from "@/lib/post-json";
import type { Video } from "@/lib/genres";

// 結果を保存すると、同世代や友だちと比べられる。保存は本人が押したときだけ
export function SavePanel({ videos }: { videos: Video[] }) {
  const router = useRouter();
  const [ageBand, setAgeBand] = useState("");
  const [region, setRegion] = useState("");
  const [shareChannels, setShareChannels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const groupId = takeGroupId();
    const { ok, data } = await postJson<{ id: string; inviteId: string }>("/api/diagnoses", {
      videos,
      ageBand,
      region,
      shareChannels,
      groupId,
    });
    if (!ok || !data.id) {
      // 失敗したら、グループに入るための印を戻しておく（やり直したときにグループに入れるように）
      if (groupId) rememberGroupId(groupId);
      setBusy(false);
      return setError(data.error ?? "保存できませんでした");
    }
    rememberMine(data.id);
    const friend = takeFriendId();
    if (groupId) router.push(`/group/${groupId}`);
    // 比べる画面の URL には、本人用の id ではなく招待用の id を使う（URL を人に見せても、まとめは開けない）
    else router.push(friend && data.inviteId ? `/compare/${data.inviteId}/${friend}` : `/me/${data.id}`);
  }

  const selectClass = "mt-1.5 h-12 w-full rounded-xl bg-surface-2 px-4 text-foreground";

  return (
    <section className="rounded-(--r-card) bg-surface p-6 sm:p-7">
      <h2 className="text-lg font-bold">同じ年代・地域の人や友だちと比べる</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        保存するのは、話題ごとの動画の本数、見方のタイプ、下で選んだ項目だけです。動画の題名は保存しません。
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          年代（任意）
          <select value={ageBand} onChange={(e) => setAgeBand(e.target.value)} className={selectClass}>
            <option value="">選ばない</option>
            {AGE_BANDS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          地域（任意）
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass}>
            <option value="">選ばない</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 flex min-h-11 items-start gap-2 py-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={shareChannels}
          onChange={(e) => setShareChannels(e.target.checked)}
          className="mt-1 accent-[var(--accent)]"
        />
        よく出てくるチャンネルの名前も保存して、友だちと同じチャンネルを調べる
      </label>
      <div className="mt-6">
        <PrimaryButton onClick={save} disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          保存して比べる
        </PrimaryButton>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </section>
  );
}
