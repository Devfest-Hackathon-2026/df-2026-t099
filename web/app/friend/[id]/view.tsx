"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { typeName } from "@/lib/bubble-type";
import { rememberFriendId } from "@/lib/diagnosis-store";

// 友だちから届いた招待リンク。診断して保存すると、その友だちとの比較に進む
export default function FriendView() {
  const { id } = useParams<{ id: string }>();
  const [type, setType] = useState<string | null>(null);

  useEffect(() => {
    rememberFriendId(id);
    fetch(`/api/invites/${id}`)
      .then((r) => r.json() as Promise<{ type?: string }>)
      .then((d) => d.type && setType(d.type))
      .catch(() => {});
  }, [id]);

  return (
    <PageShell
      back={false}
      title="友だちから、YouTube のおすすめを比べる誘いが届いています"
      lead={`BubbLens は、YouTube のおすすめにどんな話題が出てくるかを調べるサービスです。${
        type ? `友だちの見方のタイプは「${typeName(type)}（${type}）」でした。` : ""
      }あなたも診断すると、2人のおすすめがどれだけ似ているかがわかります。`}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/diagnose/swipe"
          className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-bold text-accent-ink"
        >
          カードに答えて診断する
        </Link>
        <Link
          href="/diagnose/screenshot"
          className="flex h-12 items-center justify-center rounded-full bg-surface-2 px-6 font-semibold"
        >
          スクショで診断する
        </Link>
      </div>
      <p className="mt-4 text-sm text-muted">登録はいりません。診断のあと「保存して比べる」を押すと、2人を比べた結果が出ます。</p>
    </PageShell>
  );
}
