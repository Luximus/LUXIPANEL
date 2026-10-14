// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `fetch` bounded by a timeout — the `AbortController` + `setTimeout(abort)` +
 * `clearTimeout` triad written out by hand in a handful of external-API
 * clients (cloudflare, expo, firewall/cloudflare-ips, openclaw). One helper,
 * one behaviour.
 *
 * The helper does NOT swallow the abort: when the timer fires, `fetch` rejects
 * with a `DOMException`/`Error` whose `name === "AbortError"`, and that error
 * propagates to the caller unchanged so existing `err.name === "AbortError"`
 * → "timeout" mappings keep working. The helper only removes the boilerplate
 * of creating and clearing the timer.
 *
 * A caller-provided `init.signal` is composed with the internal timeout signal
 * (whichever aborts first wins), so an external cancellation still works.
 */

/**
 * `fetch(input, init)` aborted after `timeoutMs`. Returns the `Response`; the
 * timer is always cleared once the response headers arrive (or the fetch
 * rejects). On timeout the returned promise rejects with an `AbortError`.
 */
export async function fetchWithTimeout(
  input: string | URL | globalThis.Request,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}
