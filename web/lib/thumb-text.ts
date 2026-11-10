// カードのサムネに重ねる文字を、題名から短く抜き出す（本物の YouTube のサムネのように、大きな文字で一言）。
// 画像モデルに日本語を書かせると崩れるので、画像は文字なしで作り、文字はここで重ねる。
//   「【海外の反応】日本のコンビニに驚く外国人」 → tag「海外の反応」・main「日本のコンビニに驚く」
//   「伏線回収が凄い！考察が楽しいおすすめ映画」 → main「伏線回収が凄い！」
const MAX = 12;

const segmenter = () =>
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("ja", { granularity: "word" }) : null;

// 長いときは、意味が切れない所で切る。動詞・形容詞の終わり（る・た・い・う・く）を優先し、なければ単語の切れ目
function cutAtWord(text: string, max: number) {
  if (text.length <= max) return text;
  for (let p = max; p >= 5; p--) if ("るたいうく".includes(text[p - 1]) && !"るたいうく".includes(text[p] ?? "")) return text.slice(0, p);
  const seg = segmenter();
  if (!seg) return text.slice(0, max);
  let out = "";
  for (const { segment } of seg.segment(text)) {
    if ((out + segment).length > max) break;
    out += segment;
  }
  // 助詞で終わると落ち着かないので、1字なら落とす
  return (out.length > 5 && "がをにでとはのも".includes(out[out.length - 1]) ? out.slice(0, -1) : out) || text.slice(0, max);
}

export function thumbText(title: string): { tag?: string; main: string; accent?: string } {
  const bracket = title.match(/^【([^】]+)】\s*(.*)$/);
  const tag = bracket?.[1];
  const rest = (bracket ? bracket[2] : title).trim();
  // 最初の「！」「？」「、」までを一言にする（記号は残す）
  const first = rest.match(/^(.+?[！!？?])/)?.[1] ?? rest.split(/[、。｜|]/)[0];
  const main = cutAtWord(first, MAX);
  // 最後の「の・を・で・が・に・は・も・と」のあとから、黄色で強調する（サムネでよくある形）
  //   「初心者でも｜無双できる」「伏線回収が｜凄い！」「サッカーの神｜プレー集」…ではなく「サッカーの｜神プレー集」
  const split = main.match(/^(.*[のをでがにはもと])([^ぁ-ゟ].+)$/);
  if (split) return { tag, main: split[1], accent: split[2] };
  return { tag, main };
}
