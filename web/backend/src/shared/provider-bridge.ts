// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Provider-registry bridge — the pattern that lets `shared/` read state OWNED
 * by a module without importing it (repo rule: modules never import modules).
 *
 * The owning module registers a callback at boot (`registerXModule` →
 * `setProvider`); consumers pull it through the bridge. The `let provider =
 * null` + setter + guarded getter triple was written out three times
 * (`module-state`, `panel-settings`, `system-stats`), each with its own
 * fail-open/fail-closed nuance. This is the one implementation; each bridge
 * still owns its own "not registered yet" message.
 */

export interface ProviderBridge<T> {
  /** Called ONCE at boot by the owning module. Idempotent (last write wins). */
  set(fn: T): void;
  /** Fail-CLOSED accessor: throws when the owning module has not booted. */
  get(): T;
  /** Fail-OPEN accessor: `null` when the owning module has not booted. */
  getOrNull(): T | null;
}

/**
 * @param notRegisteredMessage Message for `get()` when nothing is registered.
 *        Keep the existing wording when migrating a hand-rolled bridge — some
 *        callers match on it.
 */
export function createProviderBridge<T>(notRegisteredMessage: string): ProviderBridge<T> {
  let provider: T | null = null;
  return {
    set(fn: T): void {
      provider = fn;
    },
    get(): T {
      if (!provider) throw new Error(notRegisteredMessage);
      return provider;
    },
    getOrNull(): T | null {
      return provider;
    },
  };
}
