import { getDiagnosisDoc, listDiagnosisDocs } from "@/lib/db";
import { buildInsights } from "@/lib/insights";
import { tooMany } from "@/lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = tooMany(request, "api");
  if (limited) return limited;
  const { id } = await params;
  const me = await getDiagnosisDoc(id);
  if (!me) return Response.json({ error: "診断が見つかりません" }, { status: 404 });
  return Response.json(buildInsights(me, await listDiagnosisDocs()));
}
