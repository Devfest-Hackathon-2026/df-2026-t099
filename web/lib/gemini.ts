import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getFeedDoc, saveFeedDoc } from "./db";
import { remembered, reserveAiCall } from "./ai-guard";
import type { Video } from "./genres";
import { TOPICS, TOPIC_GUIDE, TOPIC_IDS, genreOfTopic, topicLabel } from "./topics";
import { cleanPicks, type OutsidePick } from "./outside-candidates";

// Vertex AI 経由で Gemini を呼ぶ。認証はローカルでは ADC、デプロイ先では実行用サービスアカウント。
// API キーは使わない。
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT ?? "kurohanpen-devfest26",
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",
});

// Gemini を呼ぶのは、必ずここを通す（AI を止める印と、1日の上限を確かめる）
async function generate(params: Parameters<typeof ai.models.generateContent>[0]) {
  await reserveAiCall();
  return ai.models.generateContent(params);
}

// 画像の読み取りは精度を優先、題名だけの分類は安さを優先
const VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash";
const CLASSIFY_MODEL = process.env.GEMINI_CLASSIFY_MODEL ?? "gemini-3.1-flash-lite";

// ジャンルではなく細かい話題を選ばせ、ジャンルは話題から決める
const LABEL_GUIDE =
  "話題（topic）は次の id から1つ選んでください（「ジャンル.話題」の形です）。\n" +
  TOPIC_GUIDE +
  "\n【2ch】【スレ】【ゆっくり】など、掲示板やネットの話をまとめた動画は、中身の話題ではなく variety.matome にしてください。" +
  "【海外の反応】の動画は variety.overseas、怖い話・心霊・都市伝説は variety.occult、雑学や豆知識の動画は learning.trivia にしてください。" +
  "アメリカやイギリスなど海外のドラマ（考察・解説を含む）は movie.foreign、アニメの考察だけを anime.theory にしてください。" +
  "生き方・考え方・努力・メンタルについて語る動画は learning.lifehack にしてください。" +
  "\n言語（language）は動画の言語を ja / en / ko / zh / other のどれかで返してください。";

const LANGUAGES = ["ja", "en", "ko", "zh", "other"];

const videoListSchema = {
  type: "object",
  properties: {
    videos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          channel: { type: "string" },
          topic: { type: "string", enum: TOPIC_IDS },
          language: { type: "string", enum: LANGUAGES },
          format: { type: "string", enum: ["short", "long"] },
        },
        required: ["title", "topic"],
      },
    },
  },
  required: ["videos"],
};

function labelled(v: { topic?: string; language?: string }) {
  const topic = v.topic && TOPIC_IDS.includes(v.topic) ? v.topic : "other.other";
  return {
    topic,
    genre: genreOfTopic(topic),
    language: v.language && LANGUAGES.includes(v.language) ? v.language : undefined,
  };
}

function parseVideos(text: string | undefined): Video[] {
  if (!text) return [];
  const data = JSON.parse(text) as {
    videos?: { title: string; channel?: string; topic?: string; language?: string; format?: string }[];
  };
  return (data.videos ?? [])
    .filter((v) => v.title?.trim())
    .map((v) => ({
      title: v.title.trim(),
      channel: v.channel?.trim() || undefined,
      ...labelled(v),
      ...(v.format === "short" || v.format === "long" ? { format: v.format as "short" | "long" } : {}),
    }));
}

// YouTube の画面のスクショから、写っている動画を読み取って話題を付ける
// 同じ画像なら、前に読み取った結果を返す
export async function readScreenshots(images: { data: string; mimeType: string }[]) {
  return remembered("screens", images.map((i) => i.data), () => readScreenshotsNow(images));
}

