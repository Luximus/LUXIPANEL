// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tenant resource quota checker (Fase 6, owner A3).
 *
 * Single, canonical place that (1) MEASURES a hosting tenant's current resource
 * usage (disk / domains / mail / databases / sub-users) and (2) ENFORCES the
 * caps that live on the account model (preventive — it rejects a create BEFORE
 * it runs, it does NOT install a kernel hard-limit).
 *
 * SECURITY BOUNDARY: in a `kind:"hosting"` session the executor runs as
 * `sudo -u <owner>`, so the raw module list()s (nginx sites / mail accounts /
 * databases) can return MORE than the tenant strictly owns. Every count here is
 * therefore filtered to the tenant via the `tenant-scope` ownership predicates
 * (docroot under homeRoot / mail domain ∈ tenant domains / `<owner>_` db prefix
 * / tenantGroup membership). Read-only: this module never mutates the VPS.
 *
 * FAIL-OPEN measurement: every probe is wrapped so a transient SSH/SQL failure
 * yields 0 (+ a warning) instead of throwing — a measurement hiccup must never
 * brick the stats card or block a create. The ENFORCEMENT path (assertResource-
 * Quota) is the only place that throws, and only when current+1 > max.
 *
 * Consumers:
 *   - `readTenantUsage` → the hosting `/stats` endpoint (enriched shape).
 *   - `assertResourceQuota` → the per-module create gates (nginx/mail/db) and the
 *     sub-user create path; emits QUOTA_EXCEEDED to the hosting audit log and
 *     throws `QuotaExceededError` (HTTP 402).
 */

import type { Executor } from "../executor/types.js";
import { quoteArg } from "../executor/quote.js";
import { QuotaExceededError, ServiceUnavailableError } from "../errors/index.js";
import { createModuleLogger } from "../logger/index.js";
import type { HostingAccount } from "../../modules/hosting/models/hosting-account.model.js";
import {
  isTenantDomainRoot,
  isTenantMailAddress,
  tenantDbPrefix,
  type TenantEnvelope,
} from "../tenant/tenant-scope.js";

const log = createModuleLogger("quota-checker");

/** Disk-usage measurement method actually used for a given probe. */
export type QuotaMethod = "du-best-effort" | "quota-tools";

/** A snapshot of everything a tenant currently consumes. */
export interface TenantResourceUsage {
  diskUsedMb: number;
  quotaMethod: QuotaMethod;
  domainsUsed: number;
  emailAccountsUsed: number;
  databasesUsed: number;
  subUsersUsed: number;
  /** Non-fatal notes (probe fell back, near-cap, unresolved mail domains…). */
  warnings: string[];
}

/** Build the minimal tenant envelope a checker needs from a HostingAccount. The
 *  account model carries the same fields the JWT envelope does, so admin-side
 *  callers (panel / agent) that hold the real account can reuse every checker. */
function envelopeFromAccount(account: HostingAccount): TenantEnvelope {
  return {
    owner: account.username,
    tenantGroup: account.tenantGroup,
    homeRoot: account.homeRoot.replace(/\/+$/, ""),
    maxSubUsers: account.maxSubUsers,
    maxDomains: account.maxDomains,
    maxEmailAccounts: account.maxEmailAccounts,
    maxDatabases: account.maxDatabases,
    diskQuotaMb: account.diskQuotaMb,
    allowedModules: account.allowedModules,
    permissionTemplate: account.permissionTemplate,
  };
}

// ── Disk ────────────────────────────────────────────────────────────────────

/**
 * Best-effort disk usage for a tenant home. Tries `repquota -u <owner>` (real
 * kernel quota accounting, KB → MB) when the tooling is present; otherwise — and
 * on ANY failure — falls back to `du -sm <homeRoot>`. The fallback is the
 * universal default (works on every filesystem without usrquota/prjquota).
 */
