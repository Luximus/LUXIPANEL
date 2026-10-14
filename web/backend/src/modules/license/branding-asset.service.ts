// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Branding-asset cache — turns external image URLs into a hash-addressed
 * `/api/branding/asset/<hash>` route so the browser hits LUXIPANEL once and
 * subsequent loads are served from Redis instead of re-fetching the customer's
 * external host every time.
 *
 * Flow:
 *   1. `panel-branding.client.ts` calls `register(url)` after fetching from
 *      LP-LS. We hash the URL and remember it in Redis (text-only key).
 *   2. The returned `/api/branding/asset/<hash>` path replaces the original
 *      external URL in the layout map.
 *   3. The first browser request to that path lazily fetches the bytes once
 *      and caches them in Redis as a binary buffer.
 *
 * SSRF guard: the endpoint only serves hashes that are already registered.
 * We never blindly fetch a URL the client supplied — only ones an LP-LS
 * response gave us.
 */

import crypto from "node:crypto";
import { ONE_DAY_SECONDS, BRANDING_UPLOAD_MAX_BYTES } from "../../shared/constants.js";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getRedis } from "../../shared/redis/index.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { CONFIG_DIR } from "@config/paths.js";
import { env } from "@config/env.js";

const log = createModuleLogger("branding-asset");

/**
 * Durable URL map — `hash → external URL`, persisted on the panel host under
 * `${LUXIPANEL_CONFIG_DIR}/branding-assets.json`. Branding is per-instance
 * state that lives on the panel host (no per-server executor), so a plain file
 * is the right backing store.
 *
 * Why: Redis on this host has no persistence and the `url:` key has a 24h TTL.
 * After a Redis restart (or TTL expiry) the layout HTML still references the
 * `/api/branding/asset/<hash>` path, but the URL behind it is gone → 404. The
 * disk map is the source of truth: `register()` writes it, and `serve()`
 * recovers from it (re-populating Redis) when the Redis key is missing.
 */
const ASSET_MAP_CANDIDATE_PATHS: string[] = [
  env.BRANDING_ASSET_FILE,
  path.join(CONFIG_DIR, "branding-assets.json"),
  path.join(os.homedir() || "/tmp", ".luxipanel", "branding-assets.json"),
  path.join(process.cwd(), "data", "branding-assets.json"),
].filter((p): p is string => typeof p === "string" && p.length > 0);

let resolvedMapPath: string | null = null;
let urlMap: Record<string, string> = {};
let mapInitialized = false;

async function resolveWritableMapPath(): Promise<string | null> {
  for (const candidate of ASSET_MAP_CANDIDATE_PATHS) {
    try {
      await fs.mkdir(path.dirname(candidate), { recursive: true });
      const fh = await fs.open(candidate, "a");
      await fh.close();
      return candidate;
    } catch (err: any) {
      log.debug({ path: candidate, err: err?.code }, "branding-assets path no writable, probando siguiente");
    }
  }
  log.warn("Ningún path writable para branding-assets — modo solo-memoria");
  return null;
}

async function loadMapFromDisk(): Promise<void> {
  if (mapInitialized) return;
  resolvedMapPath = await resolveWritableMapPath();
  if (resolvedMapPath) {
    try {
      const raw = await fs.readFile(resolvedMapPath, "utf8");
      const parsed = raw.trim().length > 0 ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") urlMap = parsed as Record<string, string>;
      log.info({ count: Object.keys(urlMap).length, path: resolvedMapPath }, "branding-assets cargado desde disco");
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        log.error({ err: err?.message, path: resolvedMapPath }, "Error leyendo branding-assets — empezando vacío");
      }
      urlMap = {};
    }
  }
  mapInitialized = true;
}

