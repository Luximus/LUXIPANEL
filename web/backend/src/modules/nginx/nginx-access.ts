// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Access checks shared by HTTP routes and assistant tools. */
import type { Executor } from "../../shared/executor/index.js";
import { getContextUser } from "../../shared/executor/context.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import { getTenantEnvelope, isHostingSession, isTenantDomainRoot } from "../../shared/tenant/tenant-scope.js";
import { nginxSitesService } from "./services/nginx-sites.service.js";
import type { NginxSiteSummary } from "./models/nginx.model.js";

export function assertNginxAdmin(): void {
  if (getContextUser()?.kind !== "admin") {
    throw new ForbiddenError("Esta operación global de NGINX requiere una cuenta administradora.");
  }
}

export function filterOwnedSites<T extends { root?: string | null }>(sites: T[]): T[] {
  const user = getContextUser();
  if (!isHostingSession(user)) return sites;
  const env = getTenantEnvelope(user!);
  return sites.filter((site) => isTenantDomainRoot(env, site.root));
}

export async function assertOwnedSite(executor: Executor, name: string): Promise<NginxSiteSummary> {
  const site = (await nginxSitesService.listSites(executor)).find((entry) => entry.name === name);
  if (!site) throw new ForbiddenError("El sitio no está disponible para esta cuenta.");
  if (!filterOwnedSites([site]).length) {
    throw new ForbiddenError("No puedes acceder a un sitio fuera de tu cuenta.");
  }
  return site;
}

export function assertHostingFormAllowed(body: {
  mode: string;
  form?: { root?: string; kind?: string; redirectTo?: string; extraDirectives?: string };
}): void {
  const user = getContextUser();
  if (body.form?.kind === "proxy" && user?.kind !== "admin") {
    throw new ForbiddenError("La creación de reverse proxy requiere una cuenta administradora.");
  }
  if (!isHostingSession(user)) return;
  const env = getTenantEnvelope(user!);
  if (body.mode === "raw" || body.form?.redirectTo || body.form?.extraDirectives) {
    throw new ForbiddenError("Tu cuenta solo puede crear sitios de archivos o PHP con el formulario guiado.");
  }
  if (!isTenantDomainRoot(env, body.form?.root)) {
    throw new ForbiddenError("La raíz del sitio debe estar dentro de tu directorio de cuenta.");
  }
}
