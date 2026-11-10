import type { Video } from "./genres";

// 動画ごとの「おすすめとの関係」。
// - watched：見ている（履歴にある、スワイプで「見る」）
// - shown：おすすめに流れてきた。見たかどうかは分からない（ホーム画面のスクショ）
// - skipped：流れてくるけど、見ない
// - unseen：そもそも流れてこない（スワイプ診断でだけ分かる）
// 「流れてくる世界」= watched + shown + skipped、「見ている世界」= watched。unseen は霧の中。
export type Exposure = "watched" | "shown" | "skipped" | "unseen";

export function exposureOf(v: Video): Exposure {
  return v.exposure ?? "watched";
}

// おすすめに流れてきている動画（見たかどうかは問わない）
export function shownVideos(videos: Video[]) {
  return videos.filter((v) => exposureOf(v) !== "unseen");
}

// 好みの型や分析に使う動画。見ている動画があればそれを、なければ流れてきた動画を使う
export function tasteVideos(videos: Video[]) {
  const watched = videos.filter((v) => exposureOf(v) === "watched");
  return watched.length > 0 ? watched : videos.filter((v) => exposureOf(v) === "shown");
}

// 3つの数（スワイプのように、見る・見ない・流れてこないが分かるときだけ意味がある）
export function exposureCounts(videos: Video[]) {
  const n = (e: Exposure) => videos.filter((v) => exposureOf(v) === e).length;
  return { watched: n("watched"), shown: n("shown"), skipped: n("skipped"), unseen: n("unseen") };
}

// ジャンルは好きなのに、この動画は合わなかった本数をジャンルごとに数える
export function titleMisses(videos: Video[]) {
  const misses = new Map<string, number>();
  videos
    .filter((v) => exposureOf(v) === "skipped" && v.skipReason === "title")
    .forEach((v) => misses.set(v.genre, (misses.get(v.genre) ?? 0) + 1));
  return misses;
}
