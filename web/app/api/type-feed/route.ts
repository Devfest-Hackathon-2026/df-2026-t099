import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { tooMany } from "@/lib/rate-limit";
import { describeType, isTypeCode, typeName } from "@/lib/bubble-type";
import { imagineFeed } from "@/lib/gemini";

export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const { code } = (await request.json()) as { code?: string };
  if (!code || !isTypeCode(code)) {
    return Response.json({ error: "型が正しくありません" }, { status: 400 });
  }
  const description = `${typeName(code)}（${describeType(code).join("・")}）`;
  try {
    return Response.json({ videos: await imagineFeed(code, description) });
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("imagineFeed failed", e);
    return Response.json({ error: "ホーム画面を作れませんでした" }, { status: 502 });
  }
}