async function persistMapToDisk(): Promise<void> {
  if (!resolvedMapPath) return; // modo memoria-only
  try {
    const tmp = `${resolvedMapPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(urlMap, null, 2), { mode: 0o600 });
    await fs.rename(tmp, resolvedMapPath);
  } catch (err: any) {
    log.error({ err: err?.message, path: resolvedMapPath }, "No se pudo persistir branding-assets.json");
  }
}

const URL_TTL_S = ONE_DAY_SECONDS;
const BYTES_TTL_S = ONE_DAY_SECONDS;
const NEG_TTL_S = 60;
const MAX_BYTES = BRANDING_UPLOAD_MAX_BYTES; // 5 MiB (SSOT: shared/constants.ts)
const BRANDING_ASSET_FETCH_TIMEOUT_MS = 8_000;

const URL_PREFIX = "lxp:branding:asset:url:";
const BYTES_PREFIX = "lxp:branding:asset:bytes:";
const MIME_PREFIX = "lxp:branding:asset:mime:";
const NEG_PREFIX = "lxp:branding:asset:bad:";

const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon", "image/avif",
]);

function hashUrl(url: string): string {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

/** Whether a string looks like an external http(s) URL we should proxy. */
export function shouldProxyUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

export const brandingAssetService = {
  /**
   * Register a URL for proxied serving. Returns the path the browser should
   * use (e.g. `/api/branding/asset/<hash>`). Idempotent — calling with the
   * same URL returns the same hash.
   */
  async register(url: string): Promise<string> {
    const hash = hashUrl(url);
    try {
      // Refresh TTL on every register so popular URLs stay hot.
      await getRedis().set(`${URL_PREFIX}${hash}`, url, "EX", URL_TTL_S);
    } catch (err) {
      log.debug({ err: (err as Error).message }, "asset URL register failed (non-fatal)");
    }
    // Durable backup: survives Redis restart / 24h TTL expiry so `serve()` can
    // always recover the source URL behind a hash the layout still references.
    if (!mapInitialized) await loadMapFromDisk();
    if (urlMap[hash] !== url) {
      urlMap[hash] = url;
      await persistMapToDisk();
    }
    return `/api/branding/asset/${hash}`;
  },

  /**
   * Reverse of `register()`: resolve a `/api/branding/asset/<hash>` proxy path
   * back to the original external URL the admin set. Used to populate the
   * EDITABLE settings form so the admin sees (and re-saves) their real logo URL,
   * never the opaque internal proxy path. Without this the proxy path leaks into
   * the form and, on the next save, gets written back to LP-LS as the canonical
   * value — but it isn't an http(s) URL, so `register()` never re-resolves it,
   * the original URL is lost, and external/app consumers receive an unloadable
   * relative path. Best-effort: if the hash is unknown (mapping lost), returns
   * the input unchanged; anything that isn't a proxy path passes through as-is.
   */
  async sourceUrlFor(value: string): Promise<string> {
    const m = /^\/api\/branding\/asset\/([a-f0-9]{16})$/i.exec((value ?? "").trim());
    const hashMatch = m?.[1];
    if (!hashMatch) return value;
    const hash = hashMatch.toLowerCase();
    try {
      const fromRedis = await getRedis().get(`${URL_PREFIX}${hash}`);
      if (fromRedis) return fromRedis;
    } catch (err) {
      log.debug({ err: (err as Error).message, hash }, "sourceUrlFor redis lookup failed");
    }
    if (!mapInitialized) await loadMapFromDisk();
    return urlMap[hash] ?? value;
  },

  /**
   * Serve bytes for a registered hash. Returns `null` when the hash isn't
   * known or the upstream fetch fails — caller should respond 404.
   */
  async serve(hash: string): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!/^[a-f0-9]{16}$/i.test(hash)) return null;
    const redis = getRedis();

    // Negative cache — short TTL so we don't retry broken URLs in a loop.
    const negFlag = await redis.get(`${NEG_PREFIX}${hash}`);
    if (negFlag) return null;

    // Hot path: bytes already cached.
    const cachedBytes = await redis.getBuffer(`${BYTES_PREFIX}${hash}`);
    if (cachedBytes && cachedBytes.length > 0) {
      const mime = (await redis.get(`${MIME_PREFIX}${hash}`)) || "application/octet-stream";
      return { bytes: cachedBytes, mime };
    }

    // Look up the source URL (we only fetch URLs we previously registered).
    let url = await redis.get(`${URL_PREFIX}${hash}`);
    if (!url) {
      // Redis lost the key (restart / TTL expiry). Recover from the durable
      // disk map and re-populate Redis so subsequent reads are hot again.
      if (!mapInitialized) await loadMapFromDisk();
      const persisted = urlMap[hash];
      if (persisted) {
        url = persisted;
        await redis.set(`${URL_PREFIX}${hash}`, persisted, "EX", URL_TTL_S).catch(() => undefined);
        log.info({ hash }, "Asset URL recovered from disk map");
      }
    }
    if (!url) {
      log.debug({ hash }, "Asset hash not registered");
      return null;
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(BRANDING_ASSET_FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        log.warn({ url, status: res.status }, "Asset upstream non-OK");
        await redis.set(`${NEG_PREFIX}${hash}`, "1", "EX", NEG_TTL_S);
        return null;
      }
      const mime = (res.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
      if (mime && !ALLOWED_MIME.has(mime)) {
        log.warn({ url, mime }, "Asset upstream returned non-image MIME");
        await redis.set(`${NEG_PREFIX}${hash}`, "1", "EX", NEG_TTL_S);
        return null;
      }
      const contentLengthHeader = res.headers.get("content-length");
      if (contentLengthHeader && Number(contentLengthHeader) > MAX_BYTES) {
        log.warn({ url, size: contentLengthHeader }, "Asset upstream exceeds size limit");
        await redis.set(`${NEG_PREFIX}${hash}`, "1", "EX", NEG_TTL_S);
        return null;
      }
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) {
        await redis.set(`${NEG_PREFIX}${hash}`, "1", "EX", NEG_TTL_S);
        return null;
      }
      const buf = Buffer.from(arrayBuffer);
      const finalMime = mime || "application/octet-stream";
      await redis.set(`${BYTES_PREFIX}${hash}`, buf, "EX", BYTES_TTL_S);
      await redis.set(`${MIME_PREFIX}${hash}`, finalMime, "EX", BYTES_TTL_S);
      return { bytes: buf, mime: finalMime };
    } catch (err) {
      log.warn({ url, err: (err as Error).message }, "Asset upstream fetch failed");
      await redis.set(`${NEG_PREFIX}${hash}`, "1", "EX", NEG_TTL_S);
      return null;
    }
  },
};
