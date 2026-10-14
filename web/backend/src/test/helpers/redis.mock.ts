// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * In-memory stand-in for `shared/redis/index.js`, for tests.
 *
 * Two consumers in the request path need a live Redis client, so integration
 * tests can't just let `getRedis()` throw:
 *
 *  - `tokenService.verify` does a denylist `EXISTS` on every authenticated
 *    request and is **fail-closed** (a Redis error rejects the token), so
 *    without a client every request would 401.
 *  - `rate-limiter.middleware` builds a `RedisStore` at import time and drives
 *    it through ioredis' `call(command, ...args)`.
 *
 * Register it from a test file with a hoisted `vi.mock` BEFORE importing the
 * module under test:
 *
 *   vi.mock("../../shared/redis/index.js", () => import("../helpers/redis.mock.js"));
 */

const store = new Map<string, string>();

/**
 * ioredis' generic command entrypoint: the FIRST argument is the command name.
 * `rate-limit-redis` only ever issues SCRIPT LOAD / EVALSHA / DECR / DEL.
 * EVALSHA always reports "first hit in the window", so the limiter never trips
 * and tests stay deterministic (no test asserts a 429).
 */
async function call(command: string, ...args: unknown[]): Promise<unknown> {
  switch (String(command).toUpperCase()) {
    case "SCRIPT":
      return "test-script-sha"; // SCRIPT LOAD → sha
    case "EVALSHA":
      return [1, 60_000]; // [totalHits, timeToExpireMs]
    case "DECR":
      return 0;
    case "DEL":
      store.delete(String(args[0]));
      return 1;
    default:
      return null;
  }
}

const client = {
  call,
  async exists(key: string): Promise<number> {
    return store.has(key) ? 1 : 0;
  },
  async set(key: string, value: string): Promise<"OK"> {
    // Extra args (PX/ttl) are accepted and ignored — nothing here expires.
    store.set(key, String(value));
    return "OK";
  },
  async get(key: string): Promise<string | null> {
    return store.get(key) ?? null;
  },
  async del(key: string): Promise<number> {
    return store.delete(key) ? 1 : 0;
  },
  async ping(): Promise<"PONG"> {
    return "PONG";
  },
};

// ── Mocked module surface (mirrors shared/redis/index.ts) ──────────────────

export async function connectRedis(): Promise<void> {
  /* no-op: the fake client is always "connected" */
}

export function getRedis() {
  return client;
}

export async function closeRedis(): Promise<void> {
  store.clear();
}
