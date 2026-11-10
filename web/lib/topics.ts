import type { GenreId } from "./genres";

// ジャンルの中の細かい話題。「ゲームを見ている」だけでは広すぎるので、島の中の入り江に分ける。
// 試作用に Claude が仮で決めた一覧。id は「ジャンル.話題」。
const RAW: Record<GenreId, [string, string][]> = {
  game: [["fps", "FPS・シューター"], ["rpg", "RPG"], ["battle", "対戦・MOBA"], ["mobile", "スマホゲーム"], ["sim", "シミュレーション・建築"], ["horror", "ホラーゲーム"], ["retro", "レトロゲーム"], ["esports", "eスポーツ大会"]],
  music: [["jpop", "J-POP"], ["kpop", "K-POP"], ["vocaloid", "ボカロ"], ["band", "ロック・バンド"], ["hiphop", "ヒップホップ"], ["classical", "クラシック"], ["western", "洋楽"], ["cover", "歌ってみた"], ["idol", "アイドル"], ["instrument", "楽器の演奏"]],
  variety: [["manzai", "漫才・コント"], ["dokkiri", "ドッキリ・企画"], ["youtuber", "YouTuber の企画"], ["talk", "トーク・雑談・ラジオ"], ["occult", "怖い話・都市伝説"], ["overseas", "海外の反応"], ["challenge", "チャレンジ"], ["tv", "テレビ番組"], ["matome", "2ch・まとめ・ネットの話"], ["gag", "ショートネタ"]],
  anime: [["season", "今期アニメ"], ["classic", "名作アニメ"], ["manga", "漫画の紹介"], ["vtuber", "VTuber"], ["clip", "切り抜き・MAD"], ["seiyu", "声優"], ["goods", "グッズ・フィギュア"], ["theory", "考察"]],
  sports: [["soccer", "サッカー"], ["baseball", "野球"], ["basketball", "バスケ"], ["fight", "格闘技"], ["tennis", "テニス・卓球"], ["track", "陸上・マラソン"], ["winter", "ウィンタースポーツ"], ["training", "筋トレ"], ["golf", "ゴルフ"]],
  news: [["politics", "政治"], ["business", "経済ニュース"], ["world", "国際ニュース"], ["incident", "事件・事故"], ["disaster", "災害・天気"], ["local", "地域のニュース"], ["commentary", "時事の解説"], ["society", "社会問題"], ["entertainment", "芸能ニュース"]],
  learning: [["history", "歴史"], ["language", "英語・語学"], ["exam", "受験・勉強法"], ["philosophy", "哲学・思想"], ["psychology", "心理学"], ["lecture", "大学の講義"], ["book", "本の要約"], ["lifehack", "自己啓発・ライフハック"], ["trivia", "雑学・豆知識"]],
  tech: [["gadget", "ガジェット"], ["programming", "プログラミング"], ["ai", "AI"], ["space", "宇宙"], ["physics", "物理・化学"], ["biology", "生物"], ["engineering", "ものづくり・工学"], ["appliance", "家電レビュー"]],
  food: [["recipe", "レシピ"], ["bigeat", "大食い・モッパン"], ["gourmet", "食べ歩き"], ["sweets", "カフェ・スイーツ"], ["outdoor", "キャンプ飯"], ["conveni", "コンビニ・チェーン店"], ["drink", "お酒"], ["healthy", "健康・自炊"]],
  travel: [["domestic", "国内旅行"], ["abroad", "海外旅行"], ["hotel", "ホテル・宿"], ["railtrip", "鉄道の旅"], ["onsen", "温泉・サウナ"], ["city", "街歩き"], ["nature", "絶景・自然"], ["livingabroad", "海外生活"]],
  beauty: [["makeup", "メイク"], ["skincare", "スキンケア"], ["fashion", "ファッション"], ["hair", "ヘア"], ["diet", "ダイエット"], ["nail", "ネイル"], ["mens", "メンズ美容"], ["haul", "購入品紹介"]],
  animal: [["cat", "猫"], ["dog", "犬"], ["small", "小動物"], ["bird", "鳥"], ["fish", "魚・水族館"], ["wild", "野生動物"], ["zoo", "動物園"], ["care", "飼い方"]],
  vlog: [["routine", "ルーティン"], ["student", "学生生活"], ["work", "仕事の日常"], ["couple", "カップル・夫婦"], ["family", "家族・子育て"], ["room", "部屋紹介"], ["solo", "一人暮らし"], ["countryside", "田舎暮らし"]],
  money: [["invest", "投資・NISA"], ["sidejob", "副業"], ["career", "就活・転職"], ["startup", "起業・経営"], ["saving", "節約"], ["realestate", "不動産"], ["crypto", "暗号資産"], ["economics", "経済のしくみ"], ["poikatsu", "ポイ活・お得情報"]],
  movie: [["review", "映画レビュー"], ["drama", "日本のドラマ"], ["trailer", "予告編"], ["kdrama", "韓国ドラマ"], ["animefilm", "アニメ映画"], ["documentary", "ドキュメンタリー"], ["short", "短編映画"], ["making", "制作の裏側"], ["foreign", "海外ドラマ"], ["tokusatsu", "特撮・ヒーロー"]],
  vehicle: [["car", "車"], ["bike", "バイク"], ["train", "鉄道"], ["plane", "飛行機"], ["ship", "船"], ["drive", "ドライブ"], ["newcar", "新車レビュー"], ["repair", "整備"]],
  hobby: [["diy", "DIY"], ["camp", "キャンプ"], ["fishing", "釣り"], ["garden", "園芸"], ["craft", "手芸"], ["camera", "写真・カメラ"], ["model", "プラモデル"], ["boardgame", "ボードゲーム"], ["asmr", "ASMR・作業用"], ["shogi", "将棋・囲碁"]],
  other: [["other", "その他"]],
};

export const TOPICS = (Object.entries(RAW) as [GenreId, [string, string][]][]).flatMap(([genre, list]) =>
  list.map(([key, label]) => ({ id: `${genre}.${key}`, genre, label })),
);

export const TOPIC_IDS = TOPICS.map((t) => t.id);

export function topicsOf(genre: GenreId) {
  return TOPICS.filter((t) => t.genre === genre);
}

export function genreOfTopic(topicId: string): GenreId {
  return (TOPICS.find((t) => t.id === topicId)?.genre ?? "other") as GenreId;
}

export function topicLabel(topicId: string) {
  return TOPICS.find((t) => t.id === topicId)?.label ?? "その他";
}

export const TOPIC_GUIDE = TOPICS.map((t) => `${t.id}: ${t.label}`).join("\n");
