import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, randomBytes } from "node:crypto";
import type { RequestHandler } from "express";

export type ReadFreshness = { resource: string; collectedAt: number; state: "fresh" | "stale"; source: "snapshot" | "live"; targetId?: string };
const reads = new AsyncLocalStorage<ReadFreshness[]>();
const secret = randomBytes(32);
export const LIVE_ROUTES: Readonly<Record<string, string>> = {
  "/api/users": "users/system", "/api/roles": "users/roles",
  "/api/nginx/sites": "nginx/sites", "/api/accounts": "mail/accounts",
  "/api/firewall/rules": "firewall/rules", "/api/cron/jobs": "cron/jobs",
  "/api/backups/schedules": "backup/schedules", "/api/webhooks": "webhooks/webhooks",
};
export function noteRead(value: ReadFreshness) { reads.getStore()?.push(value); }
/** Decorate only the final authorized/filtered/joined result. A known version
 * never skips authentication, controller authorization or pagination. */
export const responseFreshness: RequestHandler = (req, res, next) => {
  const resource = req.method === "GET" ? LIVE_ROUTES[req.path] : undefined;
  if (!resource) { next(); return; }
  const observations: ReadFreshness[] = [];
  const send = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode !== 200 || body?.ok !== true || !("data" in body) || !res.locals.user) return send(body);
    const user = res.locals.user;
    const query = Object.fromEntries(Object.entries(req.query).filter(([key]) => key !== "knownVersion").sort(([a], [b]) => a.localeCompare(b)));
    const version = createHmac("sha256", secret).update(JSON.stringify([
      res.locals.bridgedSession ?? null, req.get("X-Mail-Target-Id") ?? null, [...new Set(observations.map(row => row.targetId).filter(Boolean))].sort(), user, req.path, query, body.data, body.meta ?? null,
    ])).digest("hex");
    const relevant = observations.filter(row => row.resource === resource);
    const freshness = {
      version, state: relevant.some(row => row.state === "stale") ? "stale" : "fresh",
      collectedAt: relevant.length ? Math.min(...relevant.map(row => row.collectedAt)) : Date.now() / 1000,
      checkedAt: Date.now() / 1000, source: relevant.some(row => row.source === "snapshot") ? "snapshot" : "live",
    };
    const unchanged = req.query.knownVersion === version;
    const result = {...body, meta: {...body.meta, freshness, ...(unchanged ? {unchanged: true} : {})}};
    if (unchanged) delete result.data;
    res.set("Cache-Control", "private, no-store");
    return send(result);
  };
  reads.run(observations, next);
};
