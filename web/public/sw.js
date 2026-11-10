// ホーム画面に追加できるようにするための、最小限のサービスワーカー。
// 画面やデータは保存しない（いつも最新の版を開き、診断の結果を端末に残さない）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
