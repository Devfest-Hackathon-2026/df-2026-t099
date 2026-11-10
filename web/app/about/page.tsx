import { Card, PageShell, SectionTitle } from "@/components/page-shell";
import { TOPICS } from "@/lib/topics";

// しくみの説明。利用者と審査員が「何を測っていて、どこで Google の技術を使っているか」を読める
const GEMINI_USES = [
  {
    where: "外への5本（いつものおすすめには出てこない動画）",
    model: "Gemini 3.5 Flash（Vertex AI）＋ YouTube Data API",
    why: "おすすめに出てこない話題は100を超えます。その中から、好きな話題とつながりがあって見てみたくなる話題を選ぶことは、決まったルールではできないので AI を使います。選んだ理由を一言添え、落ち着いて楽しめる動画が見つかる検索の言葉も考えさせます。動画は YouTube Data API で探し、安全の設定を強くして、あおる題名の動画は除きます。",
  },
  {
    where: "スクリーンショットの読み取り",
    model: "Gemini 3.5 Flash（Vertex AI）",
    why: "YouTube の画面には、題名・チャンネル名・広告・ボタンが混ざっています。決まったルールでは動画だけを拾えないので、画像をそのまま読めるモデルを使います。",
  },
  {
    where: "動画を話題に分ける",
    model: "Gemini 3.1 Flash-Lite（Vertex AI）",
    why: `題名とチャンネル名だけから、${TOPICS.length} の話題のどれに当たるかと、何語の動画かを決めます。日本語・英語・韓国語などが混ざっていても、同じ基準で分けられます。数が多いので、安くて速いモデルにしています。`,
  },
  {
    where: "YouTube に見えていそうなあなた",
    model: "Gemini 3.5 Flash（Vertex AI）",
    why: "おすすめに出てくる動画（カードでは「出てくる」と答えた動画）の題名から、YouTube に何歳の・どんな人だと見えていそうかを想像します。YouTube が実際にどう思っているかではありません。決まったルールでは、題名の組み合わせから人物像を想像できないので、AI を使います。題名は保存しません。",
  },
  {
    where: "カードの動画と、見方のタイプ別のホーム画面の例",
    model: "Gemini 3.1 Flash-Lite（Vertex AI）",
    why: "話題ごと・タイプごとに「ありそうな動画」の題名を作ります。一度作った題名は Firestore に保存して使い回すので、使う人が増えても呼び出しは増えません。",
  },
  {
    where: "カードのサムネ画像",
    model: "Gemini の画像モデル（Gemini 3.1 Flash-Lite Image ほか・Vertex AI）",
    why: "題名だけでは動画を思い浮かべにくいので、話題ごとに1枚、サムネ風の画像を作りました。作ったのは開発のときの1回だけで、アプリを使うたびには作りません。日本語の文字は画像モデルだと崩れるので、題名から抜き出した一言を画面の側で重ねています。",
  },
];

const STACK = [
  ["Cloud Run", "アプリ本体（Next.js）。使われていないときは0台になり、費用がかからない"],
  ["Vertex AI", "Gemini の呼び出し。API キーを使わず、実行用のサービスアカウントで認証"],
  ["Firestore", "保存した結果（話題ごとの本数、見方のタイプ、選んだ年代と地域だけ）と、作ったカードの題名"],
  ["YouTube Data API", "おすすめに出てこない話題の、実際の YouTube の動画を探す"],
  ["Secret Manager", "試作のあいだの合言葉と、YouTube Data API のキー"],
  ["Cloud Billing の予算＋Pub/Sub＋Cloud Run functions", "使った金額が予算の 70% で AI だけを止め、90% で課金を止める"],
];

