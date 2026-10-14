// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tenant-resources service (Fase 6) — shared "what does this tenant own"
 * helpers, used by the nginx / mail quota gates so neither controller has to
 * re-derive the tenant's vhost set inline.
 *
 * SECURITY: in a hosting session the executor runs as `sudo -u owner`, so
 * `nginxSitesService.listSites` can return MORE than the tenant strictly owns.
 * The filter is `isTenantDomainRoot` (docroot under homeRoot) — the same
 * boundary the nginx create gate uses.
 *
 * NOTE on coupling: the mail controller already imports nginx's domainsService
 * directly (the DNS picker), so this hosting→nginx read is consistent with the
 * existing module graph; nothing new is imported into mail/nginx from here.
 */

import { nginxSitesService } from "../../modules/nginx/services/index.js";
import type { Executor } from "../executor/index.js";
import { isTenantDomainRoot, type TenantEnvelope } from "./tenant-scope.js";

export const tenantResourcesService = {
  /** Number of vhosts whose docroot lives under the tenant home. */
  async countTenantDomains(env: TenantEnvelope, executor: Executor): Promise<number> {
    const sites = await nginxSitesService.listSites(executor);
    return sites.filter((s) => isTenantDomainRoot(env, s.root)).length;
  },

  /** Lowercased set of every domain served by the tenant's vhosts. */
  async tenantDomainSet(env: TenantEnvelope, executor: Executor): Promise<Set<string>> {
    const sites = await nginxSitesService.listSites(executor);
    return new Set(
      sites
        .filter((s) => isTenantDomainRoot(env, s.root))
        .flatMap((s) => s.domains.map((d) => d.toLowerCase())),
    );
  },
};
