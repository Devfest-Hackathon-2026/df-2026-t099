"use client";

import { useEffect, useState } from "react";

export type Slide = { kicker: string; big: string; text: string; color: string };

const DURATION = 6000;

// Spotify の年末のまとめや、ストーリーのように見るスライド。
// 6秒で自動で進み、左側を押すと戻る、右側を押すと進む
export function RecapStory({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const last = slides.length - 1;

  useEffect(() => {
    if (paused || index >= last) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), DURATION);
    return () => clearTimeout(timer);
  }, [index, paused, last]);

  const slide = slides[index];

  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {slides.map((_, i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              key={`${i}-${index}`}
              className="block h-full rounded-full bg-accent"
              style={{
                width: i < index ? "100%" : i === index ? "100%" : "0%",
                transition: i === index && !paused && index < last ? `width ${DURATION}ms linear` : "none",
                animation: i === index && !paused && index < last ? `recap-fill ${DURATION}ms linear` : undefined,
              }}
            />
          </span>
        ))}
      </div>
      <style>{`@keyframes recap-fill { from { width: 0% } to { width: 100% } }`}</style>

      <div
        className="relative mt-3 flex aspect-[4/5] w-full select-none flex-col justify-between overflow-hidden rounded-(--r-tile) border border-line p-7 sm:aspect-video sm:p-9"
        style={{ background: `radial-gradient(120% 90% at 85% 0%, ${slide.color}55, transparent 60%), radial-gradient(90% 70% at 0% 100%, #0f3a6b, #06101d 70%)` }}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <span className="text-sm font-bold text-muted">{slide.kicker}</span>
        <span>
          <span className="num block text-[56px] font-bold leading-[1.1] sm:text-7xl" style={{ color: slide.color === "#ff9f0a" ? "#ff9f0a" : "#eaf0f8" }}>
            {slide.big}
          </span>
          <span className="mt-5 block max-w-xl text-[15px] leading-[1.9] text-foreground/85">{slide.text}</span>
        </span>
        <span className="num text-xs text-muted">
          {index + 1} / {slides.length}
        </span>

        {/* 押す場所：左3分の1で戻る、残りで進む */}
        <button
          aria-label="前へ"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
        />
        <button
          aria-label="次へ"
          className="absolute inset-y-0 right-0 w-2/3"
          onClick={() => setIndex((i) => Math.min(i + 1, last))}
        />
      </div>
      <p className="mt-2 text-center text-xs text-muted">6秒ごとに次へ進みます。右側を押すと次へ、左側を押すと前に戻り、押しているあいだは止まります。</p>
    </div>
  );
}
