import { getDiagnosisByInvite } from "@/lib/db";

// 招待リンクの画面で、誘ってくれた人の型だけを見せる。id は招待用の鍵（本人用の id では引けない）
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getDiagnosisByInvite(id);
  if (!d) return Response.json({ error: "招待が見つかりませんでした" }, { status: 404 });
  return Response.json({ type: d.type, total: d.total });
}
