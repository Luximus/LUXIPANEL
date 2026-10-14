/**
 * Panel public origin — the URL the users actually reach THIS panel on
 * (per-panel subdomain, e.g. https://xxxx.luxipanel.com). LUXIPANEL is
 * multi-user/multi-server, so this can NOT be a .env constant: it is learned
 * from AUTHENTICATED requests (x-forwarded-host/proto set by nginx/Cloudflare
 * or the frontend proxy) and persisted as INSTANCE state on the panel host,
 * so background jobs (cron schedulers) can build absolute links (approval
 * URLs in report emails) without a request in scope.
 *
 * Only call `rememberPanelOrigin` from AUTHENTICATED handlers — recording
 * unauthenticated traffic would let an attacker poison the stored origin
 * with a forged Host header and phish capability links.
 */

import type { Request } from "express";
import { dataStore } from "../data-store/index.js";
import { localExecutor } from "../executor/index.js";
import { firstForwardedValue } from "../utils/host.js";

interface PanelUrlDoc {
  origin: string;
  updatedAt?: string;
}

const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;
const LOCAL_RE = /^(localhost|127\.|0\.0\.0\.0|\[?::1)/i;

function store() {
  return dataStore<PanelUrlDoc>(localExecutor, "panel", "instance");
}

let cached: string | null | undefined; // undefined = not loaded yet

/** Last-known public origin of this panel (no trailing slash) or null. */
export async function getPanelOrigin(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const rec = await store().get("url");
    cached = rec?.origin ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Record the origin of an AUTHENTICATED request (cheap; persists on change).
 *
 *  NOTE — deliberately NOT collapsed into `shared/http/panel-origin.ts`: that
 *  helper trusts the header as-is, whereas this one is PERSISTED instance state
 *  (a forged Host would phish every capability link built later), so it also
 *  validates the host shape and forces `https`. Only the header-parsing idiom
 *  (`firstForwardedValue`) is shared. */
export function rememberPanelOrigin(req: Request): void {
  const fwdHost = firstForwardedValue(req.headers["x-forwarded-host"]);
  const host = fwdHost || String(req.headers.host ?? "").trim();
  if (!host || !HOST_RE.test(host) || LOCAL_RE.test(host)) return;
  const fwdProto = firstForwardedValue(req.headers["x-forwarded-proto"]);
  const proto = fwdProto === "http" || fwdProto === "https" ? fwdProto : "https";
  const origin = `${proto}://${host}`;
  if (origin === cached) return;
  cached = origin;
  void store()
    .set("url", { origin, updatedAt: new Date().toISOString() })
    .catch(() => undefined);
}