export async function checkDiskUsageMb(
  executor: Executor,
  homeRoot: string,
  owner: string,
): Promise<{ usedMb: number; method: QuotaMethod }> {
  // 1) Try quota-tools (repquota). Output columns:  user used soft hard …
  //    `used` is in KB. We only attempt it when repquota exists; any hiccup
  //    (no quota mount, permission, parse) drops to du.
  try {
    const probe = await executor.exec(
      `sh -c ${quoteArg(
        `command -v repquota >/dev/null 2>&1 && sudo -n repquota -u 2>/dev/null | awk ${quoteArg(
          `$1=="${owner}"{print $3}`,
        )}`,
      )}`,
      { timeoutMs: 15_000 },
    );
    const kb = parseInt(probe.stdout.trim().split(/\s+/)[0] ?? "", 10);
    if (Number.isFinite(kb) && kb > 0) {
      return { usedMb: Math.round(kb / 1024), method: "quota-tools" };
    }
  } catch (err) {
    log.debug({ err: String(err), owner }, "repquota probe failed → du fallback");
  }

  // 2) du fallback (default). Always exits with a single integer MB or 0.
  try {
    const out = await executor.exec(`du -sm ${quoteArg(homeRoot)} 2>/dev/null`, {
      timeoutMs: 60_000,
    });
    const mb = parseInt(out.stdout.trim().split(/\s+/)[0] ?? "0", 10);
    return { usedMb: Number.isFinite(mb) ? mb : 0, method: "du-best-effort" };
  } catch (err) {
    log.debug({ err: String(err), homeRoot }, "du probe failed → 0");
    return { usedMb: 0, method: "du-best-effort" };
  }
}

// ── Domains (nginx vhosts) ───────────────────────────────────────────────────

/**
 * Count vhosts whose docroot lives under the tenant home. Returns `null` when
 * the measurement is INCONCLUSIVE (a probe threw) so the enforcement path can
 * fail closed; a genuine empty result is `0`. Callers that want fail-open (the
 * /stats card) coalesce `?? 0`.
 */
/**
 * The vhosts whose docroot lives under the tenant home, or `null` when the
 * probe threw (INCONCLUSIVE). Single source for both the count and the domain
 * set below — those two were byte-identical apart from the final projection.
 *
 * NOTE — still ONE SSH round-trip PER CALL: `readTenantUsage` measures domains
 * and emails, so `nginxSitesService.listSites` runs twice. Memoizing it would
 * need a request-scoped cache with its own staleness contract, so it is left
 * as-is (perf, not correctness).
 */
async function listTenantSites(
  executor: Executor,
  homeRoot: string,
): Promise<Array<{ root?: string | null; domains: string[] }> | null> {
  try {
    const { nginxSitesService } = await import("../../modules/nginx/services/index.js");
    const sites = await nginxSitesService.listSites(executor);
    const env = { homeRoot: homeRoot.replace(/\/+$/, "") } as TenantEnvelope;
    return sites.filter((s) => isTenantDomainRoot(env, s.root));
  } catch (err) {
    log.debug({ err: String(err), homeRoot }, "listTenantSites failed → inconclusive (null)");
    return null;
  }
}

export async function countTenantDomains(executor: Executor, homeRoot: string): Promise<number | null> {
  const sites = await listTenantSites(executor, homeRoot);
  return sites === null ? null : sites.length;
}

/** Lowercased set of every domain served by the tenant's vhosts. `null` =
 *  inconclusive (probe threw); empty Set = genuinely no tenant domains. */
async function tenantDomainSet(executor: Executor, homeRoot: string): Promise<Set<string> | null> {
  const sites = await listTenantSites(executor, homeRoot);
  if (sites === null) return null;
  return new Set(sites.flatMap((s) => s.domains.map((d) => d.toLowerCase())));
}

// ── Mail accounts ────────────────────────────────────────────────────────────

/**
 * Count mailboxes whose domain belongs to the tenant. Best-effort: if the mail
 * server's account list cannot be read, or the tenant owns no resolvable
 * domains, returns 0 and the caller pushes a warning (mail count is the least
 * reliable signal because mailbox↔tenant is derived through the vhost domains).
 */
