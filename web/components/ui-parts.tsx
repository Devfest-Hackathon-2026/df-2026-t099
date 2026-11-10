"use client";

import { useEffect } from "react";
import Script from "next/script";

// 動きの部品（ui-motion-parts）の JS。画面をあとから書き換えるアプリなので、
// 読み込んだあとに画面の変化を見張って、あとから出た部品も動かす
export function UiParts() {
  // ホーム画面に追加できるように、サービスワーカーを登録する（使えないブラウザでは何もしない）
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <Script
      src="/ui.js"
      strategy="afterInteractive"
      onLoad={() => (window as unknown as { ui?: { watch?: () => void } }).ui?.watch?.()}
    />
  );
}
