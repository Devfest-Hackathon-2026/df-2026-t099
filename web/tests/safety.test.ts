import { describe, expect, it } from "vitest";
import { isDocId } from "@/lib/doc-id";
import { cleanPicks } from "@/lib/outside-candidates";

describe("外から来た ID の形（doc-id.ts）", () => {
  it("Firestore が作る英数字20文字だけを通す", () => {
    expect(isDocId("Ab3dEf6hIj9lMn2pQr5t")).toBe(true);
    expect(isDocId("diagnoses/abc/batons")).toBe(false);
    expect(isDocId("../x")).toBe(false);
    expect(isDocId("")).toBe(false);
    expect(isDocId("Ab3dEf6hIj9lMn2pQr5")).toBe(false);
    expect(isDocId(undefined)).toBe(false);
  });
});

describe("外の5本：Gemini の返事の検査（cleanPicks）", () => {
  const cand = ["a", "b", "c", "d", "e", "f"];
  const p = (topic: string) => ({ topic, reason: ` ${topic}が好きなら、${"あ".repeat(50)} `, query: `${topic} 入門` });
  it("候補にない話題・同じ話題・欠けた返事を外し、5つまでにする", () => {
    const got = cleanPicks([p("a"), p("zz"), p("a"), { topic: "b" }, p("c"), p("d"), p("e"), p("f")], cand);
    expect(got.map((x) => x.topic)).toEqual(["a", "c", "d", "e", "f"]);
  });
  it("理由は前後の空白を消して40字まで", () => {
    const [x] = cleanPicks([p("a")], cand);
    expect(x.reason.length).toBe(40);
    expect(x.reason.startsWith("a")).toBe(true);
  });
  it("返事が空でも落ちない", () => {
    expect(cleanPicks(undefined, cand)).toEqual([]);
  });
});
