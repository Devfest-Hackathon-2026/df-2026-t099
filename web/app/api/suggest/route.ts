import { tooMany } from "@/lib/rate-limit";
import { TOPIC_IDS } from "@/lib/topics";
import { suggestVideo } from "@/lib/youtube";

// 話題（3つまで）ごとに、本物の YouTube の動画を1本ずつ返す。見つからないときは null（画面は検索のリンクにする）
export async function GET(request: Request) {
  const limited = tooMany(request, "api");
  if (limited) return limited;
  const topics = (new URL(request.url).searchParams.get("topics") ?? "")
    .split(",")
    .filter((t) => TOPIC_IDS.includes(t))
    .slice(0, 5);
  const found = await Promise.all(topics.map(async (t) => [t, await suggestVideo(t)] as const));
  return Response.json({ items: Object.fromEntries(found) });
}
