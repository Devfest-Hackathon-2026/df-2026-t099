"use client";

import Link from "next/link";
import { ArrowRight, Footprints, Play } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PageShell, SectionTitle } from "@/components/page-shell";
import { OceanMap } from "@/components/ocean-map";
import { SavePanel } from "@/components/save-panel";
import { ShareCard } from "@/components/share-card";
import { BeyondFog } from "@/components/beyond-fog";
import { ProgressCompare } from "@/components/progress-compare";
import { CorrectionPanel } from "@/components/correction-panel";
import { DeepAnalysis } from "@/components/deep-analysis";
import { TypeCard } from "@/components/type-card";
import { analyze } from "@/lib/bubble-analysis";
import { estimateFromSwipes, usesEstimate } from "@/lib/estimate";
import { metricsFromSwipes, metricsFromVideos, outsideTopics, topicSplit } from "@/lib/feed-metrics";
import { FourNumbers } from "@/components/four-numbers";
import { FormatSplit } from "@/components/format-split";
import { AlgorithmPersona } from "@/components/algorithm-persona";
import { exposureCounts, shownVideos, tasteVideos, titleMisses } from "@/lib/exposure";
import { countTopics, worldCoverage } from "@/lib/bubble-metrics";
import { typeOf } from "@/lib/bubble-type";
import { countGenres } from "@/lib/compare";
import { loadDiagnosis, savePrediction, subscribeDiagnosis } from "@/lib/diagnosis-store";
import { PredictGate, PredictionGap } from "@/components/predict-gate";
import { AnswerThumbs } from "@/components/answer-thumbs";
import { ResultStory } from "@/components/result-story";
import { markOutside, recordEntry, snapshotOf } from "@/lib/history";
import { GENRES, genreOf, type Diagnosis } from "@/lib/genres";
import { TOPICS, genreOfTopic, topicLabel } from "@/lib/topics";

// 見出しの上の1行。何から調べた結果かを、数と単位つきで書く
const EYEBROW: Record<Diagnosis["source"], (n: number) => string> = {
  screenshot: (n) => `スクリーンショットに写った ${n} 本の動画から調べました`,
  url: (n) => `貼ってもらった ${n} 本の動画から調べました`,
  takeout: (n) => `視聴履歴の ${n} 本の動画から調べました`,
  swipe: (n) => `カード ${n} 枚への答えから調べました`,
  sample: (n) => `サンプル（架空の大学2年生）の、カード ${n} 枚への答えです`,
};

// sessionStorage はサーバーでは読めないので、ブラウザで描くときだけ読む
export default function ResultPage() {
  const diagnosis = useSyncExternalStore(subscribeDiagnosis, loadDiagnosis, () => null);

  if (!diagnosis || diagnosis.videos.length === 0) {
    return (
      <PageShell title="まだ診断していません">
        <Link href="/" className="inline-flex min-h-11 items-center font-bold text-accent">
          トップから診断をはじめる
        </Link>
      </PageShell>
    );
  }
  // 結果を見る前に、まず自分で予想してもらう
  // 例の結果は自分のおすすめではないので、予想は聞かない
  if (diagnosis.prediction === undefined) return <PredictGate who={diagnosis.source === "sample" ? "この人" : "あなた"} onDone={savePrediction} />;
  return <Result diagnosis={diagnosis} />;
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <li className="rounded-(--r-card) bg-surface p-4 sm:p-5">
      <p className="text-xs font-bold tracking-wider text-muted">{label}</p>
      <p className="num mt-1.5 text-2xl font-bold sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted sm:text-base">{unit}</span>}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted sm:text-sm">{note}</p>
    </li>
  );
}

