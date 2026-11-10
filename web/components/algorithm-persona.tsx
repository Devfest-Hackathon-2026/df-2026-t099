"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Image as ImageIcon, Share2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { drawPersonaImage, shareImage } from "@/lib/persona-image";
import type { Video } from "@/lib/genres";

type Persona = { oneLiner: string; age?: number; guesses: { label: string; guess: string; because: string }[] };

// YouTube に見えていそうなあなた。並んだ動画から、YouTube にどんな人と見えていそうかを AI が想像する（YouTube が実際にどう思っているかではない）。
// 当たっていても外れていても笑えるので、人に見せたくなる。外れた所は「アルゴリズムの勘違い」として数える
// fromAnswers：スワイプの答えから推定するとき（題名はカードの例えで、本物のホーム画面ではない）
export function AlgorithmPersona({ videos, cacheKey, fromAnswers = false }: { videos: Video[]; cacheKey: string; fromAnswers?: boolean }) {
  const key = `persona:${cacheKey}`;
  // 同じ診断で2回目に開いたときは、前の推定をそのまま使う（Gemini を呼び直さない）
  const [persona, setPersona] = useState<Persona | null>(() => {
    try {
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
      return saved ? (JSON.parse(saved) as Persona) : null;
    } catch {
      return null;
    }
  });
  // 失敗したとき：AI を休ませているなら、その知らせを出す。ほかの失敗なら、この欄ごと出さない
  const [failed, setFailed] = useState<false | "paused" | "error">(false);
  const [verdicts, setVerdicts] = useState<Record<number, boolean>>({});
  const [realAge, setRealAge] = useState("");
  const [shared, setShared] = useState(false);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    if (persona) return;
    let cancelled = false;
    fetch("/api/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos: videos.slice(0, 40).map((v) => ({ title: v.title, topic: v.topic, frequency: v.frequency })),
      }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as Persona) : Promise.reject(await r.json().catch(() => ({})))))
      .then((p) => {
        if (cancelled) return;
        setPersona(p);
        try {
          sessionStorage.setItem(key, JSON.stringify(p));
        } catch {}
      })
      .catch((e: { paused?: boolean }) => !cancelled && setFailed(e?.paused ? "paused" : "error"));
    return () => {
      cancelled = true;
    };
    // 結果の画面を開いたときに1回だけ推定する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (failed === "error") return null;
  if (failed === "paused") {
    return (
      <section className="mt-6 rounded-(--r-card) bg-surface p-5 sm:p-7">
        <h2 className="text-lg font-bold">YouTube に見えていそうなあなた</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">いまは AI を休ませているため、この推定は出せません。時間をおいて開き直すと、出せることがあります。</p>
      </section>
    );
  }

  const age = Number(realAge);
  const gap = persona?.age && age >= 5 && age <= 100 ? persona.age - age : null;
  const answered = Object.keys(verdicts).length;
  const misses = Object.values(verdicts).filter((v) => !v).length;

  // ストーリーに貼れる縦長の画像にする（本当の年齢と、合っている・違うの数も入れる）
  async function shareAsImage() {
    if (!persona) return;
    setDrawing(true);
    const blob = await drawPersonaImage({
      oneLiner: persona.oneLiner,
      youtubeAge: persona.age,
      realAge: gap !== null ? age : undefined,
      hits: answered > 0 ? answered - misses : undefined,
      misses: answered > 0 ? misses : undefined,
    });
    await shareImage(blob, "youtube-sees-me.png");
    setDrawing(false);
  }

  async function share() {
    if (!persona) return;
    const parts = [`AI の想像だと、YouTube には私が「${persona.oneLiner}」に見えているらしい。`];
    if (gap !== null && gap !== 0) parts.push(`YouTube の中の私は、本当より${Math.abs(gap)}歳${gap > 0 ? "年上" : "年下"}。`);
    if (answered > 0) parts.push(`YouTube の勘違いは${misses}個。`);
    const text = parts.join("");
    const url = window.location.origin;
    if (navigator.share) {
      await navigator.share({ text, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
    setShared(true);
    toast("送る文とリンクをコピーしました。LINE などに貼って送れます。");
  }

  return (
    <section className="mt-6 rounded-(--r-card) bg-surface p-5 sm:p-7">
      <h2 className="text-lg font-bold">YouTube に見えていそうなあなた</h2>
      {!persona ? (
        <div aria-busy="true" className="mt-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" aria-hidden />
            {fromAnswers ? "あなたの答え" : "あなたのホーム画面の動画"}をもとに、YouTube にどんな人と見えていそうかを AI（Gemini）が想像しています（10秒ほどかかります）
          </p>
          {/* 答えが来るまで、出てくる形だけを灰色で見せる */}
          <span className="sk sk-line mt-4 h-7" aria-hidden />
          <span className="sk sk-line short h-7" aria-hidden />
          <span className="sk mt-5 h-24 rounded-(--r-inner)" aria-hidden />
          <span className="sk mt-2 h-24 rounded-(--r-inner)" aria-hidden />
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">{fromAnswers ? "あなたの答えから AI が想像すると、YouTube にはあなたが" : "ホーム画面の動画から AI が想像すると、YouTube にはあなたが"}</p>
          <p className="mt-1 text-2xl font-bold leading-snug sm:text-3xl">「{persona.oneLiner}」</p>
          <p className="mt-1 text-sm text-muted">に見えていそうです。YouTube が実際にどう思っているかではありません。</p>

          <label className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">あなたの本当の年齢</span>
            <input
              value={realAge}
              onChange={(e) => setRealAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              placeholder="20"
              className="h-11 w-20 rounded-xl bg-surface-2 px-4 text-foreground"
              aria-label="本当の年齢（保存しません）"
            />
            <span className="text-xs text-muted">入れると、YouTube が思う年齢と比べます。保存しません。</span>
          </label>
          {gap !== null && (
            <p className="mt-3 text-lg font-bold">
              {gap === 0 ? (
                "YouTube が思うあなたの年齢は、本当の年齢と同じです。"
              ) : (
                <>
                  YouTube が思うあなたは、本当より <span className="num text-accent">{Math.abs(gap)}</span> 歳{gap > 0 ? "年上" : "年下"}です。
                </>
              )}
            </p>
          )}

          <ul className="mt-5 grid gap-2">
            {persona.guesses.map((g, i) => (
              <li key={i} className="rounded-(--r-inner) bg-surface-2 p-4">
                <p className="text-xs font-bold text-muted">{g.label}</p>
                <p className="mt-1 leading-snug">{g.guess}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{g.because}</p>
                <div className="mt-3 flex gap-2" role="group" aria-label={`${g.label}は合っているか`}>
                  <button
                    onClick={() => setVerdicts((v) => ({ ...v, [i]: true }))}
                    aria-pressed={verdicts[i] === true}
                    className={`inline-flex h-11 items-center gap-1 rounded-full border px-4 text-sm font-bold ${verdicts[i] === true ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
                  >
                    <Check size={14} aria-hidden />
                    合っている
                  </button>
                  <button
                    onClick={() => setVerdicts((v) => ({ ...v, [i]: false }))}
                    aria-pressed={verdicts[i] === false}
                    className={`inline-flex h-11 items-center gap-1 rounded-full border px-4 text-sm font-bold ${verdicts[i] === false ? "border-foreground bg-foreground text-background" : "border-line"}`}
                  >
                    <X size={14} aria-hidden />
                    違う
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {answered > 0 && (
            <p className="mt-4 text-sm leading-relaxed">
              合っている {answered - misses} 個、違う {misses} 個。
              {misses > 0
                ? "違う所は、あなたが見ていないのに、YouTube が「こういう人だ」と決めている所です。おすすめは、その思い込みをもとに選ばれています。"
                : "YouTube は、あなたのことをかなり正しくとらえています。"}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={shareAsImage} disabled={drawing} className="btn inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-ink disabled:opacity-40">
              <ImageIcon size={16} aria-hidden />
              画像にして共有する
            </button>
            <button onClick={share} className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-5 font-bold">
              <Share2 size={16} aria-hidden />
              {shared ? "コピーしました" : "文で送る"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            推定は AI が動画の題名から行います。題名は保存しません。
            {fromAnswers && " スクリーンショットで調べると、実際のホーム画面から推定できます。"}
          </p>
        </>
      )}
    </section>
  );
}
