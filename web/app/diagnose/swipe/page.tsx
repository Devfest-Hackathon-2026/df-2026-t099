"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Loader2, Undo2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AnswerMap, type Mark } from "@/components/answer-map";
import { exposureOf } from "@/lib/exposure";
import { toast } from "@/lib/toast";
import { thumbText } from "@/lib/thumb-text";
import { loadDiagnosis, saveDiagnosis } from "@/lib/diagnosis-store";
import { genreOf, type Diagnosis, type GenreId, type Video } from "@/lib/genres";
import { estimateFromSwipes } from "@/lib/estimate";
import { SWIPE_CARDS } from "@/lib/swipe-cards";

// この距離より大きく払ったら答えにする
const THRESHOLD = 90;

type Answer = Pick<Video, "exposure" | "skipReason" | "frequency" | "mood">;

// 1枚ごとに3つから選ぶ：見る／流れてくるけど見ない／そもそも流れてこない。
// 「見ない」を選んだときだけ、ジャンルが合わないのか、この動画が合わないのかを聞く
type Card = { title: string; genre: GenreId; topic: string };

export default function SwipePage() {
  const router = useRouter();
  // カードは 149 の話題（「その他」を除く）からサーバーで引く。「続けて」のときは、前の答えを残して、まだ試していない話題だけ引く
  const [cards, setCards] = useState<Card[] | null>(null);
  const [previous, setPrevious] = useState<Video[]>([]);
  const [keep, setKeep] = useState<Pick<Diagnosis, "prediction" | "corrections" | "outside" | "continues">>({});

  useEffect(() => {
    const more = new URLSearchParams(window.location.search).has("more");
    const before = more ? loadDiagnosis() : null;
    const prev = before?.source === "swipe" ? before.videos : [];
    const kept = before?.source === "swipe" ? { prediction: before.prediction, corrections: before.corrections, outside: before.outside, continues: before.continues ?? before.createdAt } : {};
    fetch("/api/swipe-deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude: prev.map((v) => v.topic).filter(Boolean), all: true }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { cards: Card[] }) => {
        setKeep(kept);
        setPrevious(prev);
        setCards(d.cards.length ? d.cards : SWIPE_CARDS);
      })
      .catch(() => {
        setKeep(kept);
        setPrevious(prev);
        setCards(SWIPE_CARDS);
      });
  }, []);

  if (!cards) {
    return (
      <PageShell compact title="こういう動画は、あなたのおすすめに出てきますか？">
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" aria-hidden />
          カードを用意しています
        </p>
      </PageShell>
    );
  }
  return <Deck cards={cards} previous={previous} keep={keep} onDone={() => router.push("/result")} />;
}

// 推定の幅がこれ以下になったら「精度が十分」と知らせる（ポイント）。これより少なくても、いつでも結果を見られる
// 10 にすると 40 枚以上かかり、初めての人には長すぎるので 15 にした（25〜30 枚ほど。続ければもっと正確になる）
const TARGET_MARGIN = 15;
const MIN_ANSWERS = 12;

const asVideo = (c: Card, a: Answer): Video => ({ title: c.title, genre: c.genre, topic: c.topic, ...a });

// 適応型の診断：いま推定がいちばんぶれているジャンルから、まだ聞いていない話題を1枚選ぶ。
// はっきりしたジャンルはもう聞かず、迷っているジャンルを重点的に聞くので、少ない枚数で幅が狭くなる
function pickNext(pool: Card[], answeredVideos: Video[]): Card | null {
  const asked = new Set(answeredVideos.map((v) => v.topic));
  const left = pool.filter((c) => !asked.has(c.topic));
  if (left.length === 0) return null;
  const { uncertainty } = estimateFromSwipes(answeredVideos);
  const score = (c: Card) => (uncertainty[c.genre] ?? 0) + Math.random() * 1e-6;
  const best = left.reduce((a, b) => (score(b) > score(a) ? b : a));
  const same = left.filter((c) => c.genre === best.genre);
  return same[Math.floor(Math.random() * same.length)];
}

