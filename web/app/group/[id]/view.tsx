"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, Loader2, QrCode } from "lucide-react";
import { toast } from "@/lib/toast";
import { OceanMap } from "@/components/ocean-map";
import { ErrorText, PageShell } from "@/components/page-shell";
import { RoomQr } from "@/components/room-qr";
import { worldCoverage } from "@/lib/bubble-metrics";
import { typeName } from "@/lib/bubble-type";
import type { GenreCounts } from "@/lib/compare";
import { rememberGroupId } from "@/lib/diagnosis-store";

type Group = {
  name: string;
  n: number;
  counts: GenreCounts;
  topicCounts: Record<string, number>;
  avgMatch: number | null;
  nobody: string[];
  types: string[];
};

export default function GroupView() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [showQr, setShowQr] = useState(false);

  // 会場で使うときのために、6秒ごとに読み直して、診断した人が増えると地図が変わるようにする
  useEffect(() => {
    let stopped = false;
    let loaded = false;
    const load = () =>
      fetch(`/api/groups/${id}`)
        .then((r) => r.json() as Promise<Group & { error?: string }>)
        .then((d) => {
          if (stopped) return;
          if (d.error) return setError(d.error);
          loaded = true;
          setError("");
          setGroup(d);
        })
        // 読み直しの一時的な失敗では、表示中の地図を消さない（最初の読み込みだけエラーを出す）
        .catch(() => !stopped && !loaded && setError("グループを読み込めませんでした"));
    load();
    const timer = setInterval(load, 6000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [id]);

  if (error) return <PageShell title="グループの結果"><ErrorText>{error}</ErrorText></PageShell>;
  if (!group) {
    return (
      <PageShell title="グループの結果">
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          読み込んでいます
        </p>
      </PageShell>
    );
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast("リンクをコピーしました。LINE などに貼って送れます");
  }

  return (
    <PageShell
      title={`${group.name}の結果`}
      lead={
        group.n === 0
          ? "まだ誰も診断していません。下のボタンから診断して保存すると、このグループの結果に加わります。"
          : group.n < 3
            ? `${group.n} 人が診断しました。1人ひとりの結果がわからないように、3人そろってから結果を出します。`
            : `${group.n} 人が診断しました。${group.avgMatch !== null ? `メンバー同士のおすすめは、平均で ${group.avgMatch}% 似ています。` : ""}`
      }
    >
      {group.n >= 3 && (
        <>
          <OceanMap
            counts={group.counts}
            topics={group.topicCounts}
            coverage={Object.keys(group.topicCounts).length ? worldCoverage(group.topicCounts) : undefined}
            who="このグループ"
          />
          <section className="mt-8">
            <h2 className="font-bold">誰のおすすめにも出てこないジャンル</h2>
            <p className="mt-2 flex flex-wrap gap-2">
              {group.nobody.length === 0 ? (
                <span className="text-sm text-muted">ありません。どのジャンルも、誰かのおすすめに出てきています。</span>
              ) : (
                group.nobody.map((x) => (
                  <span key={x} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm">
                    {x}
                  </span>
                ))
              )}
            </p>
          </section>
          <section className="mt-8">
            <h2 className="font-bold">グループにいる見方のタイプ</h2>
            <p className="mt-2 flex flex-wrap gap-2 text-sm">
              {group.types.map((t) => (
                <Link key={t} href={`/types/${t}`} className="rounded-full bg-surface-2 px-3 py-1.5 hover:text-accent">
                  {typeName(t)}（{t}）
                </Link>
              ))}
            </p>
          </section>
        </>
      )}

      <section className="mt-8 rounded-(--r-card) bg-surface p-5 sm:p-6">
        <h2 className="font-bold">このグループで診断する</h2>
        <p className="mt-1 text-sm text-muted">診断のあと「保存して比べる」を押すと、あなたの結果がこのグループに加わります。</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/diagnose/swipe"
            onClick={() => rememberGroupId(id)}
            className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-bold text-accent-ink"
          >
            カードに答えて診断する
          </Link>
          <Link
            href="/diagnose/screenshot"
            onClick={() => rememberGroupId(id)}
            className="flex h-12 items-center justify-center rounded-full bg-surface-2 px-6 font-semibold"
          >
            スクショで診断する
          </Link>
        </div>
        <button onClick={copyLink} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent">
          <Copy size={16} aria-hidden />
          {copied ? "コピーしました" : "メンバーに送るリンクをコピー"}
        </button>
        <button
          onClick={() => setShowQr(true)}
          className="ml-5 mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent"
        >
          <QrCode size={16} aria-hidden />
          QR コードを画面に大きく出す
        </button>
      </section>
      {showQr && (
        <RoomQr
          url={window.location.href}
          name={group.name}
          n={group.n}
          coverage={Object.keys(group.topicCounts).length ? worldCoverage(group.topicCounts) : undefined}
          onClose={() => setShowQr(false)}
        />
      )}
    </PageShell>
  );
}
