// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Domain listing shim — kept so the Mail module can resolve which domains
 * are usable for mailboxes/autoresponders.
 *
 * Source of truth is the NGINX module: every `server_name` declared across
 * the server blocks under `sites-available` (enabled or not), exactly the
 * same set the NGINX manager shows. We deliberately read ALL sites — not
 * only the ones with TLS — so a plain HTTP vhost is just as selectable for
 * mail as an HTTPS one. Apache/Caddy and the old filesystem heuristic are no
 * longer consulted: domains come solely from nginx.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { nginxSitesService } from "./nginx-sites.service.js";

export interface ListedDomain {
  name: string;
  documentRoot: string | null;
  sources: string[];
}

export const domainsService = {
  async list(executor: Executor): Promise<ListedDomain[]> {
    const sites = await nginxSitesService.listSites(executor);
    // Flatten sites → distinct domains. A domain may appear in several server
    // blocks (e.g. an HTTP redirect block + the HTTPS block); keep the first
    // document root we see for it.
    const byName = new Map<string, ListedDomain>();
    for (const site of sites) {
      for (const raw of site.domains) {
        const name = String(raw || "").trim().toLowerCase();
        if (!name || name === "_") continue;
        const existing = byName.get(name);
        if (existing) {
          if (!existing.documentRoot && site.root) existing.documentRoot = site.root;
          continue;
        }
        byName.set(name, {
          name,
          documentRoot: site.root ?? null,
          sources: ["nginx"],
        });
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
};
