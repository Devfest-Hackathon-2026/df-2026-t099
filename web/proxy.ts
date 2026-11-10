import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

// 合言葉を入れていない人は、合言葉の入口へ回す（SITE_PASSWORD がないときは何もしない）
export async function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(GATE_COOKIE)?.value;
  if (cookie && cookie === (await gateToken(password))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "合言葉が必要です" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 合言葉の入口そのもの、Next.js の静的ファイル、robots.txt、SNS 用の画像（og.png）、ホーム画面に追加するためのファイルは通す。
  // 結果の共有リンク（s/<id> と、その OGP 画像）と、そこに出す話題の画像（thumbs/）も、受け取った人が開けるように通す
  matcher: ["/((?!gate|api/gate|_next/static|_next/image|favicon.ico|robots.txt|og.png|ui.js|sw.js|manifest.webmanifest|icons/|s/|thumbs/).*)"],
};
