import type { GenreId } from "./genres";

// スワイプ診断のカード。実在の動画ではなく「こういう動画」のたとえ。
// 1ジャンル1〜2枚にして、どのジャンルにも出会えるようにしている。topic は topics.ts の id
export const SWIPE_CARDS: { title: string; genre: GenreId; topic: string }[] = [
  { title: "人気ゲームの最速クリアに挑戦する実況", genre: "game", topic: "game.rpg" },
  { title: "新作ゲームを10時間やってみた感想", genre: "game", topic: "game.mobile" },
  { title: "話題の新曲のライブ映像", genre: "music", topic: "music.jpop" },
  { title: "弾き語りで名曲をカバー", genre: "music", topic: "music.cover" },
  { title: "芸人の本気ドッキリ企画", genre: "variety", topic: "variety.dokkiri" },
  { title: "今期アニメのおすすめを語る", genre: "anime", topic: "anime.season" },
  { title: "サッカーの神プレー集", genre: "sports", topic: "sports.soccer" },
  { title: "プロ野球の試合ハイライト", genre: "sports", topic: "sports.baseball" },
  { title: "今週のニュースを5分で解説", genre: "news", topic: "news.commentary" },
  { title: "世界史を30分でざっくり学ぶ", genre: "learning", topic: "learning.history" },
  { title: "大学の講義を図解でまとめた動画", genre: "learning", topic: "learning.lecture" },
  { title: "最新スマホを分解してみた", genre: "tech", topic: "tech.gadget" },
  { title: "宇宙の果てはどうなっているのか", genre: "tech", topic: "tech.space" },
  { title: "コンビニ食材だけで作る絶品レシピ", genre: "food", topic: "food.recipe" },
  { title: "地方の名店を食べ歩き", genre: "food", topic: "food.gourmet" },
  { title: "1泊2日で行く京都の旅", genre: "travel", topic: "travel.domestic" },
  { title: "プチプラで作る秋のコーデ", genre: "beauty", topic: "beauty.fashion" },
  { title: "子猫が初めて雪を見た日", genre: "animal", topic: "animal.cat" },
  { title: "大学生の1日ルーティン", genre: "vlog", topic: "vlog.student" },
  { title: "新NISAの始め方をやさしく解説", genre: "money", topic: "money.invest" },
  { title: "名作映画の伏線を全部解説", genre: "movie", topic: "movie.review" },
  { title: "新幹線の運転席からの景色", genre: "vehicle", topic: "vehicle.train" },
  { title: "100均の材料で本棚をDIY", genre: "hobby", topic: "hobby.diy" },
  { title: "初心者向けキャンプ道具の選び方", genre: "hobby", topic: "hobby.camp" },
];
