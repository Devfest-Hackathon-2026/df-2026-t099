"use client";

import { useSyncExternalStore } from "react";
import { loadMine } from "./diagnosis-store";

const noop = () => () => {};

// この端末に覚えている、自分のまとめの id（なければ null）
export function useMineId() {
  return useSyncExternalStore(noop, () => loadMine()?.id ?? null, () => null);
}
