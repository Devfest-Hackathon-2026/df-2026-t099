import { getDiagnosisDoc, lightBaton, listBatons } from "@/lib/db";

// 受け取った人の画面用。本人用の id でだけ引ける
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getDiagnosisDoc(id))) return Response.json({ error: "診断が見つかりませんでした" }, { status: 404 });
  return Response.json({ batons: await listBatons(id) });
}

// 「見た」を押したら灯す
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { batonId } = (await request.json().catch(() => ({}))) as { batonId?: string };
  if (!batonId || !(await lightBaton(id, batonId))) return Response.json({ error: "すすめられた動画が見つかりませんでした" }, { status: 404 });
  return Response.json({ batons: await listBatons(id) });
}