export async function countTenantEmails(executor: Executor, account: HostingAccount): Promise<number | null> {
  try {
    const domains = await tenantDomainSet(executor, account.homeRoot);
    if (domains === null) return null; // domain probe inconclusive → inconclusive
    if (domains.size === 0) return 0;
    // Dynamic import keeps the shared layer free of a static mail dependency
    // (the mail module reads this layer too — avoid an import cycle).
    const { readAccountsFromServer } = await import(
      "../../modules/mail/controllers/accounts.helpers.js"
    );
    const accounts = await readAccountsFromServer(executor);
    return accounts.filter((a) => isTenantMailAddress(domains, a.address)).length;
  } catch (err) {
    log.debug({ err: String(err), account: account.username }, "countTenantEmails failed → inconclusive (null)");
    return null;
  }
}

// ── Databases ────────────────────────────────────────────────────────────────

/** Count databases named `<owner>` or `<owner>_*` across both engines. Returns
 *  `null` when the measurement is inconclusive (module import failed). A
 *  per-engine failure (engine not installed / unreachable) legitimately
 *  contributes 0 and is skipped. */
export async function countTenantDatabases(executor: Executor, owner: string): Promise<number | null> {
  try {
    const { databasesService } = await import("../../modules/databases/services/databases.service.js");
    const prefix = `${owner}_`;
    const isOwned = (name: string): boolean => name === owner || name.startsWith(prefix);
    let total = 0;
    for (const engine of ["mysql", "postgresql"] as const) {
      try {
        const dbs = await databasesService.listDatabases(executor, engine);
        total += dbs.filter((d) => isOwned(d.name)).length;
      } catch {
        /* engine not installed / unreachable → skip */
      }
    }
    return total;
  } catch (err) {
    log.debug({ err: String(err), owner }, "countTenantDatabases failed → inconclusive (null)");
    return null;
  }
}

// ── Sub-users ────────────────────────────────────────────────────────────────

