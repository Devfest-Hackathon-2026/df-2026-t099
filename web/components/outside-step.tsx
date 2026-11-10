"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// 外へ出た1歩（おすすめに出てこない話題の動画を見て「見た」を押す）で使う部品

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 数字が変わったとき、前の数から数え直し、止まったら緑に光る
export function Ticker({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    let raf = 0;
    const ms = reduced() ? 0 : 750;
    const start = performance.now();
    const tick = (t: number) => {
      const p = ms ? Math.max(0, Math.min(1, (t - start) / ms)) : 1;
      setShown(from + (value - from) * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setFlash((f) => f + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span key={flash} className={`num inline-block ${flash ? "ob-flash" : ""} ${className}`}>
      {Math.round(shown)}
    </span>
  );
}

// 「見た」ボタン。押すと話題が地図に加わる。もう一度押すと取り消す
export function SeenButton({
  done,
  nudge = false,
  label,
  onPress,
  tone = "dark",
}: {
  done: boolean;
  // YouTube から戻ってきたとき、押せることに気づけるように光らせる
  nudge?: boolean;
  // 読み上げ用：どの話題か
  label: string;
  onPress: () => void;
  tone?: "dark" | "light";
}) {
  const base = "inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-full px-4 text-sm font-bold transition active:scale-95";
  const look = done
    ? tone === "dark"
      ? "bg-[#7ff0dd] text-[#06231f]"
      : "bg-accent/15 text-accent"
    : tone === "dark"
      ? "bg-white text-[#1f0a24]"
      : "bg-accent text-accent-ink";
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={done}
      aria-label={done ? `「${label}」を地図から外す` : `「${label}」の動画を見たので、地図に加える`}
      className={`st-pop ${base} ${look} ${nudge && !done ? "ob-nudge" : ""}`}
    >
      {done && <Check size={16} strokeWidth={3} aria-hidden />}
      見た
    </button>
  );
}

// YouTube を開いて、この画面に戻ってきたかを知る（戻ってきたら「見た」を光らせる）
export function useCameBack(active: boolean) {
  const [back, setBack] = useState(false);
  useEffect(() => {
    if (!active) return;
    const on = () => document.visibilityState === "visible" && setBack(true);
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    return () => {
      document.removeEventListener("visibilitychange", on);
      window.removeEventListener("focus", on);
    };
  }, [active]);
  return back;
}
