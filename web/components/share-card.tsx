"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import { typeName } from "@/lib/bubble-type";
import { TOPICS } from "@/lib/topics";

// 結果を1枚の画像にして、保存・共有できるようにする（SNS のストーリーに合う縦長）。
// 画像はこの端末の中で描くだけで、サーバーには送らない
const W = 1080;
const H = 1920;
const FONT = '"Meiryo UI", "Meiryo", "Hiragino Sans", sans-serif';

function draw(input: { shown: number; top3: number; coverage: number; watched?: number; type: string; topics: string[]; fogs: string[] }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  const sea = c.createRadialGradient(W / 2, 600, 100, W / 2, 800, 1300);
  sea.addColorStop(0, "#0f3a6b");
  sea.addColorStop(1, "#040a14");
  c.fillStyle = sea;
  c.fillRect(0, 0, W, H);

  // 暗い背景に、出てくる割合と同じ面積の明るい円を描く
  const r = Math.sqrt(((input.coverage / 100) * W * H) / Math.PI);
  const glow = c.createRadialGradient(W / 2, 760, r * 0.2, W / 2, 760, r * 1.2);
  glow.addColorStop(0, "rgba(255,159,10,0.55)");
  glow.addColorStop(1, "rgba(255,159,10,0)");
  c.fillStyle = glow;
  c.beginPath();
  c.arc(W / 2, 760, r * 1.2, 0, Math.PI * 2);
  c.fill();

  c.textAlign = "center";
  c.fillStyle = "#ff9f0a";
  c.font = `bold 40px ${FONT}`;
  c.fillText("わたしの YouTube のおすすめ", W / 2, 200);
  c.fillStyle = "#eaf0f8";
  c.font = `bold 56px ${FONT}`;
  c.fillText(`全部で ${TOPICS.length} ある話題のうち、`, W / 2, 360);
  c.fillText("一度も出てこない話題は約", W / 2, 440);
  c.fillStyle = "#ff9f0a";
  c.font = `bold 260px ${FONT}`;
  c.fillText(`${TOPICS.length - input.shown}`, W / 2, 740);
  c.fillStyle = "#eaf0f8";
  c.font = `bold 64px ${FONT}`;
  c.fillText(`/ ${TOPICS.length}`, W / 2, 850);

  c.fillStyle = "#8b9bb2";
  c.font = `40px ${FONT}`;
  if (input.top3 >= 15) c.fillText(`多い3つの話題が、おすすめの ${input.top3}%`, W / 2, 950);

  // 見方のタイプは、名前を先に、4文字の記号をあとに出す
  c.fillStyle = "#8b9bb2";
  c.font = `38px ${FONT}`;
  c.fillText("見方のタイプ", W / 2, 1080);
  c.fillStyle = "#eaf0f8";
  c.font = `bold 72px ${FONT}`;
  c.fillText(typeName(input.type), W / 2, 1180);
  c.font = `bold 56px ${FONT}`;
  c.fillText(input.type, W / 2, 1270);

  c.fillStyle = "#8b9bb2";
  c.font = `38px ${FONT}`;
  c.fillText(`よく出てくる話題：${input.topics.slice(0, 3).join("・")}`, W / 2, 1420);
  c.fillText(`出てこないジャンル：${input.fogs.slice(0, 3).join("・")}`, W / 2, 1490);

  c.fillStyle = "#eaf0f8";
  c.font = `bold 44px ${FONT}`;
  c.fillText("あなたのおすすめに、出てこない話題はいくつ？", W / 2, 1720);
  c.fillStyle = "#8b9bb2";
  c.font = `32px ${FONT}`;
  c.fillText("バブル診断（試作）", W / 2, 1790);

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

export function ShareCard(props: { shown: number; top3: number; coverage: number; watched?: number; type: string; topics: string[]; fogs: string[] }) {
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator !== "undefined" && "canShare" in navigator;

  async function save() {
    setBusy(true);
    const blob = await draw(props);
    const file = new File([blob], "bubble.png", { type: "image/png" });
    if (canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "バブル診断" }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bubble.png";
      a.click();
      URL.revokeObjectURL(url);
    }
    setBusy(false);
  }

  return (
    <button
      onClick={save}
      disabled={busy}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-bold transition hover:bg-surface-2 disabled:opacity-40"
    >
      {canShare ? <Share2 size={16} aria-hidden /> : <Download size={16} aria-hidden />}
      結果を画像にして{canShare ? "共有する" : "保存する"}
    </button>
  );
}
