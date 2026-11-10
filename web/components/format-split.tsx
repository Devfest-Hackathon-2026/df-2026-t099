import { metricsFromVideos } from "@/lib/feed-metrics";
import type { Video } from "@/lib/genres";
import { topicLabel } from "@/lib/topics";

// スクショで読んだとき、ショートとふつうの動画を分けて数える。
// ショートは雑多な話題が流れてきて広く見えるが、ふつうの動画（長く見るもの）には「本命」が出やすい。
// 本人の気づき（11/6「ショートに流れてるけど、メインのメインが出てきてる」）から。
// ホーム画面はふつうの動画が1画面に1〜2本しか写らない。本命のチャンネルが写りきらないと、話題の数は少なく出る
// （11/6 じゅんぺいの6枚：ふつうの動画5本で「実質2話題」。本人がよく見るチャンネルは5つ以上あった）
const FEW = 10;

export function FormatSplit({ videos }: { videos: Video[] }) {
  const long = videos.filter((v) => v.format === "long");
  const short = videos.filter((v) => v.format === "short");
  if (long.length < 2 || short.length < 2) return null;
  const lm = metricsFromVideos(long);
  const sm = metricsFromVideos(short);
  const main = lm.top3Topics.slice(0, 2).map(topicLabel);

  return (
    <section className="mt-6 rounded-(--r-card) bg-surface p-5">
      <p className="text-xs font-bold tracking-wider text-muted">ショートとふつうの動画を分けて数えると</p>
      <p className="mt-2 text-lg font-bold leading-snug">
        ふつうの動画は、約 <span className="num">{lm.effective}</span> 種類の話題だけでした
        {main.length > 0 && <>（「{main.join("」「")}」）</>}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-(--r-inner) bg-surface-2 p-3">
          <p className="text-xs text-muted">ふつうの動画（{long.length}本）</p>
          <p className="num mt-1 text-2xl font-bold">
            {lm.effective}
            <span className="ml-1 text-xs font-normal text-muted">種類</span>
          </p>
        </div>
        <div className="rounded-(--r-inner) bg-surface-2 p-3">
          <p className="text-xs text-muted">ショート（{short.length}本）</p>
          <p className="num mt-1 text-2xl font-bold">
            {sm.effective}
            <span className="ml-1 text-xs font-normal text-muted">種類</span>
          </p>
        </div>
      </div>
      {long.length < FEW && (
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed">
          ふつうの動画は {long.length} 本しか写っていないので、実際より少なく出ている可能性があります。ホーム画面をもう少し下までスクロールして撮り足すと、結果が確かになります。
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        ショートにはいろいろな話題が出てくるので、広く見ているように感じます。けれど、時間をかけて見るふつうの動画には、YouTube があなたのいちばんの好みだと考えている話題が出やすいです。
      </p>
    </section>
  );
}
