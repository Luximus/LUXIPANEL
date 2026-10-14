import { resolveTargetScope, type ApiResponse } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { S } from "./state";
import { $ } from "./dom";

/** Recover read-only requests canceled by hydration, within their original view. */
export async function readExpoData<T>(read: () => Promise<ApiResponse<T>>, selected: () => boolean = () => true): Promise<ApiResponse<T>> {
  const root = $("expo-root"), generation = S.targetGeneration, target = resolveTargetScope();
  const current = () => !!root && $("expo-root") === root && generation === S.targetGeneration && target === resolveTargetScope() && selected();
  const stale = (): ApiResponse<T> => ({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
  if (!current()) return stale();
  let result = await read();
  for (let attempt = 0; !result.ok && result.code === "TARGET_SCOPE_CHANGED" && attempt < 2 && current(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
    if (!current()) return stale();
    result = await read();
  }
  return current() ? result : stale();
}