async function readScreenshotsNow(images: { data: string; mimeType: string }[]) {
  const res = await generate({
    model: VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          ...images.map((img) => ({ inlineData: img })),
          {
            text:
              "これは YouTube（ホーム、ショート、履歴、検索結果など）の画面のスクリーンショットです。" +
              "画面に写っている動画をすべて拾い、題名・チャンネル名・話題・言語を返してください。" +
              "広告、操作ボタン、メニュー、利用者自身のアカウント名は含めないでください。" +
              "題名が途中で切れていても、読める範囲で書いてください。同じ動画が2枚に写っていたら1本にまとめてください。" +
              "「ショート」の段に並ぶ縦長の動画は format を short、ふつうの横長の動画は long にしてください。\n" +
              LABEL_GUIDE,
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: videoListSchema },
  });
  return parseVideos(res.text);
}

// 別の型の人のホーム画面に並びそうな動画を作る（実在の動画ではなくイメージ）。
// 型ごとに同じものを返せば足りるので、サーバーのメモリと Firestore に覚えておく
// （Cloud Run は使われていないと眠ってメモリを忘れるので、Firestore にも置く）
const feedCache = new Map<string, Video[]>();

export async function imagineFeed(code: string, description: string) {
  const hit = feedCache.get(code) ?? (await getFeedDoc<Video>(code.replace(/[/:]/g, "_")).catch(() => null));
  if (hit && hit.length > 0) {
    feedCache.set(code, hit);
    return hit;
  }
  const res = await generate({
    model: CLASSIFY_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `日本に住む人で、YouTube の見方が「${description}」の人がいるとします。` +
              "その人の YouTube のホーム画面に並んでいそうな動画を8本考えてください。" +
              "実在の人物名や実在のチャンネル名は使わず、架空のチャンネル名にしてください。" +
              "題名は YouTube でよく見る書き方にしてください。\n" +
              LABEL_GUIDE,
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: videoListSchema },
  });
  const videos = parseVideos(res.text);
  if (videos.length > 0) {
    feedCache.set(code, videos);
    await saveFeedDoc(code.replace(/[/:]/g, "_"), videos).catch((e) => console.error("saveFeedDoc failed", e));
  }
  return videos;
}

const cardSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string", enum: TOPIC_IDS },
          titles: { type: "array", items: { type: "string" } },
        },
        required: ["topic", "titles"],
      },
    },
  },
  required: ["items"],
};

// スワイプ診断のカードの題名を、話題ごとに作る（実在の動画ではなく、ありそうな題名）。
// 一度作ったら Firestore に置いて使い回す
export async function swipeCardTitles(): Promise<Record<string, string[]>> {
  const saved = await getFeedDoc<{ topic: string; titles: string[] }>("swipe-cards").catch(() => null);
  // 一度作った題名を使い続ける（あとから足した話題の題名は、swipe-deck の ADDED_TITLES が埋める）
  if (saved && saved.length > 0) {
    return Object.fromEntries(saved.map((s) => [s.topic, s.titles]));
  }
  const batches = [TOPICS.slice(0, 70), TOPICS.slice(70)];
  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await generate({
        model: CLASSIFY_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "YouTube のおすすめに流れてきそうな動画の題名を、次の話題それぞれに2つずつ考えてください。" +
                  "日本の YouTube でよく見る書き方で、20〜30文字くらい。実在の人物名・チャンネル名・作品名は使わないでください。\n" +
                  batch.map((t) => `${t.id}: ${t.label}`).join("\n"),
              },
            ],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema: cardSchema },
      });
      return (JSON.parse(res.text ?? "{}") as { items?: { topic: string; titles: string[] }[] }).items ?? [];
    }),
  );
  const items = results.flat().filter((it) => TOPIC_IDS.includes(it.topic) && it.titles?.length);
  if (items.length > 0) await saveFeedDoc("swipe-cards", items).catch((e) => console.error("save swipe-cards failed", e));
  return Object.fromEntries(items.map((s) => [s.topic, s.titles]));
}

const labelListSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          topic: { type: "string", enum: TOPIC_IDS },
          language: { type: "string", enum: LANGUAGES },
        },
        required: ["n", "topic"],
      },
    },
  },
  required: ["items"],
};

