import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { tooMany } from "@/lib/rate-limit";
import { classifyVideos } from "@/lib/gemini";

const MAX_VIDEOS = 150;

// 題名とチャンネル名のリストにジャンルを付けて返す（Takeout から使う）
export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as { videos?: { title: string; channel?: string }[] };
  // 題名とチャンネル名は長さを切ってから Gemini に渡す（長い文字列で費用が膨らまないように）
  const videos = (body.videos ?? [])
    .filter((v) => typeof v.title === "string" && v.title.trim())
    .map((v) => ({ title: v.title.slice(0, 200), channel: typeof v.channel === "string" ? v.channel.slice(0, 100) : undefined }));

  if (videos.length === 0) {
    return Response.json({ error: "動画がありません" }, { status: 400 });
  }
  if (videos.length > MAX_VIDEOS) {
    return Response.json({ error: `一度に${MAX_VIDEOS}本までです` }, { status: 400 });
  }

  try {
    return Response.json({ videos: await classifyVideos(videos) });
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("classifyVideos failed", e);
    return Response.json({ error: "分類に失敗しました" }, { status: 502 });
  }
}
