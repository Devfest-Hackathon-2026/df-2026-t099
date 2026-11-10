// カードのサムネ画像を、Google の Gemini の画像モデル（Vertex AI）で、話題ごとに1枚作る。
// 一度だけ手元で動かして、web/public/thumbs/<話題の id>.webp に置く（アプリは画像を作らない）。
//
//   node ops/thumbs/make-thumbs.mjs            … まだない話題だけ作る
//   node ops/thumbs/make-thumbs.mjs music.kpop … その話題だけ作り直す
//
// 認証は gcloud のログイン（gcloud auth print-access-token）。キーはリポジトリに置かない。
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..", "..", "web");
// 画像を縮める sharp は、Next.js が入れたものを借りる（このためだけに依存を足さない）
const pnpm = join(web, "node_modules", ".pnpm");
const sharpDir = readdirSync(pnpm).find((d) => d.startsWith("sharp@"));
const sharp = createRequire(import.meta.url)(join(pnpm, sharpDir, "node_modules", "sharp"));

const PROJECT = "kurohanpen-devfest26";
// 1分あたりの回数の上限が小さいので、上限に当たったら次のモデル・地域に替える
const MODELS = [
  ["global", "gemini-3.1-flash-lite-image"],
  ["global", "gemini-2.5-flash-image"],
  ["us-central1", "gemini-2.5-flash-image"],
  ["us-east5", "gemini-2.5-flash-image"],
  ["europe-west4", "gemini-2.5-flash-image"],
];
const OUT = join(web, "public", "thumbs");
const STYLE =
  "Style: eye-catching YouTube video thumbnail, vivid colors, one clear subject, high contrast, landscape 16:9. " +
  "The image must contain absolutely no written words, letters, numbers, captions, signs, labels or logos anywhere. " +
  "People, if any, look Japanese (East Asian) and are not real celebrities or recognizable real people.";

const subjects = JSON.parse(readFileSync(join(here, "subjects.json"), "utf8"));
const only = process.argv.slice(2);
const todo = Object.keys(subjects).filter((id) => (only.length ? only.includes(id) : !existsSync(join(OUT, `${id}.webp`))));
mkdirSync(OUT, { recursive: true });

let token = execSync("gcloud auth print-access-token", { encoding: "utf8", shell: true }).trim();

// 上下に黒い帯（映画のような余白）が付いてくることがあるので、上下とも帯があるときだけ切り落とす
async function cropBars(buf) {
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  const dark = (y) => {
    for (let x = 0; x < info.width; x++) if (data[y * info.width + x] >= 28) return false;
    return true;
  };
  let top = 0;
  while (top < info.height / 3 && dark(top)) top++;
  let bottom = 0;
  while (bottom < info.height / 3 && dark(info.height - 1 - bottom)) bottom++;
  if (top < 6 || bottom < 6) return buf;
  return sharp(buf).extract({ left: 0, top, width: info.width, height: info.height - top - bottom }).toBuffer();
}

let turn = 0;
async function make(id) {
  // 呼び先を順番に回して、1か所に集中させない
  const start = turn++;
  const body = {
    contents: [{ role: "user", parts: [{ text: `${subjects[id]}. ${STYLE}` }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
  };
  for (let attempt = 1; attempt <= 10; attempt++) {
    const [loc, name] = MODELS[(start + attempt - 1) % MODELS.length];
    const model = `${loc}/${name}`;
    const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
    const res = await fetch(
      `https://${host}/v1/projects/${PROJECT}/locations/${loc}/publishers/google/models/${name}:generateContent`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const json = await res.json();
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (part) {
      const webp = await sharp(await cropBars(Buffer.from(part.inlineData.data, "base64"))).resize(640, 360, { fit: "cover" }).webp({ quality: 72 }).toBuffer();
      writeFileSync(join(OUT, `${id}.webp`), webp);
      return `${Math.round(webp.length / 1024)}KB ${model}`;
    }
    console.error(`  ${id} ${model} 失敗 ${attempt}回目: ${JSON.stringify(json).slice(0, 120)}`);
    // 429（回数の上限）のときは、待つ時間をのばしてやり直す
    if (json.error?.code === 401) token = execSync("gcloud auth print-access-token", { encoding: "utf8", shell: true }).trim();
    if (attempt % MODELS.length === 0) await new Promise((r) => setTimeout(r, 10000 * attempt));
  }
  return 0;
}

console.log(`${todo.length} 枚を作ります（${MODELS.map((m) => m.join("/")).join("・")}）`);
const queue = [...todo];
let done = 0;
await Promise.all(
  // 1分あたりの回数に上限があるので、1枚ずつ、少し間をあけて作る
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const size = await make(id);
      done++;
      console.log(`${done}/${todo.length} ${id} ${size || "できず"}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }),
);
