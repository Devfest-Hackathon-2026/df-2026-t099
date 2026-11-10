import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { addBaton, getDiagnosisByInvite, listBatons } from "@/lib/db";
import { classifyVideos } from "@/lib/gemini";
import { tooMany } from "@/lib/rate-limit";
import { topicLabel } from "@/lib/topics";

function isYouTubeUrl(raw: string) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    return u.protocol === "https:" && (host === "youtube.com" || host === "youtu.be");
  } catch {
    return false;
  }
}

// 友だちの霧の中の動画を1本渡す。動画の話題は Gemini が題名から決め、友だちがもう見ている島なら断る
export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as { inviteId?: string; url?: string; from?: string; message?: string };
  const url = body.url?.trim() ?? "";
  const from = body.from?.trim().slice(0, 20) ?? "";
  const message = body.message?.trim().slice(0, 80) || undefined;
  if (!isYouTubeUrl(url)) return Response.json({ error: "YouTube の動画のリンクを入れてください" }, { status: 400 });
  if (!from) return Response.json({ error: "名前を入れてください。ニックネームでかまいません" }, { status: 400 });

  const friend = await getDiagnosisByInvite(body.inviteId ?? "");
  if (!friend) return Response.json({ error: "友だちの診断が見つかりませんでした" }, { status: 404 });

  const meta = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ title?: string; author_name?: string }>) : null))
    .catch(() => null);
  if (!meta?.title) return Response.json({ error: "動画が見つかりませんでした" }, { status: 404 });

  let video;
  try {
    [video] = await classifyVideos([{ title: meta.title, channel: meta.author_name }]);
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
  }
  const topic = video?.topic ?? "other.other";
  if (topic.startsWith("other")) {
    return Response.json({ error: "この動画がどの話題かが分かりませんでした。別の動画を選んでください" }, { status: 422 });
  }
  const lit = new Set([...Object.keys(friend.topicCounts ?? {}), ...(await listBatons(friend.id)).filter((b) => b.litAt).map((b) => b.topic)]);
  if (lit.has(topic)) {
    return Response.json(
      { error: `この動画は「${topicLabel(topic)}」の話題です。この話題は、友だちのおすすめにもう出てきています。一覧にある話題の動画を選んでください`, topic },
      { status: 409 },
    );
  }

  const id = await addBaton(friend.id, { topic, url, title: meta.title, channel: meta.author_name, from, message });
  if (!id) return Response.json({ error: "この友だちには、すすめられた動画がたくさん届いているため、これ以上は送れません" }, { status: 429 });
  return Response.json({ topic, title: meta.title });
}
