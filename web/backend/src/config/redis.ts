// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Redis configuration derived from validated environment.
 */

import { env } from "./env.js";

export const redisConfig = {
  url: env.REDIS_URL,
} as const;
