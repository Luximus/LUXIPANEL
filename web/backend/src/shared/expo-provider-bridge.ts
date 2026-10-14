import type { Executor } from "./executor/index.js";
// Module registration supplies the Expo capability without module-to-module imports.
let resolveToken: ((executor: Executor) => Promise<string>) | null = null;
export function registerExpoProviderToken(fn: (executor: Executor) => Promise<string>): void { resolveToken = fn; }
export async function expoProviderToken(executor: Executor): Promise<string> {
  if (!resolveToken) throw new Error("expo_module_unavailable");
  return resolveToken(executor);
}
