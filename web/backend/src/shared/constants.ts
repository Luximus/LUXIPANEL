// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cross-module shared constants (single source of truth).
 *
 * Small, dependency-free magic values that were previously copy-pasted across
 * several modules. Centralising them here keeps the values in lockstep and the
 * call sites self-documenting.
 */

/**
 * Upper bound for a per-exec timeout, in milliseconds (= 10 minutes).
 * Agent-capability schemas clamp a caller-supplied `timeoutMs` to this cap.
 */
export const EXEC_TIMEOUT_CAP_MS = 600_000;

/**
 * Default per-exec timeout, in milliseconds (= 2 minutes). Applied when an
 * agent-capability caller does not supply an explicit `timeoutMs`. Shared by
 * the servers agent-capability and the MCP peer controller (both previously
 * declared their own identical copy).
 */
export const EXEC_DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Timeout, in milliseconds (= 15 s), for Git-over-SSH operations (clone/fetch/
 * status). Shared by the Files git service and the assistant team-isolation
 * service, which run the same class of Git operations.
 */
export const GIT_TIMEOUT_MS = 15_000;

/** Liveness/health endpoint path. Single source of truth for the route
 * registration and the callers that probe or re-register it. */
export const HEALTH_PATH = "/api/health";

/** GitHub REST API base URL (no trailing slash). */
export const GITHUB_API = "https://api.github.com";

/** Default page size for audit-log listings. */
export const DEFAULT_AUDIT_LIMIT = 50;

/** One day, in seconds (= 24 h). Used for HTTP cache `max-age` / CORS `maxAge`. */
export const ONE_DAY_SECONDS = 86400;

/**
 * Filesystem roots swept when discovering code projects / git repos on the
 * connected server. Single source of truth for the Files project scan
 * (`normalizeScanRoots`), the Obsidian repo-pointer sync, and the webhooks
 * project/git-hook detectors — three call sites that were byte-identical and
 * commented "mirrors the Files module", so they must stay in lockstep.
 *
 * NOT shared by the Expo scan (`expo-apps.service.ts`): that one prepends a
 * per-session `/home/<sshUser>` and uses a deliberately different order, so it
 * builds its own list.
 */
export const CODE_SCAN_ROOTS = ["/var/www", "/home", "/opt", "/srv", "/root"] as const;

/** `Cache-Control` value that disables all browser/proxy caching. Shared by the
 *  API no-cache middleware and the SSE endpoints (all directives mean "do not
 *  cache"). */
export const NO_CACHE_HEADER = "no-store, no-cache, must-revalidate, max-age=0";

/** CSRF token header name — canonical spelling for the CORS allow-list and any
 *  handler that reads/sets it. */
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/** `Content-Type` for Server-Sent Events streams. */
export const SSE_CONTENT_TYPE = "text/event-stream; charset=utf-8";

/** Maximum accepted size (bytes) for a branding image upload (= 5 MiB). */
export const BRANDING_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** SSH connect / handshake timeout, in milliseconds (= 15 s). Applied to the
 *  ssh2 `readyTimeout` on connect and to the first-contact probe. */
export const SSH_CONNECT_TIMEOUT_MS = 15_000;
