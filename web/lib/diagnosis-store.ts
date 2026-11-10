"use client";

import type { Diagnosis, DiagnosisSource, OutsideStep, Video } from "./genres";

// 診断結果はこの端末のタブの中だけに置く（サーバーには保存しない）
const KEY = "bubble-diagnosis";

// 結果の画面が、予想を書き足したときに描き直せるように知らせる
const listeners = new Set<() => void>();
export function subscribeDiagnosis(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const notify = () => listeners.forEach((l) => l());

// keep：「続けて答える」のときに、前の予想と自分で直した分、外へ出た話題、最初に答えた時刻を引き継ぐ
export function saveDiagnosis(source: DiagnosisSource, videos: Video[], keep?: Pick<Diagnosis, "prediction" | "corrections" | "outside" | "continues">) {
  const diagnosis: Diagnosis = { source, videos, createdAt: new Date().toISOString(), ...keep };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(diagnosis));
  } catch {
    // 保存できなくても結果の画面へは進む
  }
  return diagnosis;
}

// 友だちの招待リンクから来たとき、診断のあとにその友だちと比べるために覚えておく
const FRIEND_KEY = "bubble-friend";

export function rememberFriendId(id: string) {
  try {
    sessionStorage.setItem(FRIEND_KEY, id);
  } catch {}
}

export function takeFriendId() {
  try {
    const id = sessionStorage.getItem(FRIEND_KEY);
    sessionStorage.removeItem(FRIEND_KEY);
    return id;
  } catch {
    return null;
  }
}

// グループの招待リンクから来たとき、保存するときにそのグループに入れる
const GROUP_KEY = "bubble-group";

export function rememberGroupId(id: string) {
  try {
    sessionStorage.setItem(GROUP_KEY, id);
  } catch {}
}

export function takeGroupId() {
  try {
    const id = sessionStorage.getItem(GROUP_KEY);
    sessionStorage.removeItem(GROUP_KEY);
    return id;
  } catch {
    return null;
  }
}

// useSyncExternalStore は同じ中身なら同じオブジェクトを返す必要があるので、文字列ごとに覚えておく
let cachedRaw: string | null = null;
let cached: Diagnosis | null = null;

// 結果を見る前の予想を、いまの診断に書き足す
export function savePrediction(prediction: number | null) {
  const d = loadDiagnosis();
  if (!d) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, prediction }));
  } catch {}
  notify();
}

// 結果を見た本人の直しを、いまの診断に書き足す
export function saveCorrection(genre: string, share: number | null) {
  const d = loadDiagnosis();
  if (!d) return;
  const corrections = { ...(d.corrections ?? {}) } as Record<string, number>;
  if (share === null) delete corrections[genre];
  else corrections[genre] = share;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, corrections }));
  } catch {}
  notify();
}

// おすすめに出てこない話題の動画を見て「見た」を押したとき、いまの診断に書き足す（同じ話題は1つだけ）
export function saveOutside(step: Omit<OutsideStep, "at">) {
  const d = loadDiagnosis();
  if (!d) return;
  const outside = [...(d.outside ?? []).filter((s) => s.topic !== step.topic), { ...step, at: new Date().toISOString() }];
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, outside }));
  } catch {}
  notify();
}

// 押しまちがえたときに取り消す
export function removeOutside(topic: string) {
  const d = loadDiagnosis();
  if (!d) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, outside: (d.outside ?? []).filter((s) => s.topic !== topic) }));
  } catch {}
  notify();
}

export function loadDiagnosis(): Diagnosis | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as Diagnosis) : null;
    }
    return cached;
  } catch {
    return null;
  }
}

// 保存した自分のまとめ（本人用の id）を、この端末に覚えておく。
// タブを閉じても、トップから自分のまとめと、届いたバトンに戻れるようにする
const MINE_KEY = "bubble-mine";

export function rememberMine(id: string) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify({ id, at: new Date().toISOString() }));
  } catch {}
}

export function loadMine(): { id: string; at: string } | null {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    return raw ? (JSON.parse(raw) as { id: string; at: string }) : null;
  } catch {
    return null;
  }
}
