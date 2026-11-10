import { exposureOf } from "@/lib/exposure";
import type { Video } from "@/lib/genres";

// カードで答えた動画を、サムネで並べ直す（「見る」「見ない」「出てこない」の3列）。
// 数字だけでなく、自分のおすすめに出てくる動画と出てこない動画を見比べて、かたよりに気づけるようにする
const rows = (who: string) =>
  [
    { key: "watched", label: `${who}が見る動画` },
    { key: "skipped", label: "おすすめに出てくるけれど、見ない動画" },
    { key: "unseen", label: `${who}のおすすめに出てこない動画` },
  ] as const;
const MAX = 12;

export function AnswerThumbs({ videos, who }: { videos: Video[]; who: string }) {
  const withThumb = videos.filter((v) => v.topic && !v.topic.startsWith("other"));
  return (
    <div className="mt-4 space-y-4">
      {rows(who).map(({ key, label }) => {
        const list = withThumb.filter((v) => exposureOf(v) === key);
        if (list.length === 0) return null;
        return (
          <div key={key}>
            <p className="text-sm font-bold">
              {label}
              <span className="num ml-2 font-normal text-muted">{list.length}本</span>
            </p>
            <ul className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
              {list.slice(0, MAX).map((v) => (
                <li key={v.topic} className="w-32 shrink-0 snap-start">
                  <div className={`relative aspect-video overflow-hidden rounded-md bg-surface-2 ${key === "unseen" ? "opacity-60 grayscale" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- 小さな静的画像なので、最適化の仕組みは通さない */}
                    <img
                      src={`/thumbs/${v.topic}.webp`}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">{v.title}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
