import { GATE_COOKIE, gateToken } from "@/lib/gate";
import { tooMany } from "@/lib/rate-limit";

// 合言葉が合っていれば、30日間は入れる Cookie を渡す
export async function POST(request: Request) {
  const limited = tooMany(request, "gate");
  if (limited) return limited;

  const password = process.env.SITE_PASSWORD;
  const { word } = (await request.json()) as { word?: string };
  if (!password || (word ?? "").trim() !== password) {
    return Response.json({ error: "合言葉がちがいます" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${GATE_COOKIE}=${await gateToken(password)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
