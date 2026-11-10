import "server-only";
import { Firestore } from "@google-cloud/firestore";
import { cacheLife } from "next/cache";
import { SHARE_ID, toShareSummary, type ShareSummary } from "./share";

// 共有リンクの中身を置く場所（shares）。診断の記録（diagnoses）とはつながない
const shares = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "kurohanpen-devfest26",
}).collection("shares");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  // 62 で割った余りを使う（偏りはわずかで、推測されにくさには影響しない）
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function saveShareDoc(summary: ShareSummary) {
  const id = newShareId();
  // create は同じ id があると失敗するので、重なったときに上書きしない
  await shares.doc(id).create({ ...summary, createdAt: new Date() });
  return id;
}

// 一度作った中身は変わらないので、読んだ結果をサーバーに覚えておく（消したときに残りすぎないよう、1時間ほど）
export async function getShareDoc(id: string): Promise<ShareSummary | null> {
  "use cache";
  cacheLife("hours");
  if (!SHARE_ID.test(id)) return null;
  const snap = await shares.doc(id).get();
  return snap.exists ? toShareSummary(snap.data()) : null;
}
