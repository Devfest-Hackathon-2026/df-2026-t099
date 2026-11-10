import { swipeCardTitles } from "@/lib/gemini";
import { GENRES } from "@/lib/genres";
import { tooMany } from "@/lib/rate-limit";
import { TOPICS, genreOfTopic, topicsOf } from "@/lib/topics";

const DECK_SIZE = 24;

// あとから足した話題（2ch・まとめと、11/6 に足した12の話題）は、保存してある題名にまだないので、Claude が書いた題名を使う
const ADDED_TITLES: Record<string, string[]> = {
  "variety.matome": ["【2ch面白いスレ】上司に言われた一言がひどすぎた件", "【ゆっくり解説】ネットで話題になった衝撃の体験談"],
  "variety.occult": ["本当にあった怖い話を朗読", "有名な都市伝説の真相を調べてみた"],
  "variety.overseas": ["【海外の反応】日本のコンビニに驚く外国人", "日本の文化を初めて見た外国人の本音"],
  "music.idol": ["アイドルグループのライブに密着", "新人アイドルのデビュー曲ダンス練習"],
  "music.instrument": ["ピアノで名曲を弾いてみた", "ギター初心者が1か月で弾けた曲"],
  "news.entertainment": ["今週の芸能ニュースまとめ", "人気俳優の結婚報道をくわしく"],
  "learning.trivia": ["思わず人に話したくなる雑学30連発", "知らないと損する豆知識まとめ"],
  "sports.golf": ["プロが教えるドライバーの飛ばし方", "初めてのコースでスコア100切りに挑戦"],
  "money.poikatsu": ["ポイ活で毎月1万円得する方法", "今月いちばんお得なキャンペーンまとめ"],
  "movie.foreign": ["一気見したくなる海外ドラマ5選", "話題の海外ドラマ、最新シーズンを解説"],
  "movie.tokusatsu": ["歴代ヒーローの変身シーンを振り返る", "特撮の撮影の裏側を大公開"],
  "hobby.asmr": ["雨の音と焚き火の作業用BGM", "耳かきの音で眠れるASMR"],
  "hobby.shogi": ["プロ棋士の名局をやさしく解説", "将棋の初心者が最初に覚える戦法"],
};

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// スワイプ診断のカードを引く。137 の話題から、まだ試していない話題を、ジャンルが偏らないように順番に選ぶ。
// all: true のときは、まだ試していない話題を全部返す（答えに合わせて次のカードを選ぶ、適応型の診断で使う）
export async function POST(request: Request) {
  const limited = tooMany(request, "api");
  if (limited) return limited;
  const { exclude, all } = (await request.json().catch(() => ({}))) as { exclude?: string[]; all?: boolean };
  const tested = new Set(exclude ?? []);

  const pools = shuffle(GENRES.filter((g) => g.id !== "other")).map((g) =>
    shuffle(topicsOf(g.id).filter((t) => !tested.has(t.id))),
  );
  const picked: string[] = [];
  const size = all ? TOPICS.length : DECK_SIZE;
  while (picked.length < size && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      const t = pool.pop();
      if (t) picked.push(t.id);
      if (picked.length >= size) break;
    }
  }

  const titles = await swipeCardTitles().catch(() => ({}) as Record<string, string[]>);
  const cards = shuffle(picked).map((topic) => {
    const options = titles[topic] ?? ADDED_TITLES[topic] ?? [];
    const label = TOPICS.find((t) => t.id === topic)?.label ?? "";
    return {
      topic,
      genre: genreOfTopic(topic),
      title: options.length ? options[Math.floor(Math.random() * options.length)] : `「${label}」の人気動画`,
    };
  });
  const remaining = TOPICS.filter((t) => t.genre !== "other" && !tested.has(t.id) && !picked.includes(t.id)).length;
  return Response.json({ cards, remaining });
}
