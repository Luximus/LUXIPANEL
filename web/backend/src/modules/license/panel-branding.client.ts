// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel-branding client — fetches public branding + login-method config
 * from LP-LICENSE-SERVER's `/public/panel-branding?host=<host>` endpoint.
 *
 * Used by the unauthenticated `/api/public/layout` and `/api/auth/login-methods`
 * handlers in managed mode so /login can render without SSH-ing into the
 * connected server.
 *
 * Caches per-host in Redis (key: `lxp:branding:host:<host>`). Surviving a
 * pm2 restart and being shared across workers matters because the panel
 * homepage hits this on every cold visit; Redis avoids re-fetching from
 * LP-LS on every request.
 */

import { env } from "../../config/env.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { getRedis } from "../../shared/redis/index.js";
import { normalizeHost as canonicalizeHost } from "../../shared/utils/host.js";
import { postLicenseServerJson, agentsBaseUrl } from "../../shared/license-server-tls.js";
import { getActive as getActiveSharedSecret } from "../secret-rotation/services/secret-store.service.js";
import { brandingAssetService, shouldProxyUrl } from "./branding-asset.service.js";
import type { BrandingEntry } from "./panel-api.client.js";

const log = createModuleLogger("panel-branding-client");

const BRANDING_PREVIEW_FETCH_TIMEOUT_MS = 2_500;
const WRITE_TIMEOUT_MS = 8_000;
const REDIS_CACHE_TTL_S = 60;
const NOT_FOUND_TTL_S = 60;
const REDIS_KEY_PREFIX = "lxp:branding:host:";

type BrandingFetchOutcome =
  | {
      state: "matched";
      configured: boolean;
      panelId: string;
      panelName: string | null;
      layout: Record<string, string>;
      general: Record<string, string>;
      loginMethods: { password: boolean; passkey: boolean; recovery: boolean };
      modules: Record<string, string>;
    }
  | { state: "not_found" }
  | { state: "unreachable" };

function normalizeHost(host: string | undefined | null): string | null {
  // Delegate to the canonical helper (trim + lowercase + strip :port + strip
  // trailing FQDN dots); preserve this client's null-for-empty contract.
  const h = canonicalizeHost(host);
  return h || null;
}

async function readCache(host: string): Promise<BrandingFetchOutcome | null> {
  try {
    const raw = await getRedis().get(`${REDIS_KEY_PREFIX}${host}`);
    if (!raw) return null;
    return JSON.parse(raw) as BrandingFetchOutcome;
  } catch (err) {
    log.debug({ err: (err as Error).message, host }, "branding cache read failed");
    return null;
  }
}

async function writeCache(host: string, payload: BrandingFetchOutcome): Promise<void> {
  try {
    const ttl = payload.state === "not_found" ? NOT_FOUND_TTL_S : REDIS_CACHE_TTL_S;
    await getRedis().set(`${REDIS_KEY_PREFIX}${host}`, JSON.stringify(payload), "EX", ttl);
  } catch (err) {
    log.debug({ err: (err as Error).message, host }, "branding cache write failed");
  }
}

/**
 * Keys we know to be image URLs. Every value at these keys gets fed to
 * `brandingAssetService.register` if it looks external; the response then
 * carries the `/api/branding/asset/<hash>` proxy path instead of the raw URL.
 *
 * Single-logo model: the panel-side now persists one `layout_logo` that
 * applies to all visual surfaces; LP-LS may still return the legacy per-slot
 * keys (`layout_logo_{primary,sidebar,login,footer}`) for backwards compat —
 * those are also recognized here.
 */
const IMAGE_KEYS = new Set([
  "layout_logo",
  "layout_logo_login",
  "layout_logo_primary",
  "layout_logo_sidebar",
  "layout_logo_footer",
]);

