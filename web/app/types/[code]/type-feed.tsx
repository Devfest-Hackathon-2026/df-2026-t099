"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorText } from "@/components/page-shell";
import { genreOf, type Video } from "@/lib/genres";

// YouTube のホーム画面に似せて、AI が作った架空の動画を並べる。サムネはジャンルの色で代わりにする
export function TypeFeed({ code }: { code: string }) {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/type-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((res) => res.json() as Promise<{ videos?: Video[]; error?: string }>)
      .then((data) => {
        if (cancelled) return;
        if (data.videos) setVideos(data.videos);
        else setError(data.error ?? "ホーム画面の例を作れませんでした");
      })
      .catch(() => !cancelled && setError("ホーム画面の例を作れませんでした"));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!videos) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 size={18} className="animate-spin" aria-hidden />
        ホーム画面の例を作っています
      </p>
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {videos.map((v, i) => {
        const genre = genreOf(v.genre);
        return (
          <li key={i}>
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(v.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <span
                className="flex aspect-video items-end rounded-xl p-3 text-xs text-white"
                style={{ background: `linear-gradient(160deg, ${genre.color}, #111)` }}
              >
                {genre.label}
              </span>
              <span className="mt-2 block font-bold leading-snug group-hover:underline">
                {v.title}
              </span>
              {v.channel && <span className="mt-1 block text-sm text-muted">{v.channel}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
