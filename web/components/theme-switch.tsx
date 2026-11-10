"use client";

import { useSyncExternalStore } from "react";

// 見た目の方式を切り替える（Apple の HIG ／ Google の Material 3）。選んだものは、この端末に覚える
export type Theme = "apple" | "material";
const KEY = "bubble-theme";
const EVENT = "bubble-theme-change";

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
const current = (): Theme => (document.documentElement.dataset.theme === "material" ? "material" : "apple");

// <html> に方式を付けて、覚えて、切り替えたことを知らせる
function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, current, () => "apple" as Theme);

  return (
    <div role="radiogroup" aria-label="見た目の方式" className="flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
      {(
        [
          ["apple", "Apple"],
          ["material", "Google"],
        ] as const
      ).map(([t, label]) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          onClick={() => applyTheme(t)}
          className={`min-h-[30px] rounded-full px-3 transition ${theme === t ? "bg-(--seg-on) text-foreground shadow-sm" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// 最初に描く前に、覚えている方式（または URL の ?theme=material）を <html> に付ける。
// 描いたあとに切り替えると、一瞬だけ別の見た目が見えてしまうため
export const THEME_BOOT = `try{var q=new URLSearchParams(location.search).get('theme');if(q==='material'||q==='apple')localStorage.setItem('${KEY}',q);var t=localStorage.getItem('${KEY}');if(t==='material'||t==='apple')document.documentElement.dataset.theme=t}catch(e){}`;
