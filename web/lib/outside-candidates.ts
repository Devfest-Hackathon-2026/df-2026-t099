import type { Suggestion } from "./youtube-types";

// 外の5本の候補から、探しても動画が無かった話題（"none"）を外す。外すと5つ未満になるなら外さない（Gemini が5つ選べるように）
export function usableCandidates(candidates: string[], known: Map<string, Suggestion | null | "none">) {
  const usable = candidates.filter((t) => known.get(t) !== "none");
  return usable.length >= 5 ? usable : candidates;
}

// Gemini に見せる、覚えている動画の題名（話題ごと、60字まで）
export function knownTitles(known: Map<string, Suggestion | null | "none">) {
  const titles: Record<string, string> = {};
  for (const [t, v] of known) if (v && v !== "none") titles[t] = v.title.slice(0, 60);
  return titles;
}

export type OutsidePick = { topic: string; reason: string; query: string };

// Gemini の返事から、候補にある話題だけを、重ねずに5つまで取り出す（理由と検索の言葉は40字まで）
export function cleanPicks(picks: Partial<OutsidePick>[] | undefined, candidates: string[]): OutsidePick[] {
  const seen = new Set<string>();
  return (picks ?? [])
    .filter((p): p is OutsidePick => typeof p.topic === "string" && typeof p.reason === "string" && typeof p.query === "string")
    .filter((p) => candidates.includes(p.topic) && !seen.has(p.topic) && seen.add(p.topic))
    .slice(0, 5)
    .map((p) => ({ topic: p.topic, reason: p.reason.trim().slice(0, 40), query: p.query.trim().slice(0, 40) }));
}
