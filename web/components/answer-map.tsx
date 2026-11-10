import { TOPICS } from "@/lib/topics";

// カードに答えるたびに、話題の点が1つずつ灯っていく小さな地図（結果の画面の「話題の地図」の予告）。
// 点の並びはトップの絵（TopicBubble）と同じ渦巻き。オレンジ＝見る、青白＝出てくるが見ない、輪だけ＝出てこない
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
const LIST = TOPICS.filter((t) => t.genre !== "other");
const SIZE = 100;
const STEP = 3.9;

export type Mark = "watched" | "skipped" | "unseen";

export function AnswerMap({ marks, latest }: { marks: Map<string, Mark>; latest?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-[76px] shrink-0" aria-hidden>
      {LIST.map((t, i) => {
        const r = STEP * Math.sqrt(i + 0.5);
        const a = i * GOLDEN_ANGLE;
        const m = marks.get(t.id);
        const x = SIZE / 2 + r * Math.cos(a);
        const y = SIZE / 2 + r * Math.sin(a);
        return (
          <circle
            key={t.id}
            cx={x}
            cy={y}
            r={m && m !== "unseen" ? 2.3 : 1.6}
            className={t.id === latest ? "dot-pop" : undefined}
            style={{ transformOrigin: `${x}px ${y}px` }}
            fill={m === "watched" ? "var(--light)" : m === "skipped" ? "#9fd8ff" : "currentColor"}
            fillOpacity={m === "watched" || m === "skipped" ? 1 : m === "unseen" ? 0.5 : 0.18}
          />
        );
      })}
    </svg>
  );
}
