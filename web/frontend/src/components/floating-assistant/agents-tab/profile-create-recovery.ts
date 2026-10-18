// SPDX-License-Identifier: AGPL-3.0-only
import { resolveTargetScope } from "@/lib/api-client";
import { scopedPreferenceKey } from "@/lib/scoped-preferences";

// A local safety latch, NOT an idempotency key or proof of server persistence.
// Store only a boolean; never store the form, credentials or session headers.
const unresolved = new Set<string>();
export function profileCreationKey(): string {
  return scopedPreferenceKey("assistant", "unconfirmed-profile-create") + ":" + encodeURIComponent(resolveTargetScope());
}
export function hasUnconfirmedCreation(key: string): boolean {
  try { return unresolved.has(key) || sessionStorage.getItem(key) === "1"; }
  catch { return unresolved.has(key); }
}
export function markUnconfirmedCreation(key: string, value: boolean): void {
  if (value) unresolved.add(key); else unresolved.delete(key);
  try { if (value) sessionStorage.setItem(key, "1"); else sessionStorage.removeItem(key); }
  catch { /* The in-memory latch still protects remounted dialogs. */ }
}
