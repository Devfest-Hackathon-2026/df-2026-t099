import { countTopics } from "@/lib/bubble-metrics";
import { typeOf } from "@/lib/bubble-type";
import { TOPIC_IDS } from "@/lib/topics";
import { AGE_BANDS, REGIONS, countGenres, topChannels } from "@/lib/compare";
import { getGroupDoc, saveDiagnosisDoc } from "@/lib/db";
import { GENRE_IDS, type Video } from "@/lib/genres";
import { tooMany } from "@/lib/rate-limit";

const MAX_VIDEOS = 2000;

// 本人が「保存して比べる」を押したときだけ呼ばれる
export async function POST(request: Request) {
  const limited = tooMany(request, "api");
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as {
    videos?: Video[];
    ageBand?: string;
    region?: string;
    shareChannels?: boolean;
    groupId?: string | null;
  };
  // 件数とチャンネル名の長さを切る（偽の診断を大量に入れて、みんなの比較を汚せないように）
  const videos = (body.videos ?? [])
    .slice(0, MAX_VIDEOS)
    .filter((v) => GENRE_IDS.includes(v.genre))
    .map((v) => ({ ...v, channel: typeof v.channel === "string" ? v.channel.slice(0, 60) : undefined }));
  if (videos.length === 0) {
    return Response.json({ error: "診断の結果がありません" }, { status: 400 });
  }

  const ageBand = AGE_BANDS.find((a) => a === body.ageBand);
  const region = REGIONS.find((r) => r === body.region);
  const group = body.groupId ? await getGroupDoc(body.groupId) : null;

  const { id, inviteId } = await saveDiagnosisDoc({
    ...(group && { groupId: group.id }),
    counts: countGenres(videos),
    topicCounts: countTopics(videos.filter((v) => v.topic && TOPIC_IDS.includes(v.topic))),
    total: videos.length,
    type: typeOf(videos),
    ...(ageBand && { ageBand }),
    ...(region && { region }),
    ...(body.shareChannels && { channels: topChannels(videos, 10) }),
  });
  return Response.json({ id, inviteId });
}
