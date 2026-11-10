// 「YouTube に見えていそうなあなた」を、SNS のストーリーに貼れる縦長の画像（1080×1920）にする。
// 画像はこの端末の中で描くだけで、サーバーには送らない
const W = 1080;
const H = 1920;
const FONT = '-apple-system, "Hiragino Sans", "Noto Sans JP", "Meiryo UI", sans-serif';
const ORANGE = "#ff9f0a";

// 日本語は単語の間に空白がないので、1文字ずつ足して、幅を超えたら次の行にする
function wrap(c: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (c.measureText(line + ch).width > maxWidth && line) {
      // 句読点や閉じかっこは、行の頭に来ないように前の行に付ける
      if ("、。」』）！？".includes(ch)) {
        line += ch;
        continue;
      }
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawPersonaImage(input: {
  oneLiner: string;
  youtubeAge?: number;
  realAge?: number;
  hits?: number;
  misses?: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  c.fillStyle = "#000000";
  c.fillRect(0, 0, W, H);
  c.textAlign = "center";

  c.fillStyle = "#98989d";
  c.font = `600 44px ${FONT}`;
  c.fillText("YouTube に見えていそうな、わたし", W / 2, 260);

  // 一言（いちばん大きく）
  c.fillStyle = "#f5f5f7";
  c.font = `bold 80px ${FONT}`;
  const lines = wrap(c, `「${input.oneLiner}」`, W - 160);
  const top = 480;
  lines.slice(0, 5).forEach((l, i) => c.fillText(l, W / 2, top + i * 108));
  let y = top + Math.min(lines.length, 5) * 108 + 40;

  c.fillStyle = "#98989d";
  c.font = `44px ${FONT}`;
  c.fillText("だと思われているらしい", W / 2, y);
  y += 160;

  // 年齢のずれ（本当の年齢を入れたときだけ）
  if (input.youtubeAge) {
    c.fillStyle = "#98989d";
    c.font = `40px ${FONT}`;
    c.fillText("YouTube の中のわたしは", W / 2, y);
    c.fillStyle = ORANGE;
    c.font = `bold 200px ${FONT}`;
    c.fillText(`${input.youtubeAge}歳`, W / 2, y + 210);
    y += 290;
    if (input.realAge) {
      const gap = input.youtubeAge - input.realAge;
      c.fillStyle = "#f5f5f7";
      c.font = `bold 52px ${FONT}`;
      c.fillText(
        gap === 0 ? `本当の年齢（${input.realAge}歳）と同じ` : `本当は${input.realAge}歳。${Math.abs(gap)}歳${gap > 0 ? "年上" : "年下"}に見られている`,
        W / 2,
        y,
      );
      y += 120;
    }
  }

  // 当たり・違う（答えたときだけ）
  if (input.hits !== undefined && input.misses !== undefined && input.hits + input.misses > 0) {
    c.fillStyle = "#98989d";
    c.font = `44px ${FONT}`;
    c.fillText(`5つの推定のうち、合っている ${input.hits} 個・違う ${input.misses} 個`, W / 2, y);
  }

  c.fillStyle = "#f5f5f7";
  c.font = `bold 48px ${FONT}`;
  c.fillText("あなたは YouTube に、どう思われている？", W / 2, H - 230);
  c.fillStyle = ORANGE;
  c.font = `600 40px ${FONT}`;
  c.fillText("BubbLens", W / 2, H - 160);

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

// 画像を共有する。共有できないブラウザでは、画像を保存する
export async function shareImage(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "image/png" });
  if (typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "BubbLens" }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
