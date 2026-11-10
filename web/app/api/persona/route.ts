import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { guessPersona } from "@/lib/gemini";
import { tooMany } from "@/lib/rate-limit";

// アルゴリズムが思う「あなた」。動画の題名は推定に使うだけで、保存しない
export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    videos?: { title?: string; topic?: string; frequency?: string }[];
  };
  const videos = (body.videos ?? [])
    .filter((v) => typeof v.title === "string" && v.title.trim())
    .map((v) => ({ title: v.title!.trim().slice(0, 120), topic: v.topic, frequency: v.frequency }));
  if (videos.length < 3) return Response.json({ error: "動画が少なすぎます" }, { status: 400 });
  try {
    const persona = await guessPersona(videos);
    if (!persona.oneLiner || persona.guesses.length === 0) throw new Error("empty persona");
    return Response.json(persona);
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("guessPersona failed", e);
    return Response.json({ error: "推定できませんでした" }, { status: 502 });
  }
}
