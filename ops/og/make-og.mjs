// SNS に URL を貼ったときに出る画像（OGP、1200×630）を作って web/public/og.png に置く。
// サムネを並べ、色が付いているのは一部だけ（＝おすすめのバブル）、ほかは灰色、という絵にする。
//   node ops/og/make-og.mjs
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..", "..", "web");
const pnpm = join(web, "node_modules", ".pnpm");
const sharp = createRequire(import.meta.url)(join(pnpm, readdirSync(pnpm).find((d) => d.startsWith("sharp@")), "node_modules", "sharp"));

const W = 1200, H = 630;
// 並べる話題（色を付けるのは COLOR のものだけ）
const GRID = [
  "music.kpop", "food.recipe", "sports.soccer",
  "travel.domestic", "game.fps", "anime.season",
  "animal.cat", "tech.gadget", "learning.language",
  "money.invest", "beauty.makeup", "vehicle.train",
];
const COLOR = new Set(["game.fps", "anime.season", "tech.gadget"]);
const TW = 150, TH = 84, GAP = 12, COLS = 3, ROWS = 4;
const gx = W - 48 - (COLS * TW + (COLS - 1) * GAP);
const gy = (H - (ROWS * TH + (ROWS - 1) * GAP)) / 2;
const at = (i) => [gx + (i % COLS) * (TW + GAP), gy + Math.floor(i / COLS) * (TH + GAP)];
// 色の付いたサムネのまわりに、うっすら光の輪（バブル）を置く
const lit = GRID.map((id, i) => (COLOR.has(id) ? at(i) : null)).filter(Boolean);
const cx = lit.reduce((a, [x]) => a + x, 0) / lit.length + TW / 2;
const cy = lit.reduce((a, [, y]) => a + y, 0) / lit.length + TH / 2;

const font = "'Yu Gothic UI', 'Yu Gothic', 'Meiryo', sans-serif";
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0b0d12"/>
  <circle cx="${cx}" cy="${cy}" r="170" fill="#ff9f0a" opacity="0.14"/>
  <g font-family="${font}" font-weight="700" fill="#ffffff">
    <text x="64" y="96" font-size="30" fill="#ff9f0a">● BubbLens</text>
    <text x="64" y="232" font-size="54">あなたのおすすめに、</text>
    <text x="64" y="308" font-size="54">一度も<tspan fill="#ff9f0a" font-size="64">出てこない</tspan></text>
    <text x="64" y="384" font-size="54">話題はいくつ？</text>
    <text x="64" y="500" font-size="26" fill="#a1a1aa" font-weight="400">カードに答えるだけ。登録はいりません。</text>
    <text x="64" y="544" font-size="26" fill="#a1a1aa" font-weight="400">YouTube のおすすめのかたよりを調べます。</text>
  </g>
</svg>`;

const tiles = await Promise.all(
  GRID.map(async (id, i) => {
    let img = sharp(join(web, "public", "thumbs", `${id}.webp`)).resize(TW, TH);
    if (!COLOR.has(id)) img = img.grayscale().linear(0.55, 0);
    const mask = Buffer.from(`<svg width="${TW}" height="${TH}"><rect width="${TW}" height="${TH}" rx="10" fill="#fff"/></svg>`);
    const input = await img.composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    return { input, left: Math.round(at(i)[0]), top: Math.round(at(i)[1]) };
  }),
);

await sharp(Buffer.from(svg)).composite(tiles).png({ compressionLevel: 9, palette: false }).toFile(join(web, "public", "og.png"));
console.log("web/public/og.png を作りました");
