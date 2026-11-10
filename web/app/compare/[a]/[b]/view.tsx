"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { DuoStory, type DuoTopics } from "@/components/duo-story";
import { ErrorText, PageShell } from "@/components/page-shell";
import { typeName } from "@/lib/bubble-type";
import { GENRES } from "@/lib/genres";
import { useMineId } from "@/lib/use-mine";

type Comparison = {
  a: { type: string };
  b: { type: string };
  match: number;
  both: string[];
  onlyA: string[];
  onlyB: string[];
  sharedChannels: string[];
  channelsCompared: boolean;
  topics: DuoTopics | null;
};

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-muted">{empty}</p>;
  return (
    <p className="mt-2 flex flex-wrap gap-2">
      {items.map((x) => (
        <span key={x} className="rounded-full bg-surface-2 px-3 py-1.5 text-sm">
          {x}
        </span>
      ))}
    </p>
  );
}

export default function CompareView() {
  const mine = useMineId();
  const { a, b } = useParams<{ a: string; b: string }>();
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  // 2人のまとめは、まずスライドで見せる
  const [story, setStory] = useState(true);

  useEffect(() => {
    fetch(`/api/compare?a=${a}&b=${b}`)
      .then((r) => r.json() as Promise<Comparison & { error?: string }>)
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("比べられませんでした"));
  }, [a, b]);

  if (error) return <PageShell title="友だちと比べる"><ErrorText>{error}</ErrorText></PageShell>;
  if (!data) {
    return (
      <PageShell title="友だちと比べる">
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          比べています
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={<>2人のおすすめは <span className="num text-[1.4em] text-accent">{data.match}%</span> 似ています</>}
      lead={`${GENRES.filter((g) => g.id !== "other").length} のジャンルがそれぞれどれだけ出てくるかを比べた数字です。あなたは「${typeName(data.a.type)}（${data.a.type}）」、友だちは「${typeName(data.b.type)}（${data.b.type}）」のタイプです。`}
    >
      {story && (
        <DuoStory match={data.match} myType={data.a.type} friendType={data.b.type} topics={data.topics} onClose={() => setStory(false)} />
      )}
      <button onClick={() => setStory(true)} className="mb-8 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-ink">
        <Play size={16} aria-hidden />
        2人のまとめをスライドで見る
      </button>
      <section>
        <h2 className="font-bold">2人ともおすすめに出てくるジャンル</h2>
        <Chips items={data.both} empty="ありません" />
      </section>
      <section className="mt-8">
        <h2 className="font-bold">あなたのおすすめにだけ出てくるジャンル</h2>
        <Chips items={data.onlyA} empty="ありません" />
      </section>
      <section className="mt-8">
        <h2 className="font-bold">友だちのおすすめにだけ出てくるジャンル</h2>
        <Chips items={data.onlyB} empty="ありません" />
      </section>
      <section className="mt-8">
        <h2 className="font-bold">2人ともおすすめに出てくるチャンネル</h2>
        {data.channelsCompared ? (
          <Chips items={data.sharedChannels} empty="ありません" />
        ) : (
          <p className="mt-2 text-sm text-muted">チャンネルは、2人とも保存するときにチャンネル名も保存した場合だけ比べます。</p>
        )}
      </section>
      {mine && (
        <Link href={`/me/${mine}`} className="mt-10 inline-flex min-h-11 items-center font-bold text-accent">
          自分のまとめと、友だちのおすすめを見る
        </Link>
      )}
    </PageShell>
  );
}
