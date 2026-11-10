// 「コピーしました」のような、すぐ消えてよい知らせを出す（動きの部品のトースト）。
// 部品の JS がまだ読み込まれていないときは、何もしない
export function toast(message: string, type?: "err") {
  if (typeof window === "undefined") return;
  (window as unknown as { ui?: { toast?: (m: string, o?: { type?: string }) => void } }).ui?.toast?.(message, { type });
}
