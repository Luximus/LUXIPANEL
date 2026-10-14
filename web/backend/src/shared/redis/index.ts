// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Redis client singleton using ioredis.
 */

import { createModuleLogger } from "../logger/index.js";

const log = createModuleLogger("redis");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

/** Connect + verify with PING (used at boot). */
export async function connectRedis(url: string): Promise<void> {
  const mod = await import("ioredis");
  const Redis = mod.default ?? mod;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  redis = new (Redis as unknown as new (...args: unknown[]) => unknown)(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      log.warn({ attempt: times, retryIn: delay }, "Redis reconnecting…");
      return delay;
    },
    lazyConnect: true,
  });

  redis.on("connect", () => log.info("Redis connected"));
  redis.on("error", (err: Error) => log.error({ err }, "Redis error"));
  redis.on("close", () => log.warn("Redis connection closed"));

  await redis.connect();
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis PING failed: ${pong}`);
  }
  log.info("Redis connection verified");
}

/** Get the Redis client. Throws if not connected. */
export function getRedis() {
  if (!redis) throw new Error("Redis not connected — call connectRedis() first");
  return redis;
}

/** Gracefully close. */
export async function closeRedis(): Promise<void> {
  if (!redis) return;
  await redis.quit();
  log.info("Redis disconnected");
}
