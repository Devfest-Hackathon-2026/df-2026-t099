import "server-only";
import { getFeedDoc, saveFeedDoc } from "./db";
import type { GenreId } from "./genres";
import { TOPICS } from "./topics";

// 「見たことのない話題を1本見てみる」に出す、本物の動画を YouTube Data API で探す。
// 検索は1回で枠を 100 使う（1日 10,000 まで）ので、話題ごとに見つけた動画を Firestore に29日間覚えて使い回す。
// 覚えるのは公開されている動画の情報だけで、使った人の情報は入れない
import type { Suggestion } from "./youtube-types";
export type { Suggestion };

// 審査の期間（11/10〜11月末）をまたいでも探し直さないよう、29日覚える（YouTube API の規約で、保存は30日まで）
const KEEP = 29 * 24 * 60 * 60 * 1000;

const HINT: Partial<Record<GenreId, string>> = {
  game: "実況",
  sports: "ハイライト",
  news: "解説",
  learning: "解説",
  tech: "解説",
  money: "解説",
  travel: "旅",
  vehicle: "レビュー",
  hobby: "やり方",
};
const memory = new Map<string, { until: number; value: Suggestion | null; none?: boolean }>();

// YouTube の題名は &quot; のような書き方で返るので、ふつうの文字に戻す
function decode(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// 外へ1歩を勧める動画なので、あおる題名や、事件・性・暴力を思わせる題名の動画は出さない
const BAIT = /(妊娠|死刑|殺|事件|事故|閲覧注意|衝撃|炎上|暴露|悲報|ヤバ|やば|エロ|胸糞|晒|逮捕|不倫|浮気|DQN|発狂|ブチギレ|号泣|余命|見放|大富豪|底辺|地獄|末路|絶望|激怒|修羅場|監禁|虐待|自殺|死ぬ|真相|闇|ガチ泣き|胸くそ|迷惑|晒し|\(1[0-9]\)|（1[0-9]）)/;

async function search(topicId: string): Promise<Suggestion | null> {
  const topic = TOPICS.find((t) => t.id === topicId);
  if (!topic) return null;
  // 「FPS・シューター」のような名前は、区切りを空白にして検索する。
  // 「車」のような短い言葉だけだと子ども向けの動画ばかり出るので、ジャンルごとの言葉を足す
  return searchQuery(`${topic.label.replace(/・/g, " ")} ${HINT[topic.genre] ?? ""}`.trim());
}

async function searchQuery(q: string): Promise<Suggestion | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !q) return null;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "25",
    regionCode: "JP",
    relevanceLanguage: "ja",
    safeSearch: "strict",
    q,
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    // 上限（429・403）などの失敗は「無かった」と区別して、短い時間だけ覚える
    console.error("youtube search failed", res.status);
    throw new Error(`youtube ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } }[];
  };
  const item = data.items?.find((i) => i.id?.videoId && i.snippet?.title && !BAIT.test(decode(i.snippet.title)));
  if (!item) return null;
  return {
    videoId: item.id!.videoId!,
    title: decode(item.snippet!.title!),
    channel: decode(item.snippet!.channelTitle ?? ""),
    thumbnail: item.snippet!.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${item.id!.videoId}/mqdefault.jpg`,
  };
}

// 覚えている結果：見つけた動画（29日）、探しても無かった印（1日）、一時的な失敗（10分）
const NONE_KEEP = 24 * 60 * 60 * 1000;
const FAIL_KEEP = 10 * 60 * 1000;
type Saved = (Suggestion & { at: number; none?: undefined }) | { none: true; at: number };
type Remembered = { state: "hit"; value: Suggestion } | { state: "none" } | { state: "miss" };

async function readCache(key: string): Promise<Remembered> {
  const hit = memory.get(key);
  if (hit && Date.now() < hit.until) return hit.value ? { state: "hit", value: hit.value } : hit.none ? { state: "none" } : { state: "miss" };
  const saved = (await getFeedDoc<Saved>(key).catch(() => null))?.[0];
  if (saved?.none && Date.now() - saved.at < NONE_KEEP) {
    memory.set(key, { until: saved.at + NONE_KEEP, value: null, none: true });
    return { state: "none" };
  }
  if (saved && !saved.none && Date.now() - saved.at < KEEP && !BAIT.test(saved.title)) {
    const { at, ...value } = saved;
    memory.set(key, { until: at + KEEP, value });
    return { state: "hit", value };
  }
  return { state: "miss" };
}

// 見つけた動画は、メモリと Firestore に29日間覚えて使い回す（v2：安全の設定を強くしてから探し直した分）。
// 探して無かった話題は1日覚えて、同じ検索で枠を使わない。上限などの失敗は10分だけ覚えて、また探す
async function cached(key: string, find: () => Promise<Suggestion | null>): Promise<Suggestion | null> {
  const known = await readCache(key);
  if (known.state === "hit") return known.value;
  if (known.state === "none") return null;
  if (memory.has(key) && Date.now() < memory.get(key)!.until) return null;
  let value: Suggestion | null;
  try {
    value = await find();
  } catch {
    memory.set(key, { until: Date.now() + FAIL_KEEP, value: null });
    return null;
  }
  const now = Date.now();
  if (value) {
    memory.set(key, { until: now + KEEP, value });
    await saveFeedDoc(key, [{ ...value, at: now }]).catch(() => {});
  } else {
    memory.set(key, { until: now + NONE_KEEP, value: null, none: true });
    await saveFeedDoc(key, [{ none: true, at: now }]).catch(() => {});
  }
  return value;
}

const topicKey = (topicId: string) => `suggest2_${topicId.replace(/\./g, "_")}`;

// 覚えている結果だけを返す（YouTube は検索しない）。外の5本で、Gemini に題名を見せて選ばせ、
// 探しても動画が無かった話題（"none"）は候補から外すのに使う
export async function peekVideo(topicId: string): Promise<Suggestion | null | "none"> {
  const known = await readCache(topicKey(topicId));
  return known.state === "hit" ? known.value : known.state === "none" ? "none" : null;
}

export async function suggestVideo(topicId: string): Promise<Suggestion | null> {
  return cached(topicKey(topicId), () => search(topicId));
}

// Gemini が考えた検索の言葉で、動画を1本探す
export async function searchVideo(q: string): Promise<Suggestion | null> {
  const clean = q.replace(/[^\p{L}\p{N}\s・ー]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  const id = Buffer.from(clean).toString("base64url").slice(0, 80);
  return cached(`q2_${id}`, () => searchQuery(clean));
}
