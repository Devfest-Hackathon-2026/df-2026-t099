import { isTypeCode } from "./bubble-type";
import { TOPICS, TOPIC_IDS } from "./topics";

// 結果を共有するリンク（/s/<id>）に載せる中身。最後のスライドのまとめに出ている数だけを持つ。
// 動画の題名・チャンネル・答え・本人用の id・招待用の id は持たない
export type ShareSummary = {
  kinds: number; // 149 の話題のうち、おすすめに出てくる話題（約）
  top: string[]; // 多い3つの話題（話題の id）
  top3: number; // 多い3つの話題が占める割合（%）
  type: string; // 見方のタイプ（4文字の記号）
  fogCount: number; // 一度も出てこない話題の数
  sample?: boolean; // 見本の結果から作ったリンク
};

// 共有用の id。本人用・招待用の id とは関係のない、ランダムな10文字
export const SHARE_ID = /^[A-Za-z0-9]{10}$/;

const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

// 送られてきた中身を、決まった形と範囲に切りそろえる。合わないものは null
export function toShareSummary(body: unknown): ShareSummary | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const kinds = int(b.kinds, 1, TOPICS.length);
  const top3 = int(b.top3, 0, 100);
  const fogCount = int(b.fogCount, 0, TOPICS.length);
  const type = typeof b.type === "string" && isTypeCode(b.type) ? b.type : null;
  const top = Array.isArray(b.top)
    ? [...new Set(b.top.filter((t): t is string => typeof t === "string" && TOPIC_IDS.includes(t) && !t.startsWith("other")))].slice(0, 3)
    : [];
  if (kinds === null || top3 === null || fogCount === null || !type || top.length === 0) return null;
  return { kinds, top, top3, type, fogCount, ...(b.sample === true && { sample: true }) };
}
