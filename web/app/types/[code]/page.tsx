import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { ALL_TYPE_CODES, describeType, isTypeCode, typeName } from "@/lib/bubble-type";
import { TypeFeed } from "./type-feed";

export function generateStaticParams() {
  return ALL_TYPE_CODES.map((code) => ({ code }));
}

export default function TypePage({ params }: PageProps<"/types/[code]">) {
  return (
    <Suspense>
      <TypeView params={params} />
    </Suspense>
  );
}

async function TypeView({ params }: { params: PageProps<"/types/[code]">["params"] }) {
  const { code } = await params;
  if (!isTypeCode(code)) notFound();

  return (
    <PageShell
      title={`「${typeName(code)}」（${code}）のホーム画面の例`}
      lead={`見方のタイプが「${describeType(code).join("・")}」の人の、YouTube のホーム画面の例です。動画は AI が作った架空のもので、実在しません。題名を押すと、YouTube で近い動画を検索します。`}
    >
      <TypeFeed code={code} />
      <h2 className="mt-12 font-bold">ほかのタイプを見る</h2>
      <p className="mt-3 flex flex-wrap gap-2">
        {ALL_TYPE_CODES.filter((c) => c !== code).map((c) => (
          <Link
            key={c}
            href={`/types/${c}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm hover:text-accent"
          >
            {typeName(c)}
            <span className="num text-xs text-muted">{c}</span>
          </Link>
        ))}
      </p>
    </PageShell>
  );
}
