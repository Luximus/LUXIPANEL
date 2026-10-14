// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Webhook discovery — orchestrator.
 *
 * Runs every detector against the connected client server, flattens, dedupes
 * (by stable id), and sorts. Detectors run concurrently and fail-soft: one
 * source erroring out never kills the whole scan.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import type { DiscoveredWebhook, DiscoveryCategory } from "../../models/discovery.model.js";
import { DETECTOR_TIMEOUT_MS, type WebhookDetector } from "./types.js";
import { sidecarDetector } from "./sidecar.detector.js";
import { gitHooksDetector } from "./git-hooks.detector.js";
import { nginxDetector } from "./nginx.detector.js";
import { systemDetector } from "./system.detector.js";
import { projectsDetector } from "./projects.detector.js";

const log = createModuleLogger("webhook-discovery");

const DETECTORS: WebhookDetector[] = [
  sidecarDetector,
  gitHooksDetector,
  nginxDetector,
  systemDetector,
  projectsDetector,
];

const SOURCE_ORDER: Record<string, number> = {
  sidecar: 0,
  nginx: 1,
  "git-hook": 2,
  cron: 3,
  systemd: 4,
  config: 5,
  project: 6,
};

/**
 * Scanning criterion → category. The receive-data criterion is the existing
 * inbound-receiver detection: nginx receiver/proxy locations and in-project
 * route handlers (path-shaped targets). Outbound senders (cron/systemd/config/
 * git-hook), legacy event webhooks (sidecar) and in-project *references* to
 * external webhook URLs fall into `other`. `mailhook`/`response` have no
 * auto-scan criterion yet (defined in later phases).
 */
function classifyCategory(item: DiscoveredWebhook): DiscoveryCategory {
  if (item.source === "nginx") return "receive-data";
  if (item.source === "project" && typeof item.target === "string" && item.target.startsWith("/")) {
    return "receive-data";
  }
  return "other";
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

// Per-target result cache. A full scan fans out to hundreds of bounded SSH
// greps; the discovered set barely changes between the tab load and the
// follow-up `action` call, so serve a recent scan instead of re-running the
// whole sweep (which the `action` id-lookup did on every management click).
interface DiscoveryCacheEntry {
  at: number;
  data: DiscoveredWebhook[];
}
const DISCOVERY_CACHE_TTL_MS = 30_000;
const DISCOVERY_CACHE_CAP = 100;
const _discoveryCache = new Map<string, DiscoveryCacheEntry>();

export const webhookDiscoveryService = {
  /**
   * Scan the connected server across all sources.
   * @param opts.force  Skip the per-target cache and run a fresh scan.
   */
  async discover(executor: Executor, opts?: { force?: boolean }): Promise<DiscoveredWebhook[]> {
    const cacheKey = executor.target.id;
    const now = Date.now();
    if (!opts?.force) {
      const hit = _discoveryCache.get(cacheKey);
      if (hit && now - hit.at < DISCOVERY_CACHE_TTL_MS) return hit.data;
    }

    const settled = await Promise.allSettled(
      DETECTORS.map((d) =>
        withTimeout(d.detect(executor), DETECTOR_TIMEOUT_MS, [] as DiscoveredWebhook[]).catch(
          (err) => {
            log.warn({ err, source: d.source }, "detector failed");
            return [] as DiscoveredWebhook[];
          },
        ),
      ),
    );

    const byId = new Map<string, DiscoveredWebhook>();
    for (const res of settled) {
      if (res.status !== "fulfilled") continue;
      for (const item of res.value) {
        if (!byId.has(item.id)) byId.set(item.id, { ...item, category: classifyCategory(item) });
      }
    }

    const result = Array.from(byId.values()).sort((a, b) => {
      const sa = SOURCE_ORDER[a.source] ?? 99;
      const sb = SOURCE_ORDER[b.source] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name) || a.target.localeCompare(b.target);
    });

    // FIFO-evict the oldest entry past the cap so a panel bridging many targets
    // can't grow the cache without bound.
    if (_discoveryCache.size >= DISCOVERY_CACHE_CAP && !_discoveryCache.has(cacheKey)) {
      const oldest = _discoveryCache.keys().next().value;
      if (oldest !== undefined) _discoveryCache.delete(oldest);
    }
    _discoveryCache.set(cacheKey, { at: now, data: result });
    return result;
  },
};
