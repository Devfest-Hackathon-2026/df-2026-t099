import "server-only";

// API の使いすぎを防ぐ、簡単な回数の上限。
// 同じ接続元から WINDOW_MS のあいだに、種類ごとの回数まで。台ごとのメモリで数えるので厳密ではない
// （Cloud Run は最大2台なので、実際の上限はこの2倍まで）。
// 会場の Wi-Fi では大勢が同じ接続元に見えるので、AI を呼ばない API はゆるくする。
// AI の使いすぎは、1日の上限（ai-guard）と予算の安全装置でも止まる。合言葉の入口は総当たりを防ぐため低いまま
const WINDOW_MS = 10 * 60 * 1000;
const LIMITS = { ai: 60, api: 300, gate: 30 } as const;
export type Bucket = keyof typeof LIMITS;

const hits = new Map<string, number[]>();

function clientOf(request: Request) {
  // 先頭の値は送る側が自由に書けるので使わない。Cloud Run の手前（Google のフロントエンド）は、
  // 実際の接続元を末尾に付け足すので、末尾の値で数える
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}

// 上限を超えていれば 429 の Response を返す。超えていなければ null
export function tooMany(request: Request, bucket: Bucket = "ai") {
  const key = `${bucket}:${clientOf(request)}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[bucket]) {
    return Response.json({ error: "短い時間に使われすぎています。10分ほどあけてから試してください" }, { status: 429 });
  }
  recent.push(now);
  hits.set(key, recent);
  // 覚えている接続元が増えすぎたら、古いものから捨てる
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return null;
}
