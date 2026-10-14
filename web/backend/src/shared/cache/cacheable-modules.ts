// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * shared/cache — Cacheability policy registry (Hito 1).
 *
 * Single source of truth for WHICH module data may be mirrored into the
 * per-client-server Redis cache that feeds the DataTables, and HOW the
 * client-side engine produces each view.
 *
 * Design invariants (security-first):
 *   1. ALLOWLIST, never denylist. Anything not explicitly registered here is
 *      NOT cacheable. `cachePolicyFor()` returns `null` by default, so a new
 *      module/collection can never be cached by accident.
 *   2. A hard `VOLATILE_MODULES` denylist makes it *impossible* to register a
 *      volatile/real-time module even on purpose: `defineModule()` calls
 *      `assertNotVolatile()` at registry-build time, so the process fails
 *      fast on a misconfiguration instead of silently caching volatile data.
 *   3. `NEVER_CACHE` blocks individual security/ephemeral collections inside
 *      an otherwise-cacheable module (e.g. `auth/otp` while `auth/users` is
 *      cacheable).
 *
 * Volatile / real-time data (files, terminal, monitor, backup, cron,
 * security-audit) and short-lived auth secrets are excluded by construction
 * and never touch Redis. Per-server isolation is enforced one layer up
 * (cache keys are namespaced by `target.id`); this module only decides
 * eligibility and shape.
 *
 * This file is pure policy data (its only import is the wire-prefix SSOT from
 * `remote-cache/keys.ts`, plain string constants) so it can be unit-tested in
 * isolation and consumed by both the engine installer (Hito 2) and the read
 * path / Ajustes → Módulos (Hitos 4–6).
 */

import { RC_KEY_PREFIX, WQ_KEY_PREFIX } from "../remote-cache/keys.js";

/** How the client-side engine populates a collection's cached DataTable view. */
export type CacheSource =
  /** Mirror the JSON sidecar LUXIPANEL already writes under LUXIPANEL_CONFIG_DIR. */
  | "sidecar-mirror"
  /** Run a module-specific collector that derives live state from the system. */
  | "system-collector";

export interface CollectionCachePolicy {
  readonly source: CacheSource;
  /**
   * Default refresh interval for the client-side engine, in seconds. This is
   * only the default — Ajustes → Módulos (Hito 6) can override it per server
   * via the client-side `schedule.json`. Must be > 0.
   */
  readonly defaultIntervalSeconds: number;
  /**
   * Top-level fields kept in the precomputed DataTable view (projection). The
   * engine drops every other field so the cached blob is as small as
   * possible. `undefined` means "keep the full document". When present it
   * must be non-empty.
   */
  readonly projection?: readonly string[];
  /**
   * For `system-collector` only: the id of the collector script installed on
   * the client server (e.g. `collector-ssl`). Ignored for `sidecar-mirror`.
   */
  readonly collector?: string;
  /**
   * When true, the engine also emits per-scope blobs keyed by the value of
   * `scopeField` on each row, in addition to the unscoped full blob.
   * Controllers that filter by that field can request just the relevant
   * scope's blob via `serveCachedDataTable({ scope })`, and mutations can
   * invalidate only that scope's key instead of the whole collection.
   */
  readonly scoped?: boolean;
  /**
   * Required when `scoped: true`. The top-level row field whose value
   * defines the scope (e.g. `"accountId"` for mail/contacts).
   */
  readonly scopeField?: string;
  /**
   * When true, mutations (create/edit/delete) on this collection are routed
   * through the per-server write-behind queue (`lpwq:*`) instead of running
   * synchronously over SSH: the panel enqueues a step recipe and returns
   * immediately, and the client-side worker applies it on-box. Only the read
   * cache (above) decides freshness; this flag governs the write path. Off by
   * default — a collection is migrated to the queue explicitly, module by
   * module.
   */
  readonly writable?: boolean;
}

export interface ModuleCachePolicy {
  readonly module: string;
  readonly collections: Readonly<Record<string, CollectionCachePolicy>>;
}

/**
 * Hard denylist. These modules expose volatile / real-time / large-binary
 * data and must NEVER be cached, even by an explicit registry entry.
 * Registering any of them throws at module-load time.
 */
