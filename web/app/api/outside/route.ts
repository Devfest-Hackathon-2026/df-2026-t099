import { AI_PAUSED_MESSAGE, AiPaused } from "@/lib/ai-guard";
import { pickOutside } from "@/lib/gemini";
import { tooMany } from "@/lib/rate-limit";
import { TOPIC_IDS, topicLabel } from "@/lib/topics";
import { knownTitles, usableCandidates } from "@/lib/outside-candidates";
import { peekVideo, searchVideo, suggestVideo } from "@/lib/youtube";

// 外への5本：好きな話題とつながる「出てこない話題」を Gemini が選び、選んだ理由を添えて、
// 実際の YouTube の動画を探して返す。AI を休ませているときや失敗したときは、画面がいままでの選び方に戻す
export async function POST(request: Request) {
  const limited = tooMany(request);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as { likes?: string[]; candidates?: string[] };
  const ok = (t: unknown): t is string => typeof t === "string" && TOPIC_IDS.includes(t) && !t.startsWith("other");
  const likes = [...new Set((body.likes ?? []).filter(ok))].slice(0, 6);
  const candidates = [...new Set((body.candidates ?? []).filter(ok))].filter((t) => !likes.includes(t)).slice(0, 30);
  if (likes.length === 0 || candidates.length < 5) return Response.json({ error: "話題が足りません" }, { status: 400 });
  try {
    // 覚えている動画があれば、その題名も Gemini に見せる（検索はしないので、YouTube の回数は増えない）
    const known = await Promise.all(candidates.map(async (t) => [t, await peekVideo(t)] as const));
    const seen = new Map(known);
    // 探しても動画が無かった話題は、候補が5つ以上残るなら外す（動画のない行を減らす）
    const picks = await pickOutside(likes, usableCandidates(candidates, seen), knownTitles(seen));
    if (picks.length === 0) throw new Error("no picks");
    const items = await Promise.all(
      // 動画は、話題ごとに29日覚えている1本を先に使う（話題は 148 しかないので、YouTube の検索の回数がふくらまない）。
      // 見つからないときだけ、Gemini が出した言葉で探す（話題の名前も入れて、理由と動画がずれないようにする）
      picks.map(async (p) => ({ ...p, video: (await suggestVideo(p.topic)) ?? (await searchVideo(`${topicLabel(p.topic).replace(/・/g, " ")} ${p.query}`)) })),
    );
    return Response.json({ items });
  } catch (e) {
    if (e instanceof AiPaused) return Response.json({ error: AI_PAUSED_MESSAGE, paused: true }, { status: 503 });
    console.error("pickOutside failed", e);
    return Response.json({ error: "選べませんでした" }, { status: 502 });
  }
}
