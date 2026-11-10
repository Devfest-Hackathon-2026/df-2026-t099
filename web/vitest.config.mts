import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 計算の決まり（数の出し方・共有の中身の切りそろえ・回数の上限）を確かめる小さなテスト
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // サーバー専用の印。テストでは中身のない部品に置きかえる
      "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
