import { TOPICS } from "@/lib/topics";

// トップの絵：137 の話題を、ひまわりの種のように渦巻きに並べる（点の1つ1つが話題）。
// 真ん中の数個だけが灯っていて、うすい泡に包まれている＝おすすめに流れてくるのは泡の中だけ、というフィルターバブルの絵。
// 灯す数は、試作で診断した1人の実際の結果（スクショ17本で、137 のうち 9 つの話題）
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
const SIZE = 320;
const STEP = 12.2;

export function TopicBubble({ lit }: { lit: number }) {
  const dots = TOPICS.map((_, i) => {
    const r = STEP * Math.sqrt(i + 0.5);
    const a = i * GOLDEN_ANGLE;
    return { x: SIZE / 2 + r * Math.cos(a), y: SIZE / 2 + r * Math.sin(a), on: i < lit };
  });
  // 泡は、灯った点をちょうど包む大きさ
  const bubble = STEP * Math.sqrt(lit) + 9;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[320px]" role="img" aria-label={`${TOPICS.length} の話題のうち、${lit} の話題だけが灯っている図`}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={bubble} fill="var(--light)" fillOpacity="0.1" stroke="var(--light)" strokeOpacity="0.55" strokeWidth="1.2" />
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.on ? 4.6 : 3.6}
          fill={d.on ? "var(--light)" : "currentColor"}
          fillOpacity={d.on ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}
