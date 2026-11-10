// YouTube の動画1本（画面に出す分だけ）。サーバー専用の youtube.ts と、テストできる部品の両方から使う
export type Suggestion = { videoId: string; title: string; channel: string; thumbnail: string };
