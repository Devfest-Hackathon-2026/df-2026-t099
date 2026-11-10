import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { tooMany } from "@/lib/rate-limit";
import { readScreenshots } from "@/lib/gemini";

const MAX_IMAGES = 6;
const MAX_BYTES = 8 * 1024 * 1024;

// スクショは Gemini に渡すだけで、保存しない
export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const form = await request.formData();
  const files = form.getAll("images").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return Response.json({ error: "画像がありません" }, { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return Response.json({ error: `画像は${MAX_IMAGES}枚までです` }, { status: 400 });
  }
  if (files.some((f) => !f.type.startsWith("image/") || f.size > MAX_BYTES)) {
    return Response.json({ error: "8MB までの画像だけ読めます" }, { status: 400 });
  }

  const images = await Promise.all(
    files.map(async (f) => ({
      data: Buffer.from(await f.arrayBuffer()).toString("base64"),
      mimeType: f.type,
    })),
  );

  try {
    const videos = await readScreenshots(images);
    return Response.json({ videos });
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("readScreenshots failed", e);
    return Response.json({ error: "読み取りに失敗しました" }, { status: 502 });
  }
}
