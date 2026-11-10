import Link from "next/link";
import { Camera, ChevronRight, FileJson, Link2, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { SampleLink } from "@/components/sample-link";
import { MineLink } from "@/components/mine-link";
import { HistoryLink } from "@/components/history-link";
import { TopicBubble } from "@/components/topic-bubble";
import { TOPICS } from "@/lib/topics";

// 初めて来た人が「何のサービスか・何をすればいいか・何がわかるか」を順に読めるように並べる。
// 文言は yomiyasu で推敲した（読み手：専門知識のない人）
const FEATURES = [
  { title: "一度も出てこない話題はいくつか", text: `${TOPICS.length} の話題のうち、あなたのおすすめに一度も出てこない話題の数がわかります。` },
  { title: "YouTube に見えていそうなあなた", text: "おすすめの動画の並びから、YouTube にはどんな人に見えていそうかを、AI（Gemini）が想像します。" },
  {
    title: "友だちにすすめてもらう",
    text: "あなたのおすすめに出てこない分野の動画を、友だちに1本選んでもらえます。見ると、結果の地図に友だちの名前が残ります。",
  },
] as const;

const METHODS = [
  { href: "/diagnose/screenshot", icon: Camera, title: "スクリーンショットで調べる", text: "YouTube のホーム画面を、6枚まで撮って送るだけです。実際におすすめされている動画から調べます。" },
  { href: "/diagnose/url", icon: Link2, title: "動画のリンクを貼る", text: "最近見た動画のリンクを、何本か貼ります。" },
  { href: "/diagnose/takeout", icon: FileJson, title: "視聴履歴から詳しく調べる", text: "Google から視聴履歴のファイルを取り出して読み込みます。準備に数分以上かかります。" },
  { href: "/group", icon: Users, title: "友だちやサークルで調べる", text: "みんなで診断すると、全員のおすすめに出てこない分野がわかります。" },
] as const;

// 試作で調べた1人（スクショ17本）のおすすめに出てきた話題の数
const EXAMPLE_TOPICS = 9;

export default function Home() {
  return (
    <PageShell back={false}>
      <MineLink />
      <HistoryLink />

      <section className="pt-6 text-center sm:pt-10">
        <h1 className="text-[34px] font-bold leading-[1.2] tracking-tight sm:text-[56px] sm:leading-[1.1]">
          {/* 言葉の途中で折り返さないよう、まとまりごとに1つの箱にする */}
          <span className="inline-block">あなたの YouTube の</span>
          <span className="inline-block">おすすめ、</span>
          <span className="inline-block">かたよっていませんか？</span>
        </h1>
        <p className="phrase mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-muted sm:text-[19px]">
          YouTube のおすすめは、あなたが見た動画をもとに選ばれます。そのため、気づかないうちに同じような動画ばかりが出てくるようになります。このサービスでは、あなたのおすすめがどれくらいかたよっているかを調べます。
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <Link
            href="/diagnose/swipe"
            className="btn inline-flex h-[52px] items-center rounded-full bg-accent px-9 text-[17px] font-semibold text-accent-ink transition hover:brightness-110"
          >
            診断をはじめる
          </Link>
          <SampleLink />
        </div>
        <p className="mt-4 text-sm text-muted">カードの質問に答えるだけで、登録はいりません。答えるほど、結果が正確になります。</p>
      </section>

      <figure className="mx-auto mt-16 max-w-md text-center">
        <TopicBubble lit={EXAMPLE_TOPICS} />
        <figcaption className="phrase mt-6 text-[15px] leading-relaxed text-muted">
          点の1つ1つが、ゲームや料理、ニュースのような動画の話題です。全部で{TOPICS.length}あります。試作で調べた1人のおすすめには、このうち
          <span className="font-semibold text-foreground">{EXAMPLE_TOPICS}つ</span>
          の話題しか出てきませんでした。
        </figcaption>
      </figure>

      <section className="mt-20">
        <h2 className="text-center text-[28px] font-bold tracking-tight">わかること</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-(--r-card) bg-surface p-6">
              <h3 className="text-[17px] font-semibold">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-center text-[28px] font-bold tracking-tight">ほかの調べ方</h2>
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-(--r-card) bg-surface">
          {METHODS.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-11 items-center gap-4 px-5 py-4 transition hover:bg-background">
                <Icon size={20} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{text}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 text-center">
        <Link href="/about" className="inline-flex min-h-11 items-center gap-0.5 text-[15px] text-accent hover:underline">
          しくみを見る（何を調べているか、AI をどこで使っているか）
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </PageShell>
  );
}
