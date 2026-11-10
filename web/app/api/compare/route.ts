import { genreOverlap, matchPercent } from "@/lib/compare";
import { getDiagnosisByInvite } from "@/lib/db";

// 友だちとの比較。a は自分、b は誘ってくれた友だち。どちらも招待用の id で引く。
// 本人用の id は URL に出さないので、この画面の URL を人に見せても、まとめは開けない
export async function GET(request: Request) {
  const url = new URL(request.url);
  const [a, b] = await Promise.all([
    getDiagnosisByInvite(url.searchParams.get("a") ?? ""),
    getDiagnosisByInvite(url.searchParams.get("b") ?? ""),
  ]);
  if (!a || !b) return Response.json({ error: "診断が見つかりませんでした" }, { status: 404 });

  const overlap = genreOverlap(a.counts, b.counts);
  const sharedChannels = (a.channels ?? []).filter((c) => b.channels?.includes(c));
  // 話題（149）の単位でも比べる：2人とも見る話題、片方だけが見る話題（多く見る順）。古い保存には話題がない
  const ta = a.topicCounts ?? {};
  const tb = b.topicCounts ?? {};
  const byCount = (x: Record<string, number>) => (p: string, q: string) => (x[q] ?? 0) - (x[p] ?? 0);
  const topics =
    a.topicCounts && b.topicCounts
      ? {
          both: Object.keys(ta).filter((t) => tb[t]).sort((p, q) => (ta[q] ?? 0) + (tb[q] ?? 0) - (ta[p] ?? 0) - (tb[p] ?? 0)),
          onlyA: Object.keys(ta).filter((t) => !tb[t]).sort(byCount(ta)),
          onlyB: Object.keys(tb).filter((t) => !ta[t]).sort(byCount(tb)),
        }
      : null;
  return Response.json({
    a: { type: a.type, total: a.total },
    b: { type: b.type, total: b.total },
    match: matchPercent(a.counts, b.counts),
    both: overlap.both.map((g) => g.label),
    onlyA: overlap.onlyA.map((g) => g.label),
    onlyB: overlap.onlyB.map((g) => g.label),
    sharedChannels,
    channelsCompared: Boolean(a.channels && b.channels),
    topics,
  });
}
