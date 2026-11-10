import { describe, expect, it } from "vitest";
import { knownTitles, usableCandidates } from "@/lib/outside-candidates";

const v = (title: string) => ({ videoId: "x", title, channel: "c", thumbnail: "t" });

describe("外の5本の候補（outside-candidates.ts）", () => {
  it("探しても動画が無かった話題を外す", () => {
    const c = ["a", "b", "c", "d", "e", "f", "g"];
    const known = new Map<string, ReturnType<typeof v> | null | "none">([["b", "none"], ["c", v("C の動画")]]);
    expect(usableCandidates(c, known)).toEqual(["a", "c", "d", "e", "f", "g"]);
  });
  it("外すと5つ未満になるなら、外さない", () => {
    const c = ["a", "b", "c", "d", "e"];
    const known = new Map<string, ReturnType<typeof v> | null | "none">([["a", "none"]]);
    expect(usableCandidates(c, known)).toEqual(c);
  });
  it("Gemini に見せるのは、覚えている動画の題名だけ（60字まで）", () => {
    const long = "あ".repeat(80);
    const known = new Map<string, ReturnType<typeof v> | null | "none">([["a", v(long)], ["b", "none"], ["c", null]]);
    expect(knownTitles(known)).toEqual({ a: "あ".repeat(60) });
  });
});
