import { saveShareDoc } from "@/lib/share-db";
import { toShareSummary } from "@/lib/share";
import { tooMany } from "@/lib/rate-limit";

// 最後のスライドで「リンクで共有する」を押したときだけ呼ばれる。
// まとめの数と話題の名前だけを保存し、共有用の id を返す（本人用・招待用の id とはつながない）
export async function POST(request: Request) {
  const limited = tooMany(request, "api");
  if (limited) return limited;
  const summary = toShareSummary(await request.json().catch(() => null));
  if (!summary) return Response.json({ error: "共有する結果がありません" }, { status: 400 });
  const id = await saveShareDoc(summary);
  return Response.json({ id });
}
