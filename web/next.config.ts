import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run のコンテナで node server.js だけで動かすため
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
