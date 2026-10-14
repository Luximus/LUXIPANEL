// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Token helper for integration tests.
 *
 * Creates signed JWTs without hitting the database — useful for testing
 * authenticated endpoints without a real session.
 */

import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { vi } from "vitest";
vi.mock("../../shared/redis/index.js", () => ({ getRedis: () => ({ exists: async () => 0, get: async () => null, set: async () => "OK", incr: async () => 1, publish: async () => 0 }) }));
import type { TokenPayload } from "../../modules/auth/services/token.service.js";

const TEST_SECRET = "test-secret-key-at-least-32-characters-long!!";

// Managed-only: every authenticated session is a bridged (direct-SSH)
// session, so requireAuth resolves a per-server executor. Integration tests
// mock the executor factory to a fake one (see executor.helper.ts).
const TEST_BRIDGE = {
  bridgeSessionId: "test-bridge-session",
  targetId: "panel:test",
  targetName: "test",
  direct: true as const,
};

export const TEST_ADMIN_PAYLOAD: TokenPayload = {
  userId: 1,
  username: "test-admin",
  displayName: "Test Admin",
  role: "admin",
  modules: ["admin", "mail", "users", "monitor", "files", "dns", "firewall", "cron", "backup", "terminal"],
  kind: "admin",
  ...TEST_BRIDGE,
};

export const TEST_USER_PAYLOAD: TokenPayload = {
  userId: 2,
  username: "test-user",
  displayName: "Test User",
  role: "mail-operator",
  modules: ["mail"],
  kind: "user",
  permissions: { sidebar: ["mail"], views: ["panel.mail"], actions: ["mail.read", "mail.create", "mail.edit", "mail.delete", "mail.execute", "mail.config", "mail.connect", "mail.send", "mail.export"],
    fileAccess: { allowAll: false, allowPaths: [], denyPaths: [], readOnlyPaths: [], defaultPath: null },
    commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] } },
  ...TEST_BRIDGE,
};

/**
 * Sign a test JWT with the test secret.
 * The auth config mock must use TEST_SECRET for this to work.
 *
 * `jwtid` NO es opcional: `tokenService.verify` RECHAZA cualquier token sin
 * `jti` (sin él no habría forma de revocarlo, así que se deniega en vez de
 * dejarlo vivo hasta su expiración natural). Producción firma con
 * `jwtid: randomUUID()`; si el helper no lo hace, todo test autenticado se come
 * un 401 y el fallo parece de permisos cuando en realidad es de emisión.
 */
export function signTestToken(payload: TokenPayload = TEST_ADMIN_PAYLOAD): string {
  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: 3600,
    issuer: "luxipanel",
    subject: String(payload.userId),
    jwtid: randomUUID(),
  });
}

/** Returns the Authorization header value for a test token. */
export function authHeader(payload: TokenPayload = TEST_ADMIN_PAYLOAD): string {
  return `Bearer ${signTestToken(payload)}`;
}
