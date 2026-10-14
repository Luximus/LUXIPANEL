// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Tenant ownership checks shared by domain-level mail settings. */
import { ForbiddenError } from "../../../../shared/errors/index.js";
import { getContextExecutor, getContextUser } from "../../../../shared/executor/context.js";
import { getTenantEnvelope, isHostingSession } from "../../../../shared/tenant/tenant-scope.js";
import { tenantResourcesService } from "../../../../shared/tenant/tenant-resources.service.js";
import { normalizeMailDomain } from "./normalize-domain.js";

export async function visibleMailDomains(): Promise<Set<string> | null> {
  const user = getContextUser();
  if (!isHostingSession(user)) return null;
  const executor = getContextExecutor();
  if (!executor) throw new ForbiddenError("No hay servidor de correo conectado");
  const domains = await tenantResourcesService.tenantDomainSet(getTenantEnvelope(user!), executor);
  return new Set([...domains].map(normalizeMailDomain));
}

export async function assertOwnedMailDomain(domain: string): Promise<string> {
  const normalized = normalizeMailDomain(domain);
  const visible = await visibleMailDomains();
  if (visible && !visible.has(normalized)) {
    throw new ForbiddenError("El dominio de correo no pertenece a esta cuenta");
  }
  return normalized;
}

export async function filterMailDomainRecord<T>(items: Record<string, T>): Promise<Record<string, T>> {
  const visible = await visibleMailDomains();
  if (!visible) return items;
  return Object.fromEntries(Object.entries(items).filter(([domain]) => visible.has(normalizeMailDomain(domain))));
}