function Result({ diagnosis }: { diagnosis: Diagnosis }) {
  // おすすめに出てくる動画（見たかは問わない）と、好みを測る動画（見ている動画）を分ける
  const shown = shownVideos(diagnosis.videos);
  const taste = tasteVideos(diagnosis.videos);
  const ex = exposureCounts(diagnosis.videos);
  const moodCount = diagnosis.videos.filter((v) => v.mood).length;
  const hasExposure = ex.skipped + ex.unseen > 0;
  const misses = titleMisses(diagnosis.videos);
  // スワイプで、まだ試していない話題の数（「その他」は除く）
  const remainingTopics =
    TOPICS.filter((t) => t.genre !== "other").length -
    new Set(diagnosis.videos.map((v) => v.topic).filter((t) => t && !t.startsWith("other"))).size;

  const counts = GENRES.map((g) => ({
    ...g,
    count: shown.filter((v) => v.genre === g.id).length,
  })).sort((a, b) => b.count - a.count);
  const tasteTop = GENRES.map((g) => ({ ...g, count: taste.filter((v) => v.genre === g.id).length })).sort(
    (a, b) => b.count - a.count,
  )[0];

  const unvisited = counts.filter((g) => g.count === 0 && g.id !== "other");
  const topics = countTopics(shown);
  const coverage = worldCoverage(topics);
  const watchedTopics = countTopics(taste);
  const watchedCoverage = worldCoverage(watchedTopics);
  // スワイプは答えた話題から、149 の話題全体を推定する（答えた話題だけだと 24 枚で最大 17.5% にしかならない）
  const est = usesEstimate(diagnosis.source) ? estimateFromSwipes(diagnosis.videos, diagnosis.corrections) : null;
  const headline = est ? est.shown : coverage;
  const watchedHeadline = est ? est.watched : watchedCoverage;
  const topTopics = Object.entries(watchedTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const type = typeOf(taste);
  const axes = analyze(taste);
  // 自分を正確に知るための4つの数字（広さ・注意の広さ・実質の話題の数・上位3つの割合）
  const fm = est ? metricsFromSwipes(diagnosis.videos, diagnosis.corrections) : metricsFromVideos(shown);
  // 外へ出た話題（スライドや「見たことのない話題を1本見てみる」で「見た」を押した話題）。
  // 見出しと4つの数字は、カードの答え（おすすめ）のまま。地図と「外へ出た話題」だけ、外へ出たぶんを足す
  const outside = outsideTopics(diagnosis);
  const addTo = (m: Record<string, number>) => ({ ...m, ...Object.fromEntries(outside.filter((t) => !m[t]).map((t) => [t, 1])) });
  // わたしの記録に、この回を残す（「続けて答える」や直しのときは、同じ回を上書きする）
  const entry = snapshotOf(diagnosis, fm);
  const entryKey = JSON.stringify(entry);
  useEffect(() => {
    recordEntry(JSON.parse(entryKey));
  }, [entryKey]);
  // 結果は、まずスライドで見せる（長い画面を読まなくても分かるように）。同じ診断で一度閉じたら、次からは出さない
  const storyKey = `story-seen:${diagnosis.createdAt}`;
  const [storyStart, setStoryStart] = useState<string | undefined>(undefined);
  const [story, setStory] = useState(() => {
    try {
      return sessionStorage.getItem(storyKey) !== "1";
    } catch {
      return true;
    }
  });
  function closeStory() {
    setStory(false);
    try {
      sessionStorage.setItem(storyKey, "1");
    } catch {}
    window.scrollTo(0, 0);
  }

  return (
    <PageShell
      eyebrow={EYEBROW[diagnosis.source](diagnosis.videos.length)}
      title={
        <>
          {TOPICS.length} の話題のうち、{diagnosis.source === "sample" ? "この人" : "あなた"}のおすすめに
          <br />
          一度も出てこない話題は約
          <span className="num mx-2 text-[1.5em] text-accent">{topicSplit(fm).fog}</span>
        </>
      }
      lead={
        est
          ? `よく出てくると答えた話題は「${fm.top3Topics.map(topicLabel).join("」「")}」です。答えていない話題は、答えから推定しています。`
          : `いちばん多い3つの話題は「${fm.top3Topics.map(topicLabel).join("」「")}」です。読み取った動画だけで数えています。`
      }
    >
      {story && <ResultStory diagnosis={diagnosis} metrics={fm} type={type} start={storyStart} onClose={closeStory} />}
      <button
        onClick={() => {
          setStoryStart(undefined);
          setStory(true);
        }}
        className="mb-6 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-ink"
      >
        <Play size={16} aria-hidden />
        結果をスライドで見る
      </button>
      {/* 初めての人が順に読めるように並べる：数字の意味 → 予想とのずれ → YouTube から見たあなた → 地図 → くわしい結果 → 保存・共有 */}
      <FourNumbers metrics={fm} />
      <Link href="/about" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-accent">
        4つの数字の出し方を見る
        <ArrowRight size={16} aria-hidden />
      </Link>
      {diagnosis.prediction != null && <PredictionGap predicted={diagnosis.prediction} actual={topicSplit(fm).fog} />}
      <ProgressCompare entry={entry} />
      {!est && <FormatSplit videos={shown} />}

      <AlgorithmPersona videos={shown} cacheKey={String(diagnosis.createdAt)} fromAnswers={Boolean(est)} />

      <div className="mt-6">
        <OceanMap
          counts={countGenres(shown)}
          topics={addTo(topics)}
          watched={addTo(watchedTopics)}
          coverage={fm.attention}
          estimate={fm.byGenre}
          outside={outside}
        />
      </div>
      <OutsideSteps
        diagnosis={diagnosis}
        onOpen={() => {
          setStoryStart("playlist");
          setStory(true);
        }}
      />
      {est && (
        <div className="mt-4">
          <CorrectionPanel estimate={est} corrections={diagnosis.corrections ?? {}} />
        </div>
      )}

      {(hasExposure || diagnosis.source === "swipe") && (
        <section className="mt-8">
          <SectionTitle note="カードで答えた動画を、3つに分けて数えました。">カードの答え</SectionTitle>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
            <Stat
              label="見る"
              value={String(ex.watched)}
              unit="本"
              note={
                moodCount > 0
                  ? `おすすめに出てきて、見る動画（そのうち気分しだいで見る動画 ${moodCount}本）`
                  : "おすすめに出てきて、見る動画"
              }
            />
            <Stat label="見ない" value={String(ex.skipped)} unit="本" note="おすすめに出てくるが、見ない動画" />
            <Stat label="出てこない" value={String(ex.unseen)} unit="本" note="おすすめに出てこない動画" />
          </ul>
          <AnswerThumbs videos={diagnosis.videos} who={diagnosis.source === "sample" ? "この人" : "あなた"} />
          {diagnosis.source === "swipe" && remainingTopics > 0 && (
            <Link
              href="/diagnose/swipe?more=1"
              className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-(--r-inner) bg-surface-2 p-4 text-sm transition hover:bg-surface-2"
            >
              <span>
                <span className="font-bold">続けて答えて、結果をもっと正確にする</span>
                <span className="mt-0.5 block text-xs text-muted">
                  まだ答えていない話題が {remainingTopics} 種類あり、いまはそこを答えから推定しています。答えるほど推定が減り、結果が正確になります。
                </span>
              </span>
              <ArrowRight size={18} className="shrink-0" aria-hidden />
            </Link>
          )}
          {misses.size > 0 && (
            <p className="mt-3 rounded-(--r-inner) bg-surface p-4 text-sm leading-relaxed">
              「{[...misses.keys()].map((g) => GENRES.find((x) => x.id === g)?.label).join("」「")}」では、
              <span className="font-bold text-accent">好きなジャンルなのに見ないと答えた動画</span>
              がありました。ジャンルではなく、題名や見せ方が合わなかったようです。
            </p>
          )}
        </section>
      )}
      {est && (
        <Link
          href="/check"
          className="mt-4 flex items-center justify-between gap-3 rounded-(--r-tile) border border-accent/40 bg-surface p-5 transition hover:bg-surface-2"
        >
          <span>
            <span className="block font-bold">ホーム画面のスクリーンショットと比べる</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">
              いまの結果は、あなたが自分で答えた内容から出しています。ホーム画面のスクリーンショットを送ると、実際におすすめに出ている動画と比べて、思っていたこととの違いが分かります。
            </span>
          </span>
          <ArrowRight size={20} className="shrink-0" aria-hidden />
        </Link>
      )}

      <div className="mt-12">
        <TypeCard code={type} topGenre={tasteTop.label} scores={axes.slice(0, 4).map((a) => a.score)} />
      </div>

      <div className="mt-12">
        <DeepAnalysis
          axes={axes}
          type={type}
          coverage={fm.attention}
          metrics={{ effective: fm.effective, top3: fm.top3, attention: fm.attention, breadth: fm.breadth }}
          prediction={diagnosis.prediction ?? undefined}
          topTopics={fm.top3Topics.map(topicLabel)}
        />
      </div>

      <div className="mt-12">
        <BeyondFog
          shownTopics={Object.keys(topics)}
          topGenre={tasteTop.id}
          outside={outside}
          onOpen={(topic) => markOutside(entry.id, [topic])}
        />
      </div>

      <div className="mt-12">
        <SavePanel videos={taste} />
      </div>
      <div className="mt-4">
        <ShareCard
          shown={topicSplit(fm).shown}
          top3={fm.top3}
          coverage={headline}
          watched={hasExposure || est ? watchedHeadline : undefined}
          type={type}
          topics={topTopics.map(([id]) => topicLabel(id))}
          fogs={unvisited.map((g) => g.label)}
        />
      </div>

      <details className="mt-10 text-sm">
        <summary className="cursor-pointer py-3 text-muted">調べた動画の一覧を見る</summary>
        <ul className="mt-3 flex flex-col gap-1.5 leading-relaxed">
          {diagnosis.videos.map((v, i) => (
            <li key={i}>
              {v.title}
              {v.channel && <span className="text-muted"> ／ {v.channel}</span>}
              <span className="text-muted">（{v.topic ? topicLabel(v.topic) : GENRES.find((g) => g.id === v.genre)?.label}）</span>
            </li>
          ))}
        </ul>
      </details>
    </PageShell>
  );
}

// 外へ出た話題：おすすめに出てこない話題の動画を見て「見た」を押した記録（おすすめの数字は変えない）
function OutsideSteps({ diagnosis, onOpen }: { diagnosis: Diagnosis; onOpen: () => void }) {
  const steps = diagnosis.outside ?? [];
  return (
    <section className="mt-4 rounded-(--r-card) bg-surface p-5 sm:p-6" aria-live="polite">
      <h2 className="flex items-center gap-2 font-bold">
        <Footprints size={18} className="text-accent" aria-hidden />
        外へ出た話題：
        <span className="num text-2xl text-accent">{steps.length}</span>つ
      </h2>
      {steps.length > 0 ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            おすすめに出てこない話題の動画を見た記録です（地図の緑の輪）。おすすめが変わったかは、1週間後にもう一度調べるとわかります。
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {steps.map((s) => (
              <li key={s.topic}>
                <a
                  href={s.videoId ? `https://www.youtube.com/watch?v=${s.videoId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(topicLabel(s.topic))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-sm"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: genreOf(genreOfTopic(s.topic)).color }} aria-hidden />
                  <span className="font-bold">{topicLabel(s.topic)}</span>
                  {s.title && <span className="line-clamp-1 text-xs text-muted">{s.title}</span>}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          おすすめに出てこない話題の動画を見て「見た」を押すと、その話題が地図に加わります。
        </p>
      )}
      <button onClick={onOpen} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-5 text-sm font-bold">
        {steps.length > 0 ? "ほかの出てこない動画も見る" : "出てこない動画を見る"}
        <ArrowRight size={16} aria-hidden />
      </button>
    </section>
  );
}