// 題名とチャンネル名だけから、話題と言語を付ける。
// 題名を書き写させると言い換えてしまうので、番号と話題だけ返させて、題名はこちらで持つ
export async function classifyVideos(videos: { title: string; channel?: string }[]): Promise<Video[]> {
  return remembered("classify", videos, () => classifyNow(videos));
}

async function classifyNow(videos: { title: string; channel?: string }[]): Promise<Video[]> {
  if (videos.length === 0) return [];
  const list = videos
    .map((v, i) => `${i + 1}. ${v.title}${v.channel ? ` ／ ${v.channel}` : ""}`)
    .join("\n");
  const res = await generate({
    model: CLASSIFY_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "次の YouTube 動画（番号. 題名 ／ チャンネル名）それぞれに話題と言語を付け、" +
              "番号 n と一緒に全件返してください。\n" +
              LABEL_GUIDE +
              "\n\n" +
              list,
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: labelListSchema },
  });
  const items =
    (JSON.parse(res.text ?? "{}") as { items?: { n: number; topic?: string; language?: string }[] }).items ?? [];
  const byNumber = new Map(items.map((it) => [it.n, it]));
  return videos.map((v, i) => ({ title: v.title, channel: v.channel, ...labelled(byNumber.get(i + 1) ?? {}) }));
}

// YouTube に見えていそうな「あなた」：ホームに並んだ動画から、どんな人に見えていそうかを想像する（YouTube の実際の判断ではない）。
// 題名は推定に使うだけで保存しない。性別や健康など、決めつけると人を傷つけることは推定させない
const personaSchema = {
  type: "object",
  properties: {
    oneLiner: { type: "string" },
    age: { type: "integer" },
    guesses: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, guess: { type: "string" }, because: { type: "string" } },
        required: ["label", "guess", "because"],
      },
    },
  },
  required: ["oneLiner", "age", "guesses"],
};

export type Persona = { oneLiner: string; age?: number; guesses: { label: string; guess: string; because: string }[] };

// 同じ動画の組み合わせなら、前の推定を返す（見るたびに年齢が変わらないように）
export async function guessPersona(videos: { title: string; topic?: string; frequency?: string }[]): Promise<Persona> {
  return remembered("persona", videos, () => personaNow(videos));
}

async function personaNow(videos: { title: string; topic?: string; frequency?: string }[]): Promise<Persona> {
  const list = videos
    .slice(0, 40)
    .map((v) => `・${v.title}${v.topic ? `（${topicLabel(v.topic)}）` : ""}${v.frequency === "often" ? "［ほぼ毎日流れてくる］" : ""}`)
    .join("\n");
  const res = await generate({
    model: VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "あなたは YouTube のおすすめを決めるアルゴリズムです。ある人のホーム画面に、次の動画を並べました。\n" +
              list +
              "\n\nあなたがこの人を「どんな人だ」と思ってこれを並べているのかを、本人に向けて率直に書いてください。\n" +
              "age は、並んだ動画から思い浮かぶこの人の年齢を、1つの整数で（ぼかさず、動画の傾向そのままに）。" +
              "guesses は次の5つを、この順で：年齢、仕事・立場、性格、いまハマっていること、気にしていること。" +
              "年齢は「42歳」のように1つの数で、仕事・立場は「中小企業の社長」「看護学生」のように具体的に1つに決めてください。本当の年齢や仕事に合わせようとせず、動画から見える姿をそのまま書いてください。" +
              "guess は「〜に見えていそうです」で終わる1文（例：「40代の会社員に見えていそうです」）。because は、アルゴリズムの立場で「「（動画の題名）」を並べたから」の形にして、そう思った理由になった動画を1つ挙げて短く書く（本人が実際に見たかは分からないので「見ているから」とは書かない）。" +
              "oneLiner は「42歳・〇〇の社長で、〜な人」のように、年齢と仕事・立場を入れて、この人を一言で言う形で、25〜45字。少しくすっと笑えるくらいの率直さにする。\n" +
              "性別、病気や体のこと、宗教、政治の立場、恋愛や性のこと、お金の多さは推定しないでください。悪口や見下す言い方はしないでください。" +
              "並んだ動画から言えないことは書かないでください。絵文字は使わないでください。",
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: personaSchema },
  });
  const data = JSON.parse(res.text ?? "{}") as Partial<Persona>;
  const age = typeof data.age === "number" && data.age >= 5 && data.age <= 100 ? Math.round(data.age) : undefined;
  return { oneLiner: data.oneLiner?.trim() ?? "", age, guesses: (data.guesses ?? []).slice(0, 5) };
}