export default function AboutPage() {
  return (
    <PageShell
      title="バブル診断のしくみ"
      lead="何を測っているのか、どこで Google の技術を使っているのか、データをどう扱っているのかをまとめました。"
    >
      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>何を測っているか</SectionTitle>
          <div className="mt-3 flex flex-col gap-3 text-[15px] leading-[1.9] text-muted">
            <p>
              YouTube の動画を {TOPICS.length} の話題に分け、おすすめに出てくる動画がどの話題にどれくらいあるかから、次の4つの数を出します。
              自分のおすすめを正確に知るには、どれか1つではなく、4つを合わせて見ることが大事です。
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {[
                ["重みつきの話題の数", "よく出てくる話題ほど重く数えた話題の数で、話題ごとの割合のばらつき（エントロピー）から出します。人が見られる量には限りがあるので、ふつうは小さくなります。"],
                ["多い3つの話題が占める割合", "いちばんよく出てくる3つの話題が、おすすめに占める割合。どれだけ一部の話題に集まっているかが分かります。"],
                ["かたよりの少なさ", `話題ごとの割合と 1 / ${TOPICS.length} の小さいほうを、すべての話題で足したもの。すべての話題が同じだけ出てくると100%になります。`],
                ["一度でも出てくる話題の割合", `${TOPICS.length} の話題のうち、一度でもおすすめに出てくることがある話題の割合。どこまで広く出てくるかが分かりますが、たまに1本出てくるだけの話題も、よく出てくる話題と同じ1つに数えます。`],
              ].map(([k, v]) => (
                <li key={k} className="rounded-(--r-inner) bg-surface-2 p-4">
                  <span className="font-bold text-foreground">{k}</span>
                  <span className="mt-1 block leading-relaxed">{v}</span>
                </li>
              ))}
            </ul>
            <p>
              カードの答えには目安を付けています（よく＝ほぼ毎日、たまに＝週に1〜2本、出てこない＝ほとんど見かけない）。
              「よく」「たまに」のような言葉から思い浮かべる回数は、人によって大きく違うためです。
              数えるときは、目安を1週間の本数に直して重みにしています（よく＝7本、たまに＝1.5本）。この重みが実際に合っているかは、私たちの視聴履歴でこれから確かめます。
              {TOPICS.length} の話題をすべて聞くと時間がかかるので、答えがまだはっきりしないジャンルを多めに聞き、まだ聞いていない話題は、同じジャンルの答えから推定します。
              一度でも出てくる話題の割合には確かさの幅（およそ95%の範囲）を付けていて、答えるほど幅が狭くなります。
            </p>
            <p>
              これは「世界中の動画の何%を見たか」ではなく、話題のかたよりを表す目安です。話題の分け方は、いまは試作用に私たちが決めたものです。
            </p>
          </div>
        </Card>

        <Card>
          <SectionTitle note="決まったルールでは難しいところにだけ使っています">Gemini をどこで使っているか</SectionTitle>
          <ul className="mt-4 flex flex-col gap-3">
            {GEMINI_USES.map((u) => (
              <li key={u.where} className="rounded-(--r-inner) bg-surface-2 p-4">
                <p className="font-bold">{u.where}</p>
                <p className="mt-0.5 text-xs text-accent">{u.model}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{u.why}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Google Cloud の構成</SectionTitle>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[14rem_1fr]">
            {STACK.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <SectionTitle>データの扱い</SectionTitle>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-muted">
            <li>スクリーンショットの画像と視聴履歴のファイルは、読み取りに使うだけで保存しません。視聴履歴のファイルはこの端末の中で読み、題名とチャンネル名だけを送ります。</li>
            <li>診断の結果は、開いているタブの中にだけ置きます。「保存して比べる」を押したときだけ、話題ごとの本数、見方のタイプ、選んだ年代と地域を保存します。動画の題名は保存しません。</li>
            <li>友だちに送る招待リンクは、あなたの結果を開くリンクとは別のものです。招待リンクからは、あなたの年代や地域は分かりません。</li>
            <li>前回と比べるために、結果の割合だけをこの端末に残します。</li>
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
