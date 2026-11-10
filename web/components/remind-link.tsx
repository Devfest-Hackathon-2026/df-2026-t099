"use client";

import { useSyncExternalStore } from "react";
import { CalendarPlus } from "lucide-react";
import { calendarLink } from "@/lib/history";

const noop = () => () => {};

// 1週間後にもう一度調べる予定を、Google カレンダーに入れる。結果の画面と、わたしの記録の画面の両方で同じものを使う
export function RemindLink({ className = "" }: { className?: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  if (!origin) return null;
  return (
    <a
      href={calendarLink(origin)}
      target="_blank"
      rel="noopener noreferrer"
      title="Google カレンダーが開きます。入れるかは、カレンダーの画面で決められます"
      className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-5 py-2 text-left text-sm font-bold ${className}`}
    >
      <CalendarPlus size={16} aria-hidden />
      1週間後の予定をカレンダーに入れる
    </a>
  );
}