// 外への1本：好きな話題とつながる「いつもは出てこない話題」を Gemini が選び、選んだ理由と、探す言葉を返す。
// 決まったルールでは「好きな話題から、どの外の話題なら興味を持てそうか」を決められないので、ここに AI を使う
export type { OutsidePick };

// titles：候補の話題ごとに、勧める動画の題名（わかっているものだけ）。題名を見て、理由と動画がずれないように選ぶ
export async function pickOutside(likes: string[], candidates: string[], titles: Record<string, string> = {}): Promise<OutsidePick[]> {
  // v: 頼み方を変えたら上げる（古い頼み方の返事を覚え置きから返さないため）
  return remembered("outside", { v: 2, likes, candidates, titles }, () => pickOutsideNow(likes, candidates, titles));
}

async function pickOutsideNow(likes: string[], candidates: string[], titles: Record<string, string>): Promise<OutsidePick[]> {
  const res = await generate({
    model: VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "ある人の YouTube のおすすめには、次の話題がよく出てきます（好きな話題）。\n" +
              likes.map((t) => `・${topicLabel(t)}`).join("\n") +
              "\n\n次の話題は、この人のおすすめに出てこない話題です（候補）。\n" +
              candidates.map((t) => `・${t}：${topicLabel(t)}${titles[t] ? `（勧める動画「${titles[t]}」）` : ""}`).join("\n") +
              "\n\nこの人が、いつものおすすめの外へ1歩を出したくなるように、候補から5つを選んでください。" +
              "好きな話題とのつながりがあって、見てみたいと思える話題を選びます。勧める動画が書いてある候補は、その動画を見たくなるかでも判断し、あおる題名・内輪の話・まとめの寄せ集めに見える動画の候補は選ばないでください。ただし、5つのジャンルはできるだけ違うものにしてください。\n" +
              "つながりは、好きな話題とその候補（動画）に共通する具体的なもの（題材・技・楽しみ方のどれか1つ）で説明できるものにし、こじつけに見えるつながりしか書けない候補は選ばないでください。〇〇には、その候補にいちばん近い好きな話題を選びます。\n" +
              "topic は候補の id。reason は「〇〇が好きなら、〜」の形で、共通するものを入れて30字以内で書く（〇〇は好きな話題の名前）。勧める動画が書いてある候補では、reason をその動画の中身と合うように書く。" +
              "query は、その話題で落ち着いて楽しめる良い動画が見つかる YouTube の検索の言葉を、日本語で2〜4語。" +
              "事件・事故・性・暴力・病気・政治の対立・あおる言葉が入る検索の言葉にはしない。絵文字は使わない。",
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: outsideSchema(candidates) },
  });
  const data = JSON.parse(res.text ?? "{}") as { picks?: Partial<OutsidePick>[] };
  return cleanPicks(data.picks, candidates);
}

function outsideSchema(candidates: string[]) {
  return {
    type: "object",
    properties: {
      picks: {
        type: "array",
        items: {
          type: "object",
          properties: { topic: { type: "string", enum: candidates }, reason: { type: "string" }, query: { type: "string" } },
          required: ["topic", "reason", "query"],
        },
      },
    },
    required: ["picks"],
  };
}
