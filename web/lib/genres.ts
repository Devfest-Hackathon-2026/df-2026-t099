// 診断に使うジャンルの一覧。Gemini にはこの中から1つを選ばせる。
// 色は結果のグラフで使う。
export const GENRES = [
  { id: "game", label: "ゲーム", color: "#6366f1" },
  { id: "music", label: "音楽", color: "#ec4899" },
  { id: "variety", label: "お笑い・バラエティ", color: "#f59e0b" },
  { id: "anime", label: "アニメ・漫画", color: "#a855f7" },
  { id: "sports", label: "スポーツ", color: "#22c55e" },
  { id: "news", label: "ニュース・社会", color: "#64748b" },
  { id: "learning", label: "学び・解説", color: "#0ea5e9" },
  { id: "tech", label: "科学・テクノロジー", color: "#14b8a6" },
  { id: "food", label: "料理・グルメ", color: "#ef4444" },
  { id: "travel", label: "旅行・おでかけ", color: "#84cc16" },
  { id: "beauty", label: "美容・ファッション", color: "#f472b6" },
  { id: "animal", label: "動物", color: "#d97706" },
  { id: "vlog", label: "Vlog・日常", color: "#fb923c" },
  { id: "money", label: "ビジネス・お金", color: "#0f766e" },
  { id: "movie", label: "映画・ドラマ", color: "#7c3aed" },
  { id: "vehicle", label: "車・乗り物", color: "#475569" },
  { id: "hobby", label: "趣味・DIY", color: "#65a30d" },
  { id: "other", label: "その他", color: "#9ca3af" },
] as const;

export type GenreId = (typeof GENRES)[number]["id"];

export const GENRE_IDS = GENRES.map((g) => g.id) as GenreId[];

export function genreOf(id: string) {
  return GENRES.find((g) => g.id === id) ?? GENRES[GENRES.length - 1];
}

// 入力方法が違っても、結果の画面はこの形で受け取る
export type Video = {
  title: string;
  channel?: string;
  genre: GenreId;
  // ジャンルの中の細かい話題（topics.ts の id）と、動画の言語（ja / en / ko など）
  topic?: string;
  language?: string;
  // おすすめとの関係（exposure.ts）。ないときは watched として扱う
  exposure?: "watched" | "shown" | "skipped" | "unseen";
  skipReason?: "genre" | "title";
  // スワイプで「流れてくる」と答えたときの頻度（よく／たまに）
  frequency?: "often" | "sometimes";
  // スワイプで「気分しだいで見る」と答えたとき（見るかは、その日の気分や状況による）。見る量は「見る」の半分として数える
  mood?: boolean;
  // スクショで読んだとき：ショートの段の縦長の動画か、ふつうの横長の動画か
  format?: "short" | "long";
};

export type DiagnosisSource = "screenshot" | "url" | "takeout" | "swipe" | "sample";

export type Diagnosis = {
  source: DiagnosisSource;
  videos: Video[];
  createdAt: string;
  // 結果を見る前に本人が予想した「流れてくる割合」（%）。とばしたときは null
  prediction?: number | null;
  // 結果を見た本人が、ジャンルごとに直した「流れてくる割合」（0〜1）。推定より優先する
  corrections?: Partial<Record<GenreId, number>>;
  // 結果を見たあと、おすすめに出てこない話題の動画を見て「見た」を押した記録（外へ出た話題）。地図と数字に足す
  outside?: OutsideStep[];
  // 「続けて答える」で答えを足したとき、最初に答えた診断の時刻。記録では同じ1回として数える
  continues?: string;
};

// 外へ出た1歩：どの話題の、どの動画を見たか
export type OutsideStep = { topic: string; videoId?: string; title?: string; at: string };
