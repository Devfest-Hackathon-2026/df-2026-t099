// 合言葉で入口を閉じるしくみ。合言葉は環境変数 SITE_PASSWORD（Cloud Run では Secret Manager から入れる）。
// SITE_PASSWORD がないとき（手元の開発）は閉じない。
// Cookie には合言葉そのものではなく、ハッシュを入れる。

export const GATE_COOKIE = "bubble-gate";

export async function gateToken(password: string) {
  const bytes = new TextEncoder().encode(`bubble-gate:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
