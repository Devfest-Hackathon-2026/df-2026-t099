// 試作用のサンプルの診断結果を Firestore に入れる（sample: true の印つき）。
// 同世代・地域との比較は人数が集まるまで出ないので、画面を作るために使う。実際の人のデータではない。
//   入れる:  node scripts/seed-sample.mjs
//   消す:    node scripts/seed-sample.mjs --delete
import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "kurohanpen-devfest26" });
const col = db.collection("diagnoses");

if (process.argv.includes("--delete")) {
  const snap = await col.where("sample", "==", true).get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`deleted ${snap.size} sample docs`);
  process.exit(0);
}

const AGE = {
  "10代": { game: 5, anime: 4, music: 4, variety: 3, vlog: 2, sports: 1, learning: 1 },
  "20代": { vlog: 4, variety: 3, music: 3, beauty: 3, game: 3, food: 2, money: 2, travel: 1 },
  "30代": { money: 4, food: 4, learning: 3, news: 2, hobby: 2, animal: 2, travel: 2, vlog: 1 },
  "40代": { news: 4, hobby: 3, vehicle: 3, food: 3, money: 2, sports: 2, movie: 1 },
  "50代以上": { news: 5, travel: 4, animal: 3, music: 3, food: 2, learning: 2, sports: 1 },
};
const REGION = {
  "北海道・東北": { travel: 2, animal: 2, food: 1 },
  関東: { news: 2, money: 2, beauty: 1 },
  中部: { vehicle: 2, hobby: 2, sports: 1 },
  近畿: { variety: 3, food: 1 },
  "中国・四国": { travel: 2, food: 2 },
  "九州・沖縄": { food: 2, travel: 2, sports: 1 },
};

// web/lib/bubble-type.ts の typeOf と同じ計算（スクリプトから TS を読めないので写している）
const LEARN = ["learning", "news", "tech", "money"];
const PEOPLE = ["vlog", "variety", "music", "beauty"];
const THINGS = ["game", "tech", "vehicle", "hobby", "food"];
const REAL = ["sports", "travel", "food", "animal", "vlog"];
const VIRTUAL = ["game", "anime", "movie", "music"];
function typeOf(counts, total) {
  const sum = (ids) => ids.reduce((s, id) => s + (counts[id] ?? 0), 0);
  const top3 = Object.values(counts).sort((a, b) => b - a).slice(0, 3).reduce((s, n) => s + n, 0);
  return [
    top3 / total < 0.7 ? "W" : "F",
    sum(LEARN) / total >= 0.25 ? "L" : "E",
    sum(PEOPLE) >= sum(THINGS) ? "P" : "T",
    sum(REAL) >= sum(VIRTUAL) ? "R" : "V",
  ].join("");
}

function pick(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) if ((r -= w) < 0) return k;
  return entries[0][0];
}

const ages = Object.keys(AGE);
const regions = Object.keys(REGION);
const docs = [];
for (let i = 0; i < 300; i++) {
  const ageBand = ages[i % ages.length];
  const region = regions[Math.floor(Math.random() * regions.length)];
  // 人ごとの好みのばらつき：年代と地域の傾向に、その人だけの好きなジャンルを1つ足す
  const personal = pick({ game: 1, music: 1, sports: 1, food: 1, anime: 1, tech: 1, travel: 1, beauty: 1 });
  const weights = { ...AGE[ageBand] };
  Object.entries(REGION[region]).forEach(([k, w]) => (weights[k] = (weights[k] ?? 0) + w));
  weights[personal] = (weights[personal] ?? 0) + 4;
  const total = 20 + Math.floor(Math.random() * 40);
  const counts = {};
  for (let n = 0; n < total; n++) {
    const g = pick(weights);
    counts[g] = (counts[g] ?? 0) + 1;
  }
  docs.push({ counts, total, type: typeOf(counts, total), ageBand, region, sample: true, createdAt: new Date() });
}

const batch = db.batch();
docs.forEach((d) => batch.set(col.doc(), d));
await batch.commit();
console.log(`added ${docs.length} sample docs`);
