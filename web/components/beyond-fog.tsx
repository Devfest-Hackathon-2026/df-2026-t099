"use client";

import { useEffect, useState } from "react";
import { removeOutside, saveOutside } from "@/lib/diagnosis-store";
import { toast } from "@/lib/toast";
import { SeenButton, useCameBack } from "@/components/outside-step";
import { ArrowUpRight, Play } from "lucide-react";
import { CENTERS } from "@/components/ocean-map";
import { GENRES, type GenreId, genreOf } from "@/lib/genres";
import { topicsOf } from "@/lib/topics";

// 見たことのない話題を1本見てみる：おすすめに出てこない話題を、近い・少し遠い・いちばん遠いの3つ出す。
// 話題ごとに、YouTube Data API で見つけた本物の動画を1本出す（押すとすぐ見られる）。
// 動画が見つからないとき（API キーがない、枠を使い切ったなど）は、YouTube の検索結果を開くリンクにする。
type Suggestion = { videoId: string; title: string; channel: string; thumbnail: string };

type Step = { level: string; note: string; topic: { id: string; label: string; genre: GenreId } };

const dist = (a: GenreId, b: GenreId) => Math.hypot(CENTERS[a][0] - CENTERS[b][0], CENTERS[a][1] - CENTERS[b][1]);

function pickSteps(shownTopics: Set<string>, topGenre: GenreId): Step[] {
  const shownGenres = new Set([...shownTopics].map((t) => t.split(".")[0] as GenreId));
  const fogTopics = (g: GenreId) => topicsOf(g).filter((t) => !shownTopics.has(t.id));
  const steps: Step[] = [];

  const near = fogTopics(topGenre)[0];
  const top = genreOf(topGenre).label;
  if (near) steps.push({ level: "近い", note: `いちばんよく見る「${top}」の中で、まだおすすめに出てこない話題`, topic: near });

  const fogGenres = GENRES.filter((g) => g.id !== "other" && !shownGenres.has(g.id)).sort(
    (a, b) => dist(a.id, topGenre) - dist(b.id, topGenre),
  );
  const middle = fogGenres[Math.floor(fogGenres.length / 3)] ?? fogGenres[0];
  const far = fogGenres[fogGenres.length - 1];
  if (middle) steps.push({ level: "少し遠い", note: `地図の上で「${top}」から少し離れた、まだおすすめに出てこないジャンル`, topic: fogTopics(middle.id)[0] });
  if (far && far.id !== middle?.id) steps.push({ level: "いちばん遠い", note: `地図の上で「${top}」からいちばん離れた、まだおすすめに出てこないジャンル`, topic: fogTopics(far.id)[0] });
  return steps.filter((s) => s.topic);
}

export function BeyondFog({
  shownTopics,
  topGenre,
  outside = [],
  onOpen,
}: {
  shownTopics: string[];
  topGenre: GenreId;
  // 外へ出た話題（「見た」を押した話題）
  outside?: string[];
  // 動画を開いたとき（わたしの記録に「外へ出た話題」として残す）
  onOpen?: (topic: string) => void;
}) {
  // 動画を開いたら「見た」を出す。押すと、上の地図に話題が加わる
  const [opened, setOpened] = useState<Set<string>>(() => new Set(outside));
  const cameBack = useCameBack([...opened].some((t) => !outside.includes(t)));
  function toggleSeen(topic: string, label: string) {
    if (outside.includes(topic)) {
      removeOutside(topic);
      return;
    }
    const v = videos[topic];
    saveOutside({ topic, videoId: v?.videoId, title: v?.title });
    toast(`「${label}」を地図に加えました。外へ出た話題：${outside.length + 1}つ`);
  }
  const steps = pickSteps(new Set(shownTopics), topGenre);
  const [videos, setVideos] = useState<Record<string, Suggestion | null>>({});
  const ids = steps.map((s) => s.topic.id).join(",");

  useEffect(() => {
    if (!ids) return;
    let stopped = false;
    fetch(`/api/suggest?topics=${ids}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ items: Record<string, Suggestion | null> }>) : Promise.reject()))
      .then((d) => !stopped && setVideos(d.items))
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, [ids]);
  return (
    <section className="rounded-(--r-card) bg-surface p-6 sm:p-7">
      <h2 className="text-2xl font-bold">見たことのない話題を1本見てみる</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        おすすめに出てこない話題を、3つ選びました。地図の上で、あなたがいちばんよく見るジャンルに近いものから順に並べています。どれか1本見るだけでも、おすすめは少しずつ変わります。見たら「見た」を押すと、上の地図に話題が加わります。
      </p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.topic.id} className="flex flex-col gap-2">
            <a
              onClick={() => {
                setOpened((o) => new Set([...o, s.topic.id]));
                onOpen?.(s.topic.id);
              }}
              href={
                videos[s.topic.id]
                  ? `https://www.youtube.com/watch?v=${videos[s.topic.id]!.videoId}`
                  : `https://www.youtube.com/results?search_query=${encodeURIComponent(s.topic.label)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-1 flex-col rounded-(--r-inner) bg-surface-2 p-4 transition hover:brightness-125 ${outside.includes(s.topic.id) ? "ring-2 ring-accent/60" : ""}`}
            >
              <span className="text-xs font-bold text-muted">{s.level}</span>
              <span className="mt-1 text-lg font-bold" style={{ color: genreOf(s.topic.genre).color }}>
                {s.topic.label}
              </span>
              <span className="mt-1 flex-1 text-xs leading-relaxed text-muted">{s.note}</span>
              {videos[s.topic.id] ? (
                <>
                  {/* YouTube のサムネイル（外の画像なので、そのまま読む） */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={videos[s.topic.id]!.thumbnail} alt="" className="mt-3 aspect-video w-full rounded-(--r-inner) object-cover" loading="lazy" />
                  <span className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{videos[s.topic.id]!.title}</span>
                  <span className="mt-0.5 text-xs text-muted">{videos[s.topic.id]!.channel}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                    <Play size={14} aria-hidden />
                    YouTube で見る
                  </span>
                </>
              ) : (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
                  YouTube で検索する
                  <ArrowUpRight size={14} aria-hidden />
                </span>
              )}
            </a>
            {(opened.has(s.topic.id) || outside.includes(s.topic.id)) && (
              <SeenButton
                tone="light"
                done={outside.includes(s.topic.id)}
                nudge={cameBack}
                label={s.topic.label}
                onPress={() => toggleSeen(s.topic.id, s.topic.label)}
              />
            )}
          </li>
        ))}
      </ol>

    </section>
  );
}
