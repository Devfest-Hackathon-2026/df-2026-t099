// Google Takeout の watch-history.json を、題名とチャンネル名のリストにする。
// ファイルはブラウザの中で読むだけで、サーバーへ送るのは新しい順の上位だけ。

type TakeoutEntry = {
  header?: string;
  title?: string;
  titleUrl?: string;
  subtitles?: { name?: string }[];
  details?: { name?: string }[];
  time?: string;
};

// 「Watched 〇〇」「〇〇 を視聴しました」の形から題名だけを取り出す
function cleanTitle(raw: string) {
  return raw
    .replace(/^Watched\s+/, "")
    .replace(/\s*を視聴しました$/, "")
    .trim();
}

export function parseWatchHistory(json: unknown, limit: number) {
  if (!Array.isArray(json)) {
    throw new Error("watch-history.json の形ではありません");
  }
  return (json as TakeoutEntry[])
    .filter((e) => e.titleUrl && e.title)
    // Google 広告経由の視聴は好みではないので外す
    .filter((e) => !e.details?.some((d) => d.name?.includes("Google")))
    .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
    .slice(0, limit)
    .map((e) => ({ title: cleanTitle(e.title!), channel: e.subtitles?.[0]?.name }));
}
