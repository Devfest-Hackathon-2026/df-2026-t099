import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getShareDoc } from "@/lib/share-db";
import { typeName } from "@/lib/bubble-type";
import { GENRES } from "@/lib/genres";
import { genreOfTopic, topicLabel, TOPICS } from "@/lib/topics";

// 共有リンクを SNS や LINE に貼ったときに出る画像（1200×630）。中身は最後のスライドのまとめに合わせる。
// 日本語の字は、Google Fonts から、この画像に使う字だけを切り出した Noto Sans JP を取ってくる
export const alt = "BubbLensの結果のまとめ";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ORANGE = "#ff8d28";

// 同じ字の組み合わせは、取ってきた字をサーバーの中で使い回す（多くなりすぎたら古いものから捨てる）
const fonts = new Map<string, Promise<ArrayBuffer>>();
async function font(text: string, weight: 700 | 900) {
  const key = `${weight}:${text}`;
  let p = fonts.get(key);
  if (!p) {
    p = (async () => {
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
      const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      if (!url) throw new Error("字を取れませんでした");
      const res = await fetch(url);
      if (!res.ok) throw new Error("字を取れませんでした");
      return res.arrayBuffer();
    })();
    p.catch(() => fonts.delete(key));
    fonts.set(key, p);
    if (fonts.size > 200) fonts.delete(fonts.keys().next().value!);
  }
  return p;
}

// next/og は WebP を描けないので、JPEG にしたサムネ（ops/og/make-og-thumbs.mjs で作る）を使う。ないときは灰色の箱にする
const thumb = (topic: string) =>
  readFile(join(process.cwd(), "public", "og-thumbs", `${topic}.jpg`))
    .then((b) => `data:image/jpeg;base64,${b.toString("base64")}`)
    .catch(() => null);

// 結果が見つからないときや、字を取れなかったときは、ふだんの画像（og.png）を返す
async function fallback() {
  const png = await readFile(join(process.cwd(), "public", "og.png"));
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShareDoc(id);
  if (!s) return fallback();

  const who = s.sample ? "見本の人" : "わたし";
  const tint = GENRES.find((g) => g.id === genreOfTopic(s.top[0]))?.color ?? "#1d2b64";
  const labels = s.top.map(topicLabel);
  const lines = {
    brand: "● BubbLens",
    lead: `${who}の YouTube のおすすめに、一度も出てこない話題`,
    top3: s.top3 >= 15 ? `よく出る3つの話題で ${s.top3}%` : "よく出る3つの話題",
    typeHead: "見方のタイプ",
    type: typeName(s.type),
    fog: `おすすめに出てくる話題　約 ${s.kinds} / ${TOPICS.length}`,
    cta: "あなたは？ 1分で調べられます",
  };
  const bold = ["0123456789 ", lines.brand, lines.lead, lines.top3, lines.typeHead, lines.fog, ...labels].join("");
  const black = ["約", String(s.fogCount), `/ ${TOPICS.length}`, lines.type, lines.cta].join("");

  let data: [ArrayBuffer, ArrayBuffer, (string | null)[]];
  try {
    data = await Promise.all([font(bold, 700), font(black, 900), Promise.all(s.top.map(thumb))]);
  } catch {
    return fallback();
  }
  const [f700, f900, thumbs] = data;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "44px 60px",
          color: "#ffffff",
          fontFamily: "Noto Sans JP",
          backgroundColor: "#0b0d12",
          backgroundImage: `radial-gradient(circle at 85% 0%, ${tint}cc, transparent 60%), radial-gradient(circle at 0% 100%, #1d2b64, transparent 70%)`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: ORANGE }}>{lines.brand}</div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.78)" }}>{lines.lead}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 4, fontWeight: 900, lineHeight: 1 }}>
            <span style={{ fontSize: 56 }}>約</span>
            <span style={{ fontSize: 160, color: "#ffffff", margin: "0 14px", letterSpacing: -4 }}>{s.fogCount}</span>
            <span style={{ fontSize: 56 }}>/ {TOPICS.length}</span>
          </div>
          <div style={{ display: "flex", marginTop: 10, fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{lines.top3}</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginRight: 16 }}>{lines.typeHead}</span>
            <span style={{ fontSize: 42, fontWeight: 900 }}>{lines.type}</span>
          </div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{lines.fog}</div>
          <div style={{ display: "flex", marginTop: "auto" }}>
            <div style={{ display: "flex", padding: "12px 28px", borderRadius: 999, backgroundColor: "#ffffff", color: "#0b0d12", fontSize: 30, fontWeight: 900 }}>
              {lines.cta}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, width: 316 }}>
          {thumbs.map((src, i) => (
            <div key={s.top[i]} style={{ display: "flex", position: "relative", width: 316, height: 170, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)" }}>
              {src && (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- OGP 画像の中に描く絵
                <img src={src} width={316} height={170} style={{ position: "absolute", left: 0, top: 0, width: 316, height: 170, objectFit: "cover" }} />
              )}
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "26px 14px 10px",
                  fontSize: 22,
                  fontWeight: 700,
                  backgroundImage: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))",
                }}
              >
                {`${i + 1}  ${labels[i]}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto Sans JP", data: f700, weight: 700, style: "normal" },
        { name: "Noto Sans JP", data: f900, weight: 900, style: "normal" },
      ],
    },
  );
}