type Dir = "left" | "right" | "up";
// 払う向きと答え：右＝よく出てくる、上＝たまに出てくる、左＝出てこない（「はい」は右、「いいえ」は左、の慣れた形）
const CHOICES = [
  { dir: "left", key: "unseen", label: "出てこない", sub: "ほとんど見かけない", Arrow: ArrowLeft },
  { dir: "up", key: "sometimes", label: "たまに出る", sub: "週に1〜2本", Arrow: ArrowUp },
  { dir: "right", key: "often", label: "よく出る", sub: "ほぼ毎日", Arrow: ArrowRight },
] as const;
const STAMP: Record<Dir, { text: string; className: string }> = {
  right: { text: "よく出る", className: "rotate-[-10deg] border-accent text-accent" },
  up: { text: "たまに出る", className: "border-white text-white" },
  left: { text: "出てこない", className: "rotate-[10deg] border-sky-300 text-sky-300" },
};
// 初めての人に、払い方を実際に動かして見せる（右 → 上 → 左）
const DEMO: { dir: Dir; text: string }[] = [
  { dir: "right", text: "右に払うと「よく出る」（ほぼ毎日）" },
  { dir: "up", text: "上に払うと「たまに出る」（週に1〜2本）" },
  { dir: "left", text: "左に払うと「出てこない」" },
];
const DEMO_KEY = "bubble-swipe-howto";

function dirOf(dx: number, dy: number): Dir | null {
  if (dy < -30 && Math.abs(dy) > Math.abs(dx)) return "up";
  if (dx > 30) return "right";
  if (dx < -30) return "left";
  return null;
}

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {}
};