export const VOLATILE_MODULES: ReadonlySet<string> = new Set([
  "files", // arbitrary file contents / directory listings (volatile, large)
  "terminal", // interactive sessions
  "terminal-cli", // live CLI state
  "monitor", // real-time metrics / alert events
  "security-audit", // live audit stream
  // NOTE: `cron` and `backup` are NOT module-wide volatile — their
  // configuration collections (`cron/jobs`, `backup/schedules`) are static
  // and cacheable. The volatile run-streams (`cron/history`, `backup/jobs`)
  // are blocked individually in NEVER_CACHE below.
]);

/**
 * Security/ephemeral collections inside otherwise-cacheable modules. These
 * are short-lived secrets or append-only security logs and must never be
 * mirrored. Keyed as `"<module>/<collection>"`.
 */
export const NEVER_CACHE: ReadonlySet<string> = new Set([
  "auth/otp",
  "auth/totp",
  "auth/passkeys",
  "auth/recovery-codes",
  "auth/audit-log",
  // Tenant records include passwordHash. The old hosting/accounts collector
  // emitted discovered vhosts with a different shape under the same key.
  "hosting/accounts",
  // Live cron execution logs (streamed) — distinct from `cron/jobs` which
  // is the static crontab listing and IS cacheable.
  "cron/history",
  // Live backup-run records — distinct from `backup/schedules` which is the
  // static schedule config and IS cacheable.
  "backup/jobs",
]);

/** Throws if `module` is on the volatile hard-denylist. */
export function assertNotVolatile(module: string): void {
  if (VOLATILE_MODULES.has(module)) {
    throw new Error(
      `[cacheable-modules] module "${module}" is volatile/real-time and must never be cached`,
    );
  }
}

/** True if `module` is on the volatile hard-denylist. */
export function isVolatileModule(module: string): boolean {
  return VOLATILE_MODULES.has(module);
}

/**
 * Build a frozen module policy, enforcing the invariants at registry-build
 * time so a bad entry fails the process fast instead of leaking volatile data.
 */
function defineModule(
  module: string,
  collections: Record<string, CollectionCachePolicy>,
): ModuleCachePolicy {
  assertNotVolatile(module);
  for (const [collection, policy] of Object.entries(collections)) {
    const key = `${module}/${collection}`;
    if (NEVER_CACHE.has(key)) {
      throw new Error(
        `[cacheable-modules] collection "${key}" is on NEVER_CACHE and cannot be registered`,
      );
    }
    if (!(policy.defaultIntervalSeconds > 0)) {
      throw new Error(
        `[cacheable-modules] "${key}" defaultIntervalSeconds must be > 0`,
      );
    }
    if (policy.projection && policy.projection.length === 0) {
      throw new Error(
        `[cacheable-modules] "${key}" projection, when present, must be non-empty`,
      );
    }
    if (policy.source === "system-collector" && !policy.collector) {
      throw new Error(
        `[cacheable-modules] "${key}" is a system-collector but has no collector id`,
      );
    }
    if (policy.scoped && !policy.scopeField) {
      throw new Error(
        `[cacheable-modules] "${key}" is scoped but missing scopeField`,
      );
    }
    Object.freeze(policy);
    if (policy.projection) Object.freeze(policy.projection);
  }
  return Object.freeze({
    module,
    collections: Object.freeze({ ...collections }),
  });
}

/**
 * The allowlist. Module/collection pairs are the real `kv-store`
 * (MODULE, COLLECTION) constants in the codebase, except `system-collector`
 * views (ssl/nginx/mail) which are derived from system state and have no
 * sidecar of their own.
 */
