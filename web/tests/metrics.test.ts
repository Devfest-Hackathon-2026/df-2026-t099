import { describe, expect, it } from "vitest";
import { metricsFromSwipes, topicSplit } from "@/lib/feed-metrics";
import type { Video } from "@/lib/genres";
import { toShareSummary } from "@/lib/share";
import { TOPICS } from "@/lib/topics";
import { tooMany } from "@/lib/rate-limit";
import { ALL_TYPE_CODES } from "@/lib/bubble-type";

const LIST = TOPICS.filter((t) => t.genre !== "other");
const card = (topic: string, exposure: Video["exposure"], frequency?: Video["frequency"]): Video => ({
  title: topic,
  genre: TOPICS.find((t) => t.id === topic)!.genre,
  topic,
  exposure,
  frequency,
});

describe("topicSplit（主役の数）", () => {
  it("出てくる話題と出てこない話題を足すと、全部の話題の数になる", () => {
    for (const breadth of [0, 12.5, 25.6, 50, 99.4, 100]) {
      const s = topicSplit({ breadth });
      expect(s.shown + s.fog).toBe(TOPICS.length);
      expect(s.total).toBe(TOPICS.length);
    }
  });
  it("全部出てくれば、出てこない話題は0。何も出てこなければ「その他」以外の全部", () => {
    expect(topicSplit({ breadth: 100 }).fog).toBe(0);
    expect(topicSplit({ breadth: 0 }).fog).toBe(LIST.length);
  });
});

describe("metricsFromSwipes（カードの答えからの推定）", () => {
  it("「出てこない」と答えるほど、出てこない話題が増える", () => {
    const some = LIST.slice(0, 24);
    const mostlyShown = some.map((t, i) => card(t.id, i % 4 === 0 ? "unseen" : "watched", "often"));
    const mostlyUnseen = some.map((t, i) => card(t.id, i % 4 === 0 ? "watched" : "unseen", "often"));
    const a = topicSplit(metricsFromSwipes(mostlyShown));
    const b = topicSplit(metricsFromSwipes(mostlyUnseen));
    expect(b.fog).toBeGreaterThan(a.fog);
  });
  it("外へ出た話題を足すと、出てこない話題が減る（見た分だけ広がる）", () => {
    const answers = LIST.slice(0, 20).map((t, i) => card(t.id, i % 2 ? "unseen" : "watched", "often"));
    const outside = LIST.slice(100, 103).map((t) => t.id);
    const before = topicSplit(metricsFromSwipes(answers));
    const after = topicSplit(metricsFromSwipes(answers, undefined, outside));
    expect(after.fog).toBeLessThan(before.fog);
  });
  it("割合は 0〜100 におさまる", () => {
    const m = metricsFromSwipes(LIST.slice(0, 30).map((t, i) => card(t.id, i % 3 ? "watched" : "skipped", i % 2 ? "often" : "sometimes")));
    for (const v of [m.breadth, m.attention, m.top3]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("toShareSummary（共有リンクに載せる中身）", () => {
  const ok = { kinds: 111, top: [LIST[0].id, LIST[1].id, LIST[2].id], top3: 40, type: ALL_TYPE_CODES[0], fogCount: 38 };
  it("決まった形の中身だけを通す", () => {
    const s = toShareSummary({ ...ok, title: "動画の題名", userId: "x" });
    expect(s).not.toBeNull();
    expect(Object.keys(s!).sort()).toEqual(["fogCount", "kinds", "top", "top3", "type"]);
  });
  it("範囲の外の数は切りそろえ、知らない話題は捨てる", () => {
    const s = toShareSummary({ ...ok, fogCount: 9999, top3: -5, top: [LIST[0].id, "unknown.topic", "<script>"] });
    expect(s).not.toBeNull();
    expect(s!.fogCount).toBe(TOPICS.length);
    expect(s!.top3).toBe(0);
    expect(s!.top).toEqual([LIST[0].id]);
  });
  it("数がないものは通さない", () => {
    expect(toShareSummary({ ...ok, fogCount: "38" })).toBeNull();
    expect(toShareSummary(null)).toBeNull();
  });
});

describe("tooMany（回数の上限）", () => {
  it("合言葉の入口は、同じ接続元から10分に30回まで", () => {
    const req = () => new Request("http://x/", { headers: { "x-forwarded-for": "198.51.100.7" } });
    for (let i = 0; i < 30; i++) expect(tooMany(req(), "gate")).toBeNull();
    expect(tooMany(req(), "gate")?.status).toBe(429);
  });
  it("送る側が書ける先頭の値ではなく、末尾の接続元で数える", () => {
    const req = (head: string) => new Request("http://x/", { headers: { "x-forwarded-for": `${head}, 203.0.113.9` } });
    for (let i = 0; i < 30; i++) expect(tooMany(req(`10.0.0.${i}`), "gate")).toBeNull();
    expect(tooMany(req("10.0.0.99"), "gate")?.status).toBe(429);
  });
});
