// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Structured logger — Pino.
 *
 * JSON in production (for log aggregators), pretty in development.
 * Every log line includes the request-id when available.
 */

import pino from "pino";
import { env } from "../../config/env.js";
import { observeLogger } from "../diagnostics/runtime.js";

const transport =
  env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined;

export const logger = observeLogger(pino({
  name: "luxipanel",
  level: env.LOG_LEVEL,
  transport,
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.ip || req.socket?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
}));

export type Logger = typeof logger;

/** Create a child logger scoped to a module. */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}