const REGISTRY: Readonly<Record<string, ModuleCachePolicy>> = Object.freeze({
  // Linux system users — output of `getent passwd` enriched with `passwd -Sa`
  // lock flag. NOT panel admin users (those have no DataTable endpoint).
  users: defineModule("users", {
    // Linux system users — `getent passwd` + `passwd -Sa` lock flag.
    // No projection: engine emits the FULL LinuxUserRow shape so the
    // controller can swap its loader for the cached blob 1:1.
    system: {
      source: "system-collector",
      collector: "collector-users",
      defaultIntervalSeconds: 300,
      writable: true,
    },
    // Linux groups — `getent group` with members array.
    roles: {
      source: "system-collector",
      collector: "collector-roles",
      defaultIntervalSeconds: 600,
    },
  }),

  // Ajustes — single sidecar `admin/settings.json` (small, no projection).
  admin: defineModule("admin", {
    settings: {
      source: "sidecar-mirror",
      defaultIntervalSeconds: 300,
    },
  }),

  // Correos — accounts derive live mailbox/account state on the client, the
  // rest are non-volatile config sidecars.
  mail: defineModule("mail", {
    // Mail accounts — postfix vmailbox + dovecot users + forwards sidecar
    // + per-account quota (maildirsize / doveadm). Engine output mirrors the
    // controller's response row 1:1. Projection drops `passwordHash` so it
    // never lands in Redis even though the engine has it in flight.
    accounts: {
      source: "system-collector",
      collector: "collector-mail",
      defaultIntervalSeconds: 300,
      // Pilot of the write-behind queue: create/edit/delete are enqueued and
      // applied on-box by worker.py instead of running synchronously over SSH.
      writable: true,
      projection: [
        "usedMb", "usedPercent", "id", "address", "domain", "displayName",
        "quotaMb", "enabled", "incomingMode", "outgoingMode", "loginMode",
        "plusAddressingAutoFolder", "forwards", "forwardCount", "createdAt",
      ],
    },
    // Per-account collections: the engine emits one blob per account (keyed
    // by `accountId`) plus the unscoped full blob. Mutations on one account
    // invalidate only that account's scope, not the whole collection.
    autoresponders: { source: "sidecar-mirror", defaultIntervalSeconds: 600,
      scoped: true, scopeField: "accountId" },
    filters: { source: "sidecar-mirror", defaultIntervalSeconds: 600,
      scoped: true, scopeField: "accountId" },
    forwards: { source: "sidecar-mirror", defaultIntervalSeconds: 600,
      scoped: true, scopeField: "accountId" },
    contacts: { source: "sidecar-mirror", defaultIntervalSeconds: 900,
      scoped: true, scopeField: "accountId" },
    calendars: { source: "sidecar-mirror", defaultIntervalSeconds: 900,
      scoped: true, scopeField: "accountId" },
    signatures: { source: "sidecar-mirror", defaultIntervalSeconds: 900,
      scoped: true, scopeField: "accountId" },
  }),

  // Notificaciones — sidecar; short interval + refresh-on-write (Hito 5)
  // keeps it fresh without a tight global poll.
  notifications: defineModule("notifications", {
    notifications: {
      source: "sidecar-mirror",
      defaultIntervalSeconds: 120,
      projection: ["id", "type", "title", "read", "createdAt"],
    },
  }),

  // Webhooks / API keys — non-volatile config sidecars.
  webhooks: defineModule("webhooks", {
    webhooks: { source: "sidecar-mirror", defaultIntervalSeconds: 600 },
    "api-keys": {
      source: "sidecar-mirror",
      defaultIntervalSeconds: 600,
      projection: ["id", "name", "prefix", "createdAt", "lastUsedAt"],
    },
  }),

  // NGINX manager (license/permission slug stays "dns"). Source of truth is
  // /etc/nginx on the client, so this is a system-collector view.
  nginx: defineModule("nginx", {
    sites: {
      source: "system-collector",
      collector: "collector-nginx",
      defaultIntervalSeconds: 600,
      projection: ["name", "file", "enabled", "domains", "root", "proxyPass", "ssl", "kind"],
    },
  }),

  // Cron entries — `crontab -l` (root) parsed into schedule + command.
  cron: defineModule("cron", {
    jobs: {
      source: "system-collector",
      collector: "collector-cron",
      defaultIntervalSeconds: 600,
      writable: true,
    },
  }),

  // UFW firewall rules — `ufw status numbered`.
  firewall: defineModule("firewall", {
    rules: {
      source: "system-collector",
      collector: "collector-firewall",
      defaultIntervalSeconds: 600,
      writable: true,
    },
  }),

  // Backup schedules — kv-store sidecar. Cron-style entries, static config.
  // Per-run history (`backup/jobs`) is blocked in NEVER_CACHE above.
  backup: defineModule("backup", {
    schedules: {
      source: "sidecar-mirror",
      defaultIntervalSeconds: 900,
    },
  }),
});

/**
 * Returns the cache policy for a module/collection, or `null` if it is not
 * cacheable (the default). Volatile modules always return `null`.
 */
export function cachePolicyFor(
  module: string,
  collection: string,
): CollectionCachePolicy | null {
  if (VOLATILE_MODULES.has(module)) return null;
  if (NEVER_CACHE.has(`${module}/${collection}`)) return null;
  return REGISTRY[module]?.collections[collection] ?? null;
}

