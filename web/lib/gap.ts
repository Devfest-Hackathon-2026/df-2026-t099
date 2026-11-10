import { typeOf } from "./bubble-type";
import { estimateFromSwipes } from "./estimate";
import { exposureOf } from "./exposure";
import { GENRES, type GenreId, type Video } from "./genres";
import { topicLabel, topicsOf } from "./topics";

// 「自分が思う自分」（スワイプの答え）と「アルゴリズムが見ている自分」（ホーム画面に実際に流れてきた動画）のズレ。
//
// ホーム画面の動画1本ごとに、スワイプの答えでは「流れてくる」と思っていたかを調べる：
// - その話題に答えていれば、その答え（見る・見送る＝思っていた、流れてこない＝意外）
// - 答えていなければ、そのジャンルの推定の割合（半分以上＝思っていた、4分の1未満＝意外、そのあいだ＝どちらとも）

export type GapItem = { title: string; topic: string; genre: GenreId; belief: "expected" | "surprise" | "unsure" };

export type Gap = {
  items: GapItem[];
  surpriseShare: number; // ホームの動画のうち「意外」だった割合（%）
  surpriseTopics: string[]; // 流れてこないと思っていたのに、流れてきた話題
  quietGenres: string[]; // 流れてくると思っていたのに、ホームに1本もなかったジャンル
  selfType: string; // スワイプの答えから出した型
  algoType: string; // ホーム画面から出した型
};

export function compareWithHome(swipes: Video[], home: Video[]): Gap {
  const answer = new Map<string, string>();
  swipes.forEach((v) => v.topic && answer.set(v.topic, exposureOf(v)));
  const est = estimateFromSwipes(swipes);
  const shareOf = (g: GenreId) => (est.byGenre[g]?.shownTopics ?? 0) / Math.max(1, topicsOf(g).length);

  const items: GapItem[] = home
    .filter((v) => v.topic && !v.topic.startsWith("other"))
    .map((v) => {
      const a = answer.get(v.topic!);
      const belief: GapItem["belief"] = a
        ? a === "unseen"
          ? "surprise"
          : "expected"
        : shareOf(v.genre) >= 0.5
          ? "expected"
          : shareOf(v.genre) < 0.25
            ? "surprise"
            : "unsure";
      return { title: v.title, topic: v.topic!, genre: v.genre, belief };
    });

  const surprises = items.filter((i) => i.belief === "surprise");
  const homeGenres = new Set(home.map((v) => v.genre));
  const quietGenres = GENRES.filter((g) => g.id !== "other" && shareOf(g.id) >= 0.6 && !homeGenres.has(g.id)).map(
    (g) => g.label,
  );

  // 型は「見ている」と答えた動画と、ホームに流れてきた動画で比べる
  const watched = swipes.filter((v) => exposureOf(v) === "watched");
  return {
    items,
    surpriseShare: items.length ? Math.round((surprises.length / items.length) * 100) : 0,
    surpriseTopics: [...new Set(surprises.map((i) => topicLabel(i.topic)))],
    quietGenres,
    selfType: typeOf(watched.length ? watched : swipes),
    algoType: typeOf(home),
  };
}
