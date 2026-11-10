"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { genreOf, type GenreId, type Video } from "@/lib/genres";
import type { Audience } from "@/lib/insights";

// 話題の地図でジャンルを押したときに出す：そのジャンルをよく見る人たちと、そのジャンルばかり見る人のおすすめの例
export function IslandPanel({
  genre,
  mine,
  onClose,
}: {
  genre: GenreId;
  mine: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ audience: Audience; videos: Video[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const g = genreOf(genre);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/genre/${genre}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [genre]);

  return (
    <section className="mt-3 rounded-(--r-card) bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{mine > 0 ? `あなたのおすすめに出てくるジャンル（動画 ${mine} 本）` : "あなたのおすすめに出てこないジャンル"}</p>
          <h3 className="mt-1 text-xl font-bold" style={{ color: g.color }}>
            {g.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center text-muted hover:text-foreground"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {failed && <p className="mt-3 text-sm text-muted">このジャンルの情報を読み込めませんでした。</p>}
      {!data && !failed && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          読み込んでいます
        </p>
      )}
      {data && (
        <>
          <p className="mt-3 text-sm leading-relaxed">
            診断した人の <span className="font-bold">{data.audience.share}%</span>
            （{data.audience.n} 人）は、診断に使った動画の2割以上がこのジャンルです。
            {data.audience.ages.length > 0 &&
              ` 年代は ${data.audience.ages.map((a) => `${a.key} ${Math.round(a.share * 100)}%`).join("、")}。`}
            {data.audience.regions.length > 0 && ` 多い地域は ${data.audience.regions.map((r) => r.key).join("、")}。`}
          </p>
          {data.audience.sample && <p className="mt-1 text-xs text-muted">人数には、見本として作ったデータも含みます。</p>}
          {data.videos.length > 0 && (
            <>
              <p className="mt-4 text-sm font-bold">このジャンルばかり見る人のおすすめの例（AI が作った架空の題名です）</p>
              <ul className="mt-1 flex flex-col text-sm">
                {data.videos.map((v, i) => (
                  <li key={i}>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center hover:underline"
                    >
                      {v.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