/** Count sub-users in the tenant group, excluding the owner. Fail-open → 0. */
export async function countTenantSubUsers(
  executor: Executor,
  tenantGroup: string,
  owner: string,
): Promise<number | null> {
  try {
    const out = await executor.exec(`getent group ${quoteArg(tenantGroup)} 2>/dev/null`, {
      timeoutMs: 15_000,
    });
    // getent group → name:passwd:gid:member,member,…  (only supplementary members)
    const members = (out.stdout.split(":")[3] ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
      .filter((m) => m !== owner);
    return new Set(members).size;
  } catch (err) {
    log.debug({ err: String(err), tenantGroup }, "countTenantSubUsers failed → inconclusive (null)");
    return null;
  }
}

// ── Aggregate usage (for /stats) ──────────────────────────────────────────────

const NEAR_CAP_RATIO = 0.85;

/** Orchestrate every probe + derive near-cap warnings. Never throws. */
export async function readTenantUsage(
  executor: Executor,
  account: HostingAccount,
): Promise<TenantResourceUsage> {
  const warnings: string[] = [];

  // The /stats card is fail-open by design: an inconclusive probe (null) shows
  // as 0 rather than erroring the card. Enforcement (assertResourceQuota) is the
  // path that fails closed on null.
  const disk = await checkDiskUsageMb(executor, account.homeRoot, account.username);
  const domainsUsed = (await countTenantDomains(executor, account.homeRoot)) ?? 0;
  const emailAccountsUsed = (await countTenantEmails(executor, account)) ?? 0;
  const databasesUsed = (await countTenantDatabases(executor, account.username)) ?? 0;
  const subUsersUsed = (await countTenantSubUsers(executor, account.tenantGroup, account.username)) ?? 0;

  // Near-cap warnings (≥85%); finite caps only.
  const nearCap = (used: number, max: number, label: string): void => {
    if (Number.isFinite(max) && max > 0 && used / max >= NEAR_CAP_RATIO) {
      warnings.push(`${label}: ${used}/${max} (≥85%)`);
    }
  };
  nearCap(disk.usedMb, account.diskQuotaMb, "Disco (MB)");
  nearCap(domainsUsed, account.maxDomains, "Dominios");
  nearCap(emailAccountsUsed, account.maxEmailAccounts, "Cuentas de correo");
  nearCap(databasesUsed, account.maxDatabases, "Bases de datos");
  nearCap(subUsersUsed, account.maxSubUsers, "Sub-usuarios");

  return {
    diskUsedMb: disk.usedMb,
    quotaMethod: disk.method,
    domainsUsed,
    emailAccountsUsed,
    databasesUsed,
    subUsersUsed,
    warnings,
  };
}

// ── Enforcement ───────────────────────────────────────────────────────────────

type QuotaResource = "domain" | "email" | "database" | "subuser";

const RESOURCE_LABEL: Record<QuotaResource, string> = {
  domain: "dominios",
  email: "cuentas de correo",
  database: "bases de datos",
  subuser: "sub-usuarios",
};

/** Pick {current, max} for a resource against the account. `current` is `null`
 *  when the measurement was inconclusive (enforcement then fails closed). */
async function measureResource(
  executor: Executor,
  account: HostingAccount,
  resource: QuotaResource,
): Promise<{ current: number | null; max: number }> {
  switch (resource) {
    case "domain":
      return { current: await countTenantDomains(executor, account.homeRoot), max: account.maxDomains };
    case "email":
      return { current: await countTenantEmails(executor, account), max: account.maxEmailAccounts };
    case "database":
      return { current: await countTenantDatabases(executor, account.username), max: account.maxDatabases };
    case "subuser":
      return {
        current: await countTenantSubUsers(executor, account.tenantGroup, account.username),
        max: account.maxSubUsers,
      };
  }
}

/**
 * Throw `QuotaExceededError` (HTTP 402) if creating one more of `resource` would
 * exceed the tenant's cap. On a real exceed it ALSO appends a QUOTA_EXCEEDED
 * entry to the hosting audit log (best-effort — an audit write failure never
 * masks the quota error). Infinity caps (legacy tokens / unlimited plans) never
 * throw. Works with any real HostingAccount, so admin-side callers reuse it.
 */
export async function assertResourceQuota(args: {
  executor: Executor;
  account: HostingAccount;
  resource: QuotaResource;
}): Promise<void> {
  const { executor, account, resource } = args;
  // Touch the envelope view to keep the model↔envelope contract honest and to
  // share the homeRoot normalization with the rest of tenant-scope.
  void envelopeFromAccount(account);

  const { current, max } = await measureResource(executor, account, resource);
  // Fail CLOSED on an inconclusive measurement: the counters return `null` when
  // a probe threw (SSH/SQL hiccup, or a provoked failure). Treating that as 0
  // would let a tenant at its cap slip a create through. Block with a 503 so the
  // caller retries rather than silently over-provisioning.
  if (current === null) {
    throw new ServiceUnavailableError(
      `No se pudo verificar el cupo de ${RESOURCE_LABEL[resource]}. Intenta de nuevo.`,
      undefined,
      { resource, account: account.username },
    );
  }
  if (!Number.isFinite(max) || current + 1 <= max) return;

  const label = RESOURCE_LABEL[resource];
  const message = `Cupo de ${label} alcanzado (${current}/${max}). Actualiza tu plan para crear más.`;

  // Audit the rejection (best-effort).
  try {
    const { hostingAuditRepository } = await import(
      "../../modules/hosting/repositories/audit.repository.js"
    );
    await hostingAuditRepository.append(
      {
        accountId: account.id,
        eventType: "QUOTA_EXCEEDED",
        severity: "warning",
        actor: account.username,
        context: { resource, current, max, dbPrefix: resource === "database" ? tenantDbPrefix(envelopeFromAccount(account)) : undefined },
      },
      executor,
    );
  } catch (err) {
    log.warn({ err: String(err), account: account.username, resource }, "QUOTA_EXCEEDED audit append failed");
  }

  throw new QuotaExceededError(message, resource, { current, max, account: account.username });
}
