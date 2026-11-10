"use client";

import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
import { useHistory } from "@/lib/history";

// 前に診断したことがあるときだけ、トップに「わたしの記録」への入口を出す
export function HistoryLink() {
  const count = useHistory().filter((h) => h.source !== "sample").length;
  if (count === 0) return null;
  return (
    <Link
      href="/history"
      className="mb-6 flex items-center gap-3 rounded-(--r-card) bg-surface px-5 py-4 text-sm font-bold transition hover:bg-surface-2"
    >
      <History size={18} className="shrink-0 text-accent" aria-hidden />
      <span className="flex-1">わたしの記録を見る（{count}回）</span>
      <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
