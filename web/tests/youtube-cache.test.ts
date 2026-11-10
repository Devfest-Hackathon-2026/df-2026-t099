import { beforeEach, describe, expect, it, vi } from "vitest";

// Firestore の代わりに、メモリの入れ物を使う
const store = new Map<string, unknown[]>();
vi.mock("@/lib/db", () => ({
  getFeedDoc: async (key: string) => store.get(key) ?? null,
  saveFeedDoc: async (key: string, videos: unknown[]) => void store.set(key, videos),
}));

const item = (videoId: string, title: string) => ({ id: { videoId }, snippet: { title, channelTitle: "ch", thumbnails: { medium: { url: "u" } } } });

async function load() {
  vi.resetModules();
  return import("@/lib/youtube");
}

describe("外の動画の覚え方（youtube.ts）", () => {
  beforeEach(() => {
    store.clear();
    process.env.YOUTUBE_API_KEY = "test";
  });

  it("見つかった動画は覚えて、2回目は YouTube を検索しない", async () => {
    const fetch = vi.fn(async () => Response.json({ items: [item("a1", "プラモデルの塗り方")] }));
    vi.stubGlobal("fetch", fetch);
    const yt = await load();
    expect((await yt.suggestVideo("game.fps"))?.videoId).toBe("a1");
    await yt.suggestVideo("game.fps");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await yt.peekVideo("game.fps")).toMatchObject({ videoId: "a1" });
  });

  it("あおる題名の動画は飛ばす", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [item("x", "【衝撃】閲覧注意の事件"), item("ok", "FPS の立ち回り解説")] })));
    const yt = await load();
    expect((await yt.suggestVideo("game.fps"))?.videoId).toBe("ok");
  });

  it("探して無かった話題は「無い」と覚え、候補から外せるようにする", async () => {
    const fetch = vi.fn(async () => Response.json({ items: [] }));
    vi.stubGlobal("fetch", fetch);
    const yt = await load();
    expect(await yt.suggestVideo("game.fps")).toBeNull();
    expect(await yt.peekVideo("game.fps")).toBe("none");
    await yt.suggestVideo("game.fps");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("上限（429）の失敗は「無い」と区別し、Firestore には残さない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    const yt = await load();
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await yt.suggestVideo("game.fps")).toBeNull();
    expect(await yt.peekVideo("game.fps")).toBeNull();
    expect(store.size).toBe(0);
  });
});
