// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth module — self-registering modular monolith module.
 *
 * Call `registerAuthModule(app)` from server.ts to mount all auth routes.
 */

import type { Express } from "express";
import { authRouter } from "./routes/auth.routes.js";
import { createModuleLogger } from "../../shared/logger/index.js";

const log = createModuleLogger("auth-module");

export function registerAuthModule(app: Express): void {
  app.use(authRouter);
  log.info("Auth module registered");
}

// Re-export middlewares that other modules need
export { requireAuth, optionalAuth } from "./middlewares/session.middleware.js";
export { csrfProtection, csrfCookieSetter } from "./middlewares/csrf.middleware.js";
export { requireModule } from "./middlewares/require-module.middleware.js";
export { globalRateLimiter } from "./middlewares/rate-limiter.middleware.js";
