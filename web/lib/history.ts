"use client";

import { useSyncExternalStore } from "react";
import type { Diagnosis, DiagnosisSource } from "./genres";
import { topicSplit, type FeedMetrics } from "./feed-metrics";
import { countTopics } from "./bubble-metrics";
import { shownVideos } from "./exposure";

// わたしの記録：これまでの診断を、この端末（localStorage）にだけ残す。
// 残すのは日付・出てくる話題の数・かたよりの少なさ・話題の名前（出てくる話題、多い3つ、外へ出た話題）だけで、動画の題名は残さない。
// ログインして別の端末でも続けられるようにするときは、この中の読み書き（readAll と write）を Firestore に置きかえる
export type HistoryEntry = {
  // 最初に答えた時刻。「続けて答える」で答えを足しても、同じ id のまま上書きする
  id: string;
  // 最後に答えた時刻
  at: string;
  source: DiagnosisSource;
  kinds: number;
  attention: number;
  // おすすめに出てくる話題
  topics: string[];
  // 多い3つの話題
  top?: string[];
  // 結果の画面から開いた、おすすめに出てこない話題（外へ出た話題）
  outside?: string[];
};

// 前の版（前回との比較だけ）と同じ場所に置く。前の版の記録には id がないので、時刻を id にする
// v3：主役の数を「出てくる話題の数（149 のうち）」にした。前の版（重みつきの種類の数）とは比べられないので、別の場所に残す
const KEY = "bubble-history-v3";
const MAX = 30;

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
const notify = () => listeners.forEach((l) => l());

// useSyncExternalStore は同じ中身なら同じ配列を返す必要があるので、文字列ごとに覚えておく
let cachedRaw: string | null = null;
let cached: HistoryEntry[] = [];
const EMPTY: HistoryEntry[] = [];

function readAll(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const list = raw ? (JSON.parse(raw) as Partial<HistoryEntry>[]) : [];
      cached = list
        .filter((h): h is Partial<HistoryEntry> & { at: string } => typeof h?.at === "string")
        .map((h) => ({
          id: h.id ?? h.at,
          at: h.at,
          source: h.source ?? "swipe",
          kinds: h.kinds ?? 0,
          attention: h.attention ?? 0,
          topics: h.topics ?? [],
          top: h.top,
          outside: h.outside,
        }))
        .sort((a, b) => a.at.localeCompare(b.at));
    }
    return cached;
  } catch {
    return EMPTY;
  }
}

function write(list: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {}
  notify();
}

export function useHistory() {
  return useSyncExternalStore(subscribe, readAll, () => EMPTY);
}

export const historyId = (d: Diagnosis) => d.continues ?? d.createdAt;

// 結果の画面とスライドで、同じ数字を記録・比較に使う
export function snapshotOf(d: Diagnosis, fm: FeedMetrics): HistoryEntry {
  return {
    id: historyId(d),
    at: d.createdAt,
    source: d.source,
    kinds: topicSplit(fm).shown,
    attention: fm.attention,
    topics: Object.keys(countTopics(shownVideos(d.videos))),
    top: fm.top3Topics.filter((t) => !t.startsWith("other")).slice(0, 3),
  };
}

// 例の結果（サンプル）は自分の記録ではないので残さない
export function recordEntry(entry: HistoryEntry) {
  if (entry.source === "sample") return;
  const list = readAll();
  const old = list.find((h) => h.id === entry.id);
  if (old && old.at === entry.at && old.kinds === entry.kinds && old.attention === entry.attention) return;
  write([...list.filter((h) => h.id !== entry.id), { ...entry, outside: old?.outside }].sort((a, b) => a.at.localeCompare(b.at)));
}

// おすすめに出てこない話題の動画を開いたら、その回の記録に「外へ出た話題」として足す
export function markOutside(id: string, topics: string[]) {
  const list = readAll();
  const entry = list.find((h) => h.id === id);
  if (!entry) return;
  const outside = [...new Set([...(entry.outside ?? []), ...topics])];
  if (outside.length === (entry.outside ?? []).length) return;
  write(list.map((h) => (h.id === id ? { ...h, outside } : h)));
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  notify();
}

// 調べ方が違うと数え方も違うので、同じ調べ方の前回とだけ比べる
export function previousOf(list: HistoryEntry[], current: Pick<HistoryEntry, "id" | "at" | "source">) {
  return list.filter((h) => h.id !== current.id && h.source === current.source && h.at < current.at).at(-1) ?? null;
}

export type Change = {
  previous: HistoryEntry;
  // 出てくる話題の数の差（正なら広がった）
  diff: number;
  // 前回は出てこなかったのに、今回出てくる話題
  added: string[];
  // 前回、外へ出た話題のうち、今回おすすめに出てくるようになった話題
  reached: string[];
};

export function changeFrom(previous: HistoryEntry | null, current: Pick<HistoryEntry, "kinds" | "topics">): Change | null {
  if (!previous) return null;
  const before = new Set(previous.topics);
  const added = current.topics.filter((t) => !before.has(t));
  const reached = (previous.outside ?? []).filter((t) => current.topics.includes(t) && !before.has(t));
  return { previous, diff: current.kinds - previous.kinds, added, reached };
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });

// 1週間後の夜8時に、もう一度調べる予定を Google カレンダーに入れるリンク（入れるかは本人がカレンダーの画面で決める）
export function calendarLink(origin: string) {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setHours(20, 0, 0, 0);
  const end = new Date(start.getTime() + 15 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: "YouTube のおすすめを、もう一度調べる",
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `前回と比べて、おすすめの話題が広がったかを確かめます。前回と同じ端末・同じブラウザで開いてください（記録はその端末にだけ残っています）。\n${origin}/history`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