function Deck({
  cards,
  previous,
  keep,
  onDone,
}: {
  cards: Card[];
  previous: Video[];
  keep: Pick<Diagnosis, "prediction" | "corrections" | "outside" | "continues">;
  onDone: () => void;
}) {
  const [answered, setAnswered] = useState<Video[]>([]);
  const [card, setCard] = useState<Card | null>(() => pickNext(cards, previous));
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [leaving, setLeaving] = useState<Dir | null>(null);
  // 1段目で「よく／たまに出る」を選んだら、2段目で「見るか」を聞く
  const [asking, setAsking] = useState<"often" | "sometimes" | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  // 払い方の見本（初めての人だけ。null＝見本は出さない）
  const [demo, setDemo] = useState<number | null>(null);
  const [latest, setLatest] = useState<string | undefined>();

  // 次のカードを先に決めて、サムネ画像を読み込んでおく（回線が遅くても、次のカードの画像がすぐ出る）。
  // 次のカードは答えで変わるので、「出てこない」「見る」「見ない」の3通りぶん用意する（よく／たまに、の違いでは選び直さない）
  const ahead = useMemo(() => {
    if (!card) return null;
    const base = [...previous, ...answered];
    const pick = (a: Answer) => pickNext(cards, [...base, asVideo(card, a)]);
    return {
      unseen: pick({ exposure: "unseen" }),
      watched: pick({ exposure: "watched", frequency: "sometimes" }),
      skipped: pick({ exposure: "skipped", frequency: "sometimes" }),
    };
  }, [card, answered, previous, cards]);
  useEffect(() => {
    if (!ahead) return;
    for (const c of new Set(Object.values(ahead))) if (c) new Image().src = `/thumbs/${c.topic}.webp`;
  }, [ahead]);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(DEMO_KEY) === "1";
    } catch {}
    if (!seen && previous.length === 0) setTimeout(() => setDemo(0), 600);
  }, [previous.length]);

  // 見本：カードを少し払って戻す、を3方向くり返す
  useEffect(() => {
    if (demo === null || demo >= DEMO.length) return;
    const d = DEMO[demo].dir;
    const t1 = setTimeout(() => {
      setDx(d === "right" ? 110 : d === "left" ? -110 : 0);
      setDy(d === "up" ? -110 : 0);
    }, 250);
    const t2 = setTimeout(() => {
      setDx(0);
      setDy(0);
    }, 1450);
    const t3 = setTimeout(() => setDemo(demo + 1), 1800);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [demo]);

  function endDemo() {
    setDemo(null);
    setDx(0);
    setDy(0);
    try {
      localStorage.setItem(DEMO_KEY, "1");
    } catch {}
  }

  function next(answer: Answer, direction: Dir) {
    if (leaving) return;
    if (demo !== null) endDemo();
    buzz(12);
    setAsking(null);
    setLeaving(direction);
    setTimeout(() => {
      const done = [...answered, asVideo(card!, answer)];
      setAnswered(done);
      setLatest(card!.topic);
      setLeaving(null);
      setDx(0);
      setDy(0);
      const all = [...previous, ...done];
      const wasPrecise = [...previous, ...answered].length >= MIN_ANSWERS && estimateFromSwipes([...previous, ...answered]).margin <= TARGET_MARGIN;
      if (all.length === MIN_ANSWERS) toast("結果を見られるようになりました。続けるほど正確になります");
      else if (!wasPrecise && all.length > MIN_ANSWERS && estimateFromSwipes(all).margin <= TARGET_MARGIN)
        toast("十分に正確になりました。いつでも結果を見られます");
      const e = answer.exposure;
      const following = (e === "unseen" || e === "watched" || e === "skipped" ? ahead?.[e] : null) ?? pickNext(cards, all);
      if (following) {
        setCard(following);
        return;
      }
      finish(done);
    }, 260);
  }

  const unseen = () => next({ exposure: "unseen" }, "left");
  const freqDir = (): Dir => (asking === "often" ? "right" : "up");
  const watch = () => next({ exposure: "watched", frequency: asking! }, freqDir());
  const watchByMood = () => next({ exposure: "watched", frequency: asking!, mood: true }, freqDir());
  const skip = (skipReason?: "genre" | "title") => next({ exposure: "skipped", frequency: asking!, skipReason }, freqDir());
  function choose(key: (typeof CHOICES)[number]["key"]) {
    if (demo !== null) endDemo();
    if (key === "unseen") unseen();
    else {
      buzz(8);
      setAsking(key);
    }
  }

  // 払い間違えたときに、直前の1枚に戻す
  function undo() {
    const last = answered[answered.length - 1];
    if (!last || leaving) return;
    setAnswered(answered.slice(0, -1));
    setCard({ title: last.title, genre: last.genre, topic: last.topic ?? "" });
    setLatest(undefined);
    setAsking(null);
  }

  // パソコンでは矢印キーでも答えられる（→ よく、↑ たまに、← 出てこない。2段目は Enter で見る）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;
      if (asking) {
        if (e.key === "Enter") watch();
        if (e.key === "Escape") setAsking(null);
        return;
      }
      if (e.key === "ArrowRight") choose("often");
      if (e.key === "ArrowUp") choose("sometimes");
      if (e.key === "ArrowLeft") choose("unseen");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function finish(done: Video[]) {
    saveDiagnosis("swipe", [...previous, ...done], keep);
    onDone();
  }

  const all = [...previous, ...answered];
  const est = estimateFromSwipes(all);
  const enough = all.length >= MIN_ANSWERS;
  const precise = enough && est.margin <= TARGET_MARGIN;
  // 精度メーター：幅が ±40 ポイントから目標まで狭くなる様子
  const meter = all.length === 0 ? 0 : Math.max(0, Math.min(1, (40 - est.margin) / (40 - TARGET_MARGIN)));
  // 「誤差 ±18 ポイント」のような数字は初めての人には分からないので、言葉で伝える（数字は「しくみ」の画面で説明する）
  const precisionWord =
    all.length === 0 ? "まだ答えていません" : precise ? "十分に正確です" : meter < 0.4 ? "まだ大まかです" : meter < 0.8 ? "だんだん正確になっています" : "あと少しで十分です";
  const marks = new Map<string, Mark>();
  all.forEach((v) => v.topic && marks.set(v.topic, exposureOf(v) === "watched" ? "watched" : exposureOf(v) === "unseen" ? "unseen" : "skipped"));

  if (!card) {
    return (
      <PageShell title="すべての話題に答えました">
        <button onClick={() => finish([])} className="inline-flex min-h-11 items-center font-bold text-accent">
          結果を見る
        </button>
      </PageShell>
    );
  }
  const genre = genreOf(card.genre);
  const thumb = thumbText(card.title);
  const offsetX = leaving === "right" ? 520 : leaving === "left" ? -520 : dx;
  const offsetY = leaving === "up" ? -640 : Math.min(0, dy);
  const showing = leaving ?? dirOf(dx, dy);
  // 払った距離に合わせて、スタンプが濃く・大きくなる
  const strength = Math.min(1, Math.max(Math.abs(dx), Math.abs(Math.min(0, dy))) / THRESHOLD);

  return (
    <PageShell compact title="こういう動画は、あなたのおすすめに出てきますか？">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3 rounded-(--r-inner) bg-surface px-3 py-2 text-muted">
          <AnswerMap marks={marks} latest={latest} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-foreground">あなたのおすすめの地図</p>
            <p className="num mt-0.5 text-xs">
              {all.length} 枚・{precisionWord}
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${meter * 100}%` }} />
            </span>
          </div>
        </div>

        <div className="relative mt-4">
          <div className="absolute inset-x-6 -bottom-3 top-3 rounded-(--r-tile) bg-surface-2/60" aria-hidden />
          <div
            key={card.topic}
            className="card-in relative touch-none select-none overflow-hidden rounded-(--r-card) bg-surface shadow-2xl"
            style={{
              transform: `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX / 22}deg)`,
              transition: drag === null ? `transform ${demo !== null ? "0.6s cubic-bezier(.3,.7,.3,1)" : "0.26s ease-out"}` : "none",
            }}
            onPointerDown={(e) => {
              if (asking) return;
              if (demo !== null) endDemo();
              setDrag({ x: e.clientX, y: e.clientY });
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag) return;
              const nx = e.clientX - drag.x;
              const ny = e.clientY - drag.y;
              // 答えが決まる距離を越えた瞬間に、手ごたえを返す
              const was = Math.max(Math.abs(dx), -dy) > THRESHOLD;
              const now = Math.max(Math.abs(nx), -ny) > THRESHOLD;
              if (now && !was) buzz(6);
              setDx(nx);
              setDy(ny);
            }}
            onPointerUp={() => {
              setDrag(null);
              const d = Math.max(Math.abs(dx), -dy) > THRESHOLD ? dirOf(dx, dy) : null;
              if (d === "left") return unseen();
              if (d) {
                buzz(8);
                setAsking(d === "right" ? "often" : "sometimes");
              }
              setDx(0);
              setDy(0);
            }}
          >
            <div className="relative aspect-video overflow-hidden" style={{ background: `radial-gradient(120% 120% at 20% 0%, ${genre.color}, #0b1626 75%)` }}>
              {/* 話題ごとのサムネ（Google の Gemini の画像モデルで作った。動画そのものではない） */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/thumbs/${card.topic}.webp`}
                alt=""
                className="absolute inset-0 size-full object-cover"
                draggable={false}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" aria-hidden />
              {/* サムネの文字（題名から抜き出した一言） */}
              <div className="pointer-events-none absolute inset-x-3 top-3 -rotate-2" aria-hidden>
                {thumb.tag && <span className="inline-block rounded-md bg-[#e3001b] px-2 py-0.5 text-[13px] font-black text-white">{thumb.tag}</span>}
                <p className="thumb-text mt-1 text-[clamp(22px,7.4vw,30px)] font-black leading-[1.15]">
                  {thumb.main}
                  {thumb.accent && <span className="text-[#ffe600]">{thumb.accent}</span>}
                </p>
              </div>
              {/* 払っている向きの色をうっすら重ねる */}
              {showing && (
                <span
                  className="absolute inset-0"
                  style={{
                    background: showing === "right" ? "var(--accent)" : showing === "left" ? "#0b1626" : "#ffffff",
                    opacity: (leaving ? 1 : strength) * 0.35,
                  }}
                  aria-hidden
                />
              )}
              <span className="absolute bottom-3 left-4 rounded-full bg-black/45 px-3 py-1 text-xs text-white backdrop-blur">{genre.label}</span>
              {showing && (
                <span
                  className={`absolute inset-0 m-auto h-fit w-fit rounded-xl border-4 bg-black/45 px-4 py-1.5 text-2xl font-black backdrop-blur-sm ${STAMP[showing].className}`}
                  style={{ opacity: leaving ? 1 : 0.35 + strength * 0.65, scale: String(0.85 + (leaving ? 1 : strength) * 0.25) }}
                >
                  {STAMP[showing].text}
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="text-lg font-bold leading-snug">{card.title}</p>
            </div>

            {/* 2段目：出てきたら見るか。見ないときは理由（ジャンルは好きでも、この動画だけ合わないことがある） */}
            {asking && (
              <div className="absolute inset-0 flex flex-col justify-end gap-2 bg-background/90 p-5 backdrop-blur">
                <p className="text-xs text-muted">{asking === "often" ? "よく出る（ほぼ毎日）" : "たまに出る（週に1〜2本）"}</p>
                <p className="mb-1 text-sm font-bold">出てきたら、見ますか？</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={watch} className="h-12 rounded-xl bg-accent text-sm font-bold text-accent-ink">
                    見る
                  </button>
                  <button
                    onClick={watchByMood}
                    className="h-12 rounded-xl border border-accent/60 text-xs font-bold leading-tight text-accent"
                  >
                    気分しだいで見る
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => skip("genre")} className="h-12 rounded-xl bg-surface-2 text-xs font-bold leading-tight">
                    見ない
                    <br />
                    このジャンルに興味がない
                  </button>
                  <button onClick={() => skip("title")} className="h-12 rounded-xl bg-surface-2 text-xs font-bold leading-tight">
                    見ない
                    <br />
                    この動画だけ合わない
                  </button>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setAsking(null)} className="h-11 px-2 text-xs text-muted">
                    選び直す
                  </button>
                  <button onClick={() => skip()} className="h-11 px-2 text-xs text-muted">
                    見ない（なんとなく）
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 払い方の見本の説明。見本の間は、下のボタンの代わりに出す */}
        {demo !== null ? (
          <div className="mt-6 rounded-(--r-inner) bg-surface p-4 text-center">
            <p className="text-xs text-muted">答え方</p>
            <p className="mt-1 min-h-6 font-bold" aria-live="polite">
              {demo < DEMO.length ? DEMO[demo].text : "カードを指で払うか、下のボタンを押して答えます"}
            </p>
            <button onClick={endDemo} className="mt-3 inline-flex h-11 items-center rounded-full bg-accent px-7 text-sm font-bold text-accent-ink">
              やってみる
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {CHOICES.map(({ key, label, sub, Arrow, dir }) => (
              <button
                key={key}
                onClick={() => choose(key)}
                disabled={!!asking}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-(--r-inner) px-1 text-center transition active:scale-95 disabled:opacity-40 ${
                  dir === "right" ? "bg-accent text-accent-ink" : "bg-surface-2"
                } ${showing === dir ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
              >
                <Arrow size={18} aria-hidden />
                <span className="text-sm font-bold">{label}</span>
                <span className={`text-[11px] ${dir === "right" ? "opacity-85" : "text-muted"}`}>{sub}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={undo}
            disabled={answered.length === 0}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted disabled:opacity-35"
          >
            <Undo2 size={15} aria-hidden />
            1枚前に戻る
          </button>
          <button
            onClick={() => finish(answered)}
            disabled={!enough}
            className={`inline-flex h-11 items-center rounded-full px-6 text-sm font-bold transition disabled:opacity-35 ${precise ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}
          >
            ここで結果を見る
          </button>
        </div>
        {!enough && <p className="mt-2 text-center text-xs text-muted">あと {MIN_ANSWERS - all.length} 枚答えると、結果を見られます</p>}
        {demo === null && !asking && (
          <button onClick={() => setDemo(0)} className="mx-auto block min-h-11 text-xs text-muted underline-offset-2 hover:underline">
            答え方を見る
          </button>
        )}
      </div>
    </PageShell>
  );
}
