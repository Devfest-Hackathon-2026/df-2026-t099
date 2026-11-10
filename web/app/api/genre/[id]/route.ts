import { tooMany } from "@/lib/rate-limit";
import { listDiagnosisDocs } from "@/lib/db";
import { imagineFeed } from "@/lib/gemini";
import { GENRE_IDS, genreOf, type GenreId } from "@/lib/genres";
import { audienceOf } from "@/lib/insights";

// 海の地図で押した島：その島を見ている人たちと、その島のホーム画面のイメージ
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = tooMany(request);
  if (limited) return limited;
  const { id } = await params;
  if (!GENRE_IDS.includes(id as GenreId)) {
    return Response.json({ error: "ジャンルが見つかりません" }, { status: 404 });
  }
  const genre = id as GenreId;
  const [all, videos] = await Promise.all([
    listDiagnosisDocs(),
    imagineFeed(`genre:${genre}`, `「${genreOf(genre).label}」の動画ばかり見ている`).catch(() => []),
  ]);
  return Response.json({ audience: audienceOf(genre, all), videos: videos.slice(0, 4) });
}
