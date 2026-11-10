import { matchPercent, type GenreCounts } from "@/lib/compare";
import { getGroupDoc, listGroupMembers } from "@/lib/db";
import { GENRES } from "@/lib/genres";

const MIN_MEMBERS = 3;

// グループ全体のバブル。誰が何を見ているかは返さず、まとめた数字だけを返す
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getGroupDoc(id);
  if (!group) return Response.json({ error: "グループが見つかりませんでした" }, { status: 404 });

  const members = await listGroupMembers(id);
  // 2人までだと、合計から1人ひとりの中身が分かってしまうので、3人そろうまで数字を出さない
  if (members.length < MIN_MEMBERS) {
    return Response.json({ name: group.name, n: members.length, counts: {}, topicCounts: {}, avgMatch: null, nobody: [], types: [] });
  }
  const counts: GenreCounts = {};
  const topicCounts: Record<string, number> = {};
  members.forEach((m) => {
    GENRES.forEach((g) => (counts[g.id] = (counts[g.id] ?? 0) + (m.counts[g.id] ?? 0)));
    Object.entries(m.topicCounts ?? {}).forEach(([t, n]) => (topicCounts[t] = (topicCounts[t] ?? 0) + n));
  });

  // メンバー同士のマッチ度の平均。高いほど、グループ全体が同じ世界を見ている
  const pairs: number[] = [];
  members.forEach((a, i) => members.slice(i + 1).forEach((b) => pairs.push(matchPercent(a.counts, b.counts))));
  const avgMatch = pairs.length ? Math.round(pairs.reduce((s, n) => s + n, 0) / pairs.length) : null;

  const nobody = GENRES.filter((g) => g.id !== "other" && !(counts[g.id] ?? 0)).map((g) => g.label);
  const types = [...new Set(members.map((m) => m.type))];

  return Response.json({ name: group.name, n: members.length, counts, topicCounts, avgMatch, nobody, types });
}
