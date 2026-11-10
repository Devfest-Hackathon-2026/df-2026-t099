import "server-only";
import { createHash } from "node:crypto";
import { aiDisabledFlag, countAiCall } from "./db";

// Gemini を呼ぶ前に必ず通す。
// 1. 予算の安全装置が「AI を止める」印を立てていたら呼ばない
// 2. 1日の回数（日本時間）が上限を超えたら呼ばない
// どちらのときも AiPaused を投げ、画面には「いまは AI を休ませています」と出す。アプリのほかの部分は動き続ける
export class AiPaused extends Error {
  constructor() {
    super("AI is paused");
  }
}

export const AI_PAUSED_MESSAGE =
  "いまは AI を休ませているため、この機能は使えません。カードの診断なら、AI を使わずに結果を見られます。";

const DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT ?? 1500);
let flag: { at: number; disabled: boolean } | null = null;

export async function reserveAiCall() {
  const now = Date.now();
  // 印は1分に1回だけ読み直す
  if (!flag || now - flag.at > 60_000) flag = { at: now, disabled: await aiDisabledFlag().catch(() => false) };
  if (flag.disabled) throw new AiPaused();
  const n = await countAiCall().catch(() => 0);
  if (n > DAILY_LIMIT) throw new AiPaused();
}

// 同じ入力なら、前の答えをそのまま返す（Gemini の回数を減らし、毎回同じ結果にする）。
// 動画の題名は保存しないと画面で約束しているので、データベースには置かず、サーバーのメモリにだけ一時的に覚える
const TTL = 24 * 60 * 60 * 1000;
const MAX = 300;
const memory = new Map<string, { at: number; value: unknown }>();

export async function remembered<T>(kind: string, input: unknown, make: () => Promise<T>): Promise<T> {
  const key = `${kind}:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await make();
  memory.set(key, { at: Date.now(), value });
  if (memory.size > MAX) memory.delete(memory.keys().next().value!);
  return value;
}