async function rewriteImageUrls(map: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (IMAGE_KEYS.has(key) && shouldProxyUrl(value)) {
      out[key] = await brandingAssetService.register(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Expand the panel-side single `layout_logo` into the per-slot legacy keys
 * LP-LS still expects on the write-through path, so the brand stays
 * consistent across legacy clients until LP-LS itself drops the slots.
 */
function expandLegacyLogoSlots(entries: BrandingEntry[]): BrandingEntry[] {
  const logoEntry = entries.find((e) => e.key === "layout_logo");
  if (!logoEntry) return entries;
  const value = logoEntry.value;
  return entries.flatMap((e) => {
    if (e.key === "layout_logo") {
      return [
        { key: "layout_logo", value, category: e.category },
        { key: "layout_logo_primary", value, category: e.category },
        { key: "layout_logo_sidebar", value, category: e.category },
        { key: "layout_logo_login", value, category: e.category },
        { key: "layout_logo_footer", value, category: e.category },
      ];
    }
    return [e];
  });
}

async function deleteCache(host?: string): Promise<void> {
  try {
    if (host) {
      await getRedis().del(`${REDIS_KEY_PREFIX}${host}`);
      return;
    }
    // No-host invalidate: scan all keys with the prefix (write-through after
    // a panel-side save doesn't know which hosts point at the panel).
    const stream = getRedis().scanStream({ match: `${REDIS_KEY_PREFIX}*`, count: 200 });
    for await (const keys of stream) {
      if (keys.length > 0) await getRedis().del(...keys);
    }
  } catch (err) {
    log.debug({ err: (err as Error).message, host }, "branding cache delete failed");
  }
}

export const panelBrandingClient = {
  async fetchByHost(rawHost: string | undefined | null): Promise<BrandingFetchOutcome> {
    const host = normalizeHost(rawHost);
    if (!host) return { state: "not_found" };

    const cached = await readCache(host);
    if (cached) return cached;

    const url = `${env.LICENSE_SERVER_URL}/public/panel-branding?host=${encodeURIComponent(host)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(BRANDING_PREVIEW_FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        log.warn({ status: res.status, host }, "LP-LS returned non-OK for panel branding");
        return { state: "unreachable" };
      }
      const body = (await res.json()) as {
        ok?: boolean;
        matched?: boolean;
        configured?: boolean;
        panelId?: string;
        panelName?: string | null;
        layout?: Record<string, string>;
        general?: Record<string, string>;
        loginMethods?: { password?: boolean; passkey?: boolean; recovery?: boolean };
        modules?: Record<string, string>;
      };

      if (!body.ok || body.matched === false) {
        const outcome: BrandingFetchOutcome = { state: "not_found" };
        await writeCache(host, outcome);
        return outcome;
      }

      const layout = await rewriteImageUrls(body.layout ?? {});
      const general = await rewriteImageUrls(body.general ?? {});

      const outcome: BrandingFetchOutcome = {
        state: "matched",
        configured: Boolean(body.configured),
        panelId: String(body.panelId ?? ""),
        panelName: body.panelName ?? null,
        layout,
        general,
        loginMethods: {
          password: body.loginMethods?.password !== false,
          passkey: body.loginMethods?.passkey !== false,
          recovery: body.loginMethods?.recovery !== false,
        },
        modules: body.modules ?? {},
      };
      await writeCache(host, outcome);
      return outcome;
    } catch (err) {
      log.warn({ err, host }, "Failed to reach LP-LS for panel branding");
      return { state: "unreachable" };
    }
  },

  /**
   * Write-through of branding/layout entries to LP-LS for a MANAGED panel,
   * keyed by the panel's public host. Uses the shared `luxipanel_key`
   * (rotation store, env bootstrap fallback) + mTLS service channel — the
   * SAME auth as the SSH-key lookup — because managed panels have no per-panel
   * license JWT. This is the counterpart to {@link fetchByHost}: writes land on
   * the exact panel whose branding the read returns.
   *
   * Sends to the INTERNAL service base URL (`LICENSE_SERVER_AGENTS_URL`, the
   * loopback `http://127.0.0.1:3300` on co-located deployments), NOT the public
   * `LICENSE_SERVER_URL`. The `luxipanel_key` channel is gated by LP's
   * `LUXIPANEL_ALLOWED_IPS` (loopback-only by default), so a write over the
   * public hostname arrives with a non-loopback IP and is rejected 401 — the
   * exact same reason SSO/agents calls also go over this internal URL. The READ
   * path (`fetchByHost`) keeps using the public URL because `/public/panel-branding`
   * is unauthenticated and has no IP allowlist.
   *
   * Throws on transport failure or LP rejection so the caller can surface the
   * error to the admin instead of silently dropping the change.
   */
  async putBrandingByHost(rawHost: string | undefined | null, entries: BrandingEntry[]): Promise<{ written: number }> {
    if (entries.length === 0) return { written: 0 };
    const host = normalizeHost(rawHost);
    if (!host) throw new Error("No se pudo determinar el host del panel");
    const key = getActiveSharedSecret("luxipanel_key") || env.LUXIPANEL_KEY;
    if (!key) throw new Error("LUXIPANEL_KEY no disponible para escribir branding");

    // Mirror the panel-side single-logo model onto the legacy per-slot keys
    // LP-LS still understands, so the brand stays consistent across legacy
    // clients reading the per-slot paths.
    const expandedEntries = expandLegacyLogoSlots(entries);

    // Same internal-URL resolution as ssoBaseUrl()/agentsBaseUrl(): the service
    // channel is loopback-trusted, so authenticated writes must NOT use the
    // public LICENSE_SERVER_URL.
    const serviceBaseUrl = agentsBaseUrl();

    // LP-LS valida `entries` con .max(200) por request (panel-api
    // `/panel-api/service/branding`). Un tema completo (paletas claro/oscuro +
    // efectos de login/panel) supera fácilmente las 700 entradas; sin trocear,
    // LP devuelve 400 "Array must contain at most 200 element(s)" y se perdía
    // TODO el guardado de apariencia (layout + general público + login_methods
    // viajan en el MISMO array). `upsertBulk` en LP es upsert por clave
    // (onConflictDoUpdate, sin borrado masivo), así que escribir en lotes
    // acumula sin pisar lo previo. Sumamos lo escrito por cada lote.
    const MAX_ENTRIES_PER_REQUEST = 200;
    let written = 0;
    for (let i = 0; i < expandedEntries.length; i += MAX_ENTRIES_PER_REQUEST) {
      const batch = expandedEntries.slice(i, i + MAX_ENTRIES_PER_REQUEST);
      const json = await postLicenseServerJson<{ ok?: boolean; written?: number; error?: unknown }>(
        "/panel-api/service/branding",
        { host, entries: batch },
        WRITE_TIMEOUT_MS,
        { Authorization: `Bearer ${key}` },
        serviceBaseUrl,
      );
      if (!json?.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "LP-LS rechazó el branding");
      }
      written += json.written ?? batch.length;
    }
    return { written };
  },

  /** Force-clear cache. Pass a host to invalidate one entry, omit to clear all. */
  async invalidate(host?: string): Promise<void> {
    const normalized = host ? normalizeHost(host) : null;
    await deleteCache(normalized ?? undefined);
  },
};
