import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { tooMany } from "@/lib/rate-limit";
import { classifyVideos } from "@/lib/gemini";

const MAX_URLS = 30;

function isYouTubeUrl(raw: string) {
  try {
    const host = new URL(raw).hostname.replace(/^www\.|^m\./, "");
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

// YouTube の公開の oEmbed で題名とチャンネル名を取る（API キー不要）
// 1本が見つからなかったり、通信に失敗したりしても、ほかの動画は続けて調べる
async function lookup(url: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    return data.title ? { title: data.title, channel: data.author_name } : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as { urls?: string[] };
  const urls = [...new Set((body.urls ?? []).map((u) => u.trim()).filter(isYouTubeUrl))];

  if (urls.length === 0) {
    return Response.json({ error: "YouTube の URL がありません" }, { status: 400 });
  }
  if (urls.length > MAX_URLS) {
    return Response.json({ error: `URL は${MAX_URLS}本までです` }, { status: 400 });
  }

  const found = (await Promise.all(urls.map(lookup))).filter((v) => v !== null);
  if (found.length === 0) {
    return Response.json({ error: "動画が見つかりませんでした" }, { status: 404 });
  }

  try {
    const videos = await classifyVideos(found);
    return Response.json({ videos, missing: urls.length - found.length });
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("classifyVideos failed", e);
    return Response.json({ error: "分類に失敗しました" }, { status: 502 });
  }
}