/** Convenience boolean wrapper around {@link cachePolicyFor}. */
export function isCacheable(module: string, collection: string): boolean {
  return cachePolicyFor(module, collection) !== null;
}

/**
 * True when mutations on this collection should go through the write-behind
 * queue. Implies it is cacheable (the queue triggers the read collector on
 * apply). Consumed by the submit-mutation layer to decide enqueue vs. sync.
 */
export function isWritable(module: string, collection: string): boolean {
  return cachePolicyFor(module, collection)?.writable === true;
}

export interface CacheableEntry {
  readonly module: string;
  readonly collection: string;
  readonly policy: CollectionCachePolicy;
}

/**
 * Flat list of every cacheable module/collection. Consumed by the engine
 * installer (Hito 2) and Ajustes → Módulos (Hito 6).
 */
export function listCacheableCollections(): CacheableEntry[] {
  const out: CacheableEntry[] = [];
  for (const mod of Object.values(REGISTRY)) {
    for (const [collection, policy] of Object.entries(mod.collections)) {
      out.push({ module: mod.module, collection, policy });
    }
  }
  return out;
}

/** The frozen registry, exposed read-only for inspection/tests. */
export const cacheableRegistry = REGISTRY;

/**
 * Serialize the policy to the plain JSON the client-side engine bundle
 * consumes (`cache-policy.json`). The TypeScript registry is the single
 * source of truth; the provisioner (Hito 3) ships this file to the client so
 * the shell/python engines stay generic and data-driven. `schemaVersion`
 * lets the engine reject an incompatible policy.
 */
export const CACHE_POLICY_SCHEMA_VERSION = 1;

export interface CachePolicyExport {
  readonly schemaVersion: number;
  /**
   * Read-cache Redis key namespace (`lprc:v1`). Emitted so the client-side
   * Python engines read it from the shipped policy instead of re-embedding the
   * literal — single source of truth is `remote-cache/keys.ts` (`RC_KEY_PREFIX`).
   */
  readonly keyPrefix: string;
  /**
   * Write-queue Redis key namespace (`lpwq:v1`). Paired wire contract with
   * `keyPrefix`; SSOT is `remote-cache/keys.ts` (`WQ_KEY_PREFIX`).
   */
  readonly writeQueuePrefix: string;
  readonly collections: ReadonlyArray<{
    readonly module: string;
    readonly collection: string;
    readonly source: CacheSource;
    readonly defaultIntervalSeconds: number;
    readonly projection: readonly string[] | null;
    readonly collector: string | null;
    readonly scoped: boolean;
    readonly scopeField: string | null;
    readonly writable: boolean;
  }>;
}

export function exportCachePolicy(): CachePolicyExport {
  return {
    schemaVersion: CACHE_POLICY_SCHEMA_VERSION,
    keyPrefix: RC_KEY_PREFIX,
    writeQueuePrefix: WQ_KEY_PREFIX,
    collections: listCacheableCollections().map((e) => ({
      module: e.module,
      collection: e.collection,
      source: e.policy.source,
      defaultIntervalSeconds: e.policy.defaultIntervalSeconds,
      projection: e.policy.projection ? [...e.policy.projection] : null,
      collector: e.policy.collector ?? null,
      scoped: Boolean(e.policy.scoped),
      scopeField: e.policy.scopeField ?? null,
      writable: Boolean(e.policy.writable),
    })),
  };
}

/**
 * Typed registry of the (module, collection) tuples used as cache/write-queue
 * keys across the controllers/services. Collapsing the raw string literals that
 * were repeated at every `serveCachedDataTable`/`refreshSync`/`submitMutation`/
 * `dataStore` call site into this one const removes the duplication and makes a
 * typo a compile error. The values are byte-identical to the literals they
 * replace. Only the pairs actually consumed below are listed.
 */
export const CACHE_KEYS = {
  nginx:    { sites:      { module: "nginx",    collection: "sites"      } },
  firewall: { rules:      { module: "firewall", collection: "rules"      } },
  cron:     { jobs:       { module: "cron",     collection: "jobs"       } },
  mail:     { accounts:   { module: "mail",     collection: "accounts"   } },
  hosting:  { accounts:   { module: "hosting",  collection: "accounts"   } },
  users:    { system:     { module: "users",    collection: "system"     },
              roles:      { module: "users",    collection: "roles"      } },
  backup:   { jobs:       { module: "backup",   collection: "jobs"       } },
  obsidian: { containers: { module: "obsidian", collection: "containers" } },
} as const;
