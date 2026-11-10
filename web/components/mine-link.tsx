"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { useMineId } from "@/lib/use-mine";

// 前に保存した自分のまとめへ戻る入口。友だちから届いたおすすめも、まとめの中で見られる
export function MineLink() {
  const mine = useMineId();
  if (!mine) return null;
  return (
    <Link
      href={`/me/${mine}`}
      className="mb-6 flex items-center gap-3 rounded-(--r-card) border border-accent/40 bg-accent/10 px-5 py-4 text-sm font-bold transition hover:bg-accent/15"
    >
      <Flame size={18} className="shrink-0 text-light" aria-hidden />
      前に保存した自分のまとめと、友だちのおすすめを見る
    </Link>
  );
}
