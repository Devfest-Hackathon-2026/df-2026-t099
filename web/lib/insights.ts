import "server-only";
import {
  AGE_BANDS,
  REGIONS,
  averageCounts,
  matchPercent,
  topGenres,
  type SavedDiagnosis,
} from "./compare";
import { GENRES, type GenreId } from "./genres";

// 比べる相手が少なすぎると数字に意味がないので、この人数に満たない集団は出さない
const MIN_GROUP = 3;

function cohort(me: SavedDiagnosis, others: SavedDiagnosis[], label: string) {
  if (others.length < MIN_GROUP) return null;
  return {
    label,
    n: others.length,
    match: matchPercent(me.counts, averageCounts(others)),
    sample: others.some((o) => o.sample),
  };
}

export function distribution<T extends string>(list: SavedDiagnosis[], keys: readonly T[], pick: (d: SavedDiagnosis) => T | undefined) {
  const known = list.filter((d) => pick(d));
  return keys
    .map((k) => ({ key: k, share: known.length ? known.filter((d) => pick(d) === k).length / known.length : 0 }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share);
}

export function buildInsights(me: SavedDiagnosis, all: SavedDiagnosis[]) {
  const others = all.filter((d) => d.id !== me.id);

  const everyone = cohort(me, others, "診断した人全体");
  const sameAge = me.ageBand ? cohort(me, others.filter((d) => d.ageBand === me.ageBand), `同じ${me.ageBand}の人`) : null;
  const sameRegion = me.region ? cohort(me, others.filter((d) => d.region === me.region), `同じ${me.region}の人`) : null;

  // 年代×地域の集団の中で、自分から一番遠い集団
  const groups = AGE_BANDS.flatMap((age) =>
    REGIONS.map((region) => {
      const members = others.filter((d) => d.ageBand === age && d.region === region);
      const c = cohort(me, members, `${region}の${age}`);
      return c && { ...c, top: topGenres(averageCounts(members), 3).map((g) => g.label) };
    }),
  ).filter((g) => g !== null);
  const farthest = groups.sort((a, b) => a.match - b.match)[0] ?? null;

  const myTop = topGenres(me.counts, 1)[0] ?? GENRES[0];
  const audience = audienceOf(myTop.id, others);

  const sameType = others.filter((d) => d.type === me.type).length;

  // 本人の画面で使うものだけを返す（チャンネル名とグループは画面で使わないので出さない）
  const { channels: _channels, groupId: _groupId, ...mine } = me;
  void _channels;
  void _groupId;

  return {
    me: mine,
    everyone,
    sameAge,
    sameRegion,
    farthest,
    audience,
    sameTypeShare: others.length ? Math.round((sameType / others.length) * 100) : null,
    usesSample: others.some((d) => d.sample),
  };
}

export type Insights = ReturnType<typeof buildInsights>;

// その島をどんな人が見ているか（その島が見ている動画の2割以上の人）
export function audienceOf(genre: GenreId, list: SavedDiagnosis[]) {
  const fans = list.filter((d) => (d.counts[genre] ?? 0) / (d.total || 1) >= 0.2);
  return {
    genre: GENRES.find((g) => g.id === genre)?.label ?? "",
    n: fans.length,
    share: list.length ? Math.round((fans.length / list.length) * 100) : 0,
    ages: distribution(fans, AGE_BANDS, (d) => d.ageBand).slice(0, 3),
    regions: distribution(fans, REGIONS, (d) => d.region).slice(0, 3),
    sample: fans.some((d) => d.sample),
  };
}

export type Audience = ReturnType<typeof audienceOf>;
