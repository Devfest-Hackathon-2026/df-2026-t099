// 共有リンクの OGP 画像（web/app/s/[id]/opengraph-image.tsx）に描く、話題のサムネの JPEG を作る。
// OGP 画像を描く部品（next/og）は WebP を描けないので、web/public/thumbs/*.webp を小さな JPEG にして
// web/public/og-thumbs/ に置く。話題を足したり、サムネを作り直したりしたら、もう一度実行する。
//   node ops/og/make-og-thumbs.mjs
import { mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..", "..", "web");
const pnpm = join(web, "node_modules", ".pnpm");
const sharp = createRequire(import.meta.url)(join(pnpm, readdirSync(pnpm).find((d) => d.startsWith("sharp@")), "node_modules", "sharp"));

const src = join(web, "public", "thumbs");
const out = join(web, "public", "og-thumbs");
mkdirSync(out, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".webp"));
for (const f of files) {
  await sharp(join(src, f)).resize(320, 180, { fit: "cover" }).jpeg({ quality: 72, mozjpeg: true }).toFile(join(out, f.replace(/\.webp$/, ".jpg")));
}
console.log(`web/public/og-thumbs に ${files.length} 枚作りました`);
