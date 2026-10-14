// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server-only environment resolution (SSOT).
 *
 * Single source of truth for the backend base URL used by SSR pages, the API
 * proxy, and server-side lib helpers. `process.env` is resolved at RUNTIME
 * (not `import.meta.env`, which is baked at build time and would be undefined
 * when BACKEND_URL is unset during `npm run build`). Do NOT import this from
 * client-side code — it reads `process.env`.
 */

/** Default backend port (infra default, `:8080`). Also used client-side by the
 *  assistant/terminal WS URL builders when `window.__BACKEND_PORT__` is unset. */
export const DEFAULT_BACKEND_PORT = "8080";

/** Default backend origin when BACKEND_URL is not set in the environment.
 *  Derived from `DEFAULT_BACKEND_PORT` so the port is defined once. */
const DEFAULT_BACKEND_URL = `http://localhost:${DEFAULT_BACKEND_PORT}`;

/**
 * Resolve the backend base URL at runtime.
 * Mirrors infra default (`DEFAULT_BACKEND_PORT` 8080).
 */
export function getBackendUrl(): string {
  return process.env.BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

/**
 * Outer cap (bytes) the API proxy enforces on a forwarded request body, kept in
 * sync with the backend's `FILES_UPLOAD_MAX_BYTES` (config/env.ts) so the proxy
 * is not the bottleneck for large file uploads. Read at RUNTIME from
 * `FILES_UPLOAD_MAX_BYTES` (same var the backend uses) with a 512 MiB default;
 * an invalid/non-positive value falls back to the default.
 */
const DEFAULT_UPLOAD_MAX_BYTES = 536_870_912; // 512 MiB — matches backend default

/** Resolve the proxy's forwarded-body cap at runtime (see backend
 *  `FILES_UPLOAD_MAX_BYTES`). Invalid values fall back to 512 MiB. */
export function getUploadMaxBytes(): number {
  const raw = Number(process.env.FILES_UPLOAD_MAX_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UPLOAD_MAX_BYTES;
}

/**
 * Default public LUXIPANEL site origin (marketing / portal / legal pages) when
 * SITE_URL is not set in the environment.
 */
const DEFAULT_SITE_URL = "https://luxipanel.com";

/**
 * Resolve the public LUXIPANEL site origin at runtime from `SITE_URL`. This is
 * the SINGLE source for the `https://luxipanel.com` base: footer/legal links
 * (terms, privacy, refund-policy…), the portal link and the logo all derive
 * from here, so the brand domain is configured from one point. Trailing slashes
 * are normalized off.
 */
export function getSiteUrl(): string {
  return (process.env.SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/**
 * Build an absolute URL on the public site, e.g. `siteUrl("/refund-policy")`.
 * `siteUrl()` / `siteUrl("/")` return the origin with a trailing slash (home).
 */
export function siteUrl(path = ""): string {
  const base = getSiteUrl();
  const rel = path.replace(/^\/+/, "");
  return rel ? `${base}/${rel}` : `${base}/`;
}

/**
 * Default Luxisoft corporate origin (the company that makes LUXIPANEL — used by
 * the "made by" footer link) when LUXISOFT_URL is not set in the environment.
 */
const DEFAULT_LUXISOFT_URL = "https://luxisoft.com";

/**
 * Resolve the Luxisoft corporate origin at runtime from `LUXISOFT_URL`. SINGLE
 * source for the `https://luxisoft.com` brand base. Trailing slashes normalized.
 * Note: `api.luxisoft.com` (license server) is a separate concern resolved from
 * `LICENSE_SERVER_URL` / `LICENSE_API_URL`, not from here.
 */
export function getLuxisoftUrl(): string {
  return (process.env.LUXISOFT_URL ?? DEFAULT_LUXISOFT_URL).replace(/\/+$/, "");
}

/**
 * Build an absolute URL on the Luxisoft site, e.g. `luxisoftUrl("/en/")`.
 * `luxisoftUrl()` returns the origin with a trailing slash.
 */
export function luxisoftUrl(path = ""): string {
  const base = getLuxisoftUrl();
  const rel = path.replace(/^\/+/, "");
  return rel ? `${base}/${rel}` : `${base}/`;
}
