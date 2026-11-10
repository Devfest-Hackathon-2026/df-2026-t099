import { createGroupDoc } from "@/lib/db";

// ゼミやサークルなどのグループを作る。名前だけを保存する
export async function POST(request: Request) {
  const { name } = (await request.json()) as { name?: string };
  const trimmed = (name ?? "").trim().slice(0, 40);
  if (!trimmed) return Response.json({ error: "グループの名前を入れてください" }, { status: 400 });
  return Response.json({ id: await createGroupDoc(trimmed) });
}
