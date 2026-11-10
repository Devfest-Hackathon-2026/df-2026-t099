import { getDiagnosisByInvite, listBatons } from "@/lib/db";
import { TOPICS } from "@/lib/topics";

// 渡す人の画面用。招待用の id からは、友だちの「霧の中の話題」の一覧だけを返す。
// 話題ごとの本数や型など、結果そのものは返さない（招待リンクから結果全体は読めない）
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiagnosisByInvite(id);
  if (!d) return Response.json({ error: "友だちの診断が見つかりませんでした" }, { status: 404 });
  const lit = new Set([
    ...Object.keys(d.topicCounts ?? {}),
    ...(await listBatons(d.id)).filter((b) => b.litAt).map((b) => b.topic),
  ]);
  const fog = TOPICS.filter((t) => t.genre !== "other" && !lit.has(t.id)).map((t) => t.id);
  return Response.json({ fog });
}
