// サーバーに JSON を送って、JSON の答えを受け取る。
// 通信が切れたときや、サーバーが JSON 以外（エラーの画面など）を返したときも例外にせず、
// 画面が「読み込み中」のまま止まらないようにする
export async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: Partial<T> & { error?: string } }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Partial<T> & { error?: string };
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "通信できませんでした。電波のよい所でもう一度試してください" } as Partial<T> & { error?: string } };
  }
}
