// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Read-only, target-scoped NGINX diagnostics for contextual Assistant chats. */
import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { getContextUser } from "../../shared/executor/context.js";
import { isHostingSession } from "../../shared/tenant/tenant-scope.js";
import { nginxSitesService } from "./services/nginx-sites.service.js";
import { nginxSystemService } from "./services/nginx-system.service.js";
import { certbotService } from "./services/certbot.service.js";
import { siteNameSchema } from "./models/nginx.model.js";
import { assertNginxAdmin, assertOwnedSite, filterOwnedSites } from "./nginx-access.js";
import { diagnosticDirectives, redactNginxDiagnostic } from "./nginx-ai-redaction.js";

const TAIL_MAX = 500;
function logInput(input: unknown): { site?: string; lines: number } {
  const raw = (input ?? {}) as { site?: unknown; lines?: unknown };
  const site = raw.site === undefined || raw.site === "" ? undefined : siteNameSchema.parse(raw.site);
  const lines = typeof raw.lines === "number" && Number.isFinite(raw.lines)
    ? Math.max(1, Math.min(TAIL_MAX, Math.floor(raw.lines))) : 50;
  return { site, lines };
}

async function tailLog(input: unknown, type: "access" | "error") {
  const executor = requireExecutor();
  const { site, lines } = logInput(input);
  if (site) await assertOwnedSite(executor, site);
  else assertNginxAdmin();
  const result = await nginxSystemService.tailLog(executor, { site, type, lines });
  return { ok: true, output: { site: site ?? null, type, lines: redactNginxDiagnostic(result.lines) } };
}

const logInputSchema = {
  type: "object" as const,
  properties: {
    site: { type: "string", description: "Site file name; required for hosting accounts" },
    lines: { type: "number", description: "Number of lines, 1-500 (default 50)" },
  },
};

export const nginxAgentCapability: AgentCapability = {
  moduleId: "nginx", catalogModuleId: "dns",
  version: 1,
  tools: [
    {
      name: "nginx.list_sites",
      title: "Listar sitios NGINX",
      description: "List the accessible NGINX sites with their status, type and HTTPS state.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ ok: true, output: filterOwnedSites(await nginxSitesService.listSites(requireExecutor())) }),
    },
    {
      name: "nginx.status",
      title: "Estado de NGINX",
      description: "Read NGINX service health and the number of accessible sites.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const status = await nginxSystemService.status(executor);
        if (isHostingSession(getContextUser())) {
          const sites = filterOwnedSites(await nginxSitesService.listSites(executor));
          status.availableSites = sites.length;
          status.enabledSites = sites.filter((site) => site.enabled).length;
          status.configTest.output = "";
        } else {
          status.configTest.output = redactNginxDiagnostic(status.configTest.output);
        }
        return { ok: true, output: status };
      },
    },
    {
      name: "nginx.test_config",
      title: "Comprobar configuración",
      description: "Run nginx -t without changing the service. Administrator only.",
      kind: "read",
      permission: "admin",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        assertNginxAdmin();
        const result = await nginxSystemService.testConfig(requireExecutor());
        return { ok: result.ok, output: redactNginxDiagnostic(result.output) };
      },
    },
    {
      name: "nginx.renewal_status",
      title: "Renovación HTTPS",
      description: "Check whether Certbot automatic renewal and the NGINX reload hook are active on the connected server.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => ({ ok: true, output: await certbotService.renewalStatusWithExecutor(requireExecutor()) }),
    },
    {
      name: "nginx.inspect_site",
      title: "Inspeccionar sitio",
      description: "Read a site's summary and safe diagnostic directives, omitting secret headers and arbitrary config.",
      kind: "read",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      handler: async (input) => {
        const name = siteNameSchema.parse((input as { name?: unknown })?.name);
        const executor = requireExecutor();
        const site = await assertOwnedSite(executor, name);
        const content = await nginxSitesService.readRaw(executor, name);
        return { ok: true, output: { site, directives: diagnosticDirectives(content) } };
      },
    },
    {
      name: "nginx.tail_access_log",
      title: "Leer access log",
      description: "Read a bounded and scrubbed access log excerpt for an accessible site.",
      kind: "read",
      inputSchema: logInputSchema,
      handler: (input) => tailLog(input, "access"),
    },
    {
      name: "nginx.tail_error_log",
      title: "Leer error log",
      description: "Read a bounded and scrubbed error log excerpt for an accessible site.",
      kind: "read",
      inputSchema: logInputSchema,
      handler: (input) => tailLog(input, "error"),
    },
  ],
  suggestedPrompts: [
    "Diagnostica el estado de NGINX y propón los siguientes pasos sin aplicar cambios.",
    "Analiza los errores recientes de mi sitio NGINX y explica qué revisar.",
    "Comprueba si la renovación automática HTTPS está activa y explica lo que falta.",
  ],
};
