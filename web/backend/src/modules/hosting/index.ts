// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../shared/module-operations/registry.js";
/**
 * Hosting module — shared hosting (WHM-style) multi-tenant support.
 *
 * Provides:
 *   - Tenant account lifecycle management (create, suspend, terminate…)
 *   - Administrative REST API plus versioned provider Bearer API
 *   - Hosting account authentication (isolated panel sessions)
 *   - Tenant-scope middleware for resource isolation across all modules
 */

import type { Express } from "express";
import { providerRouter } from "./routes/provider.routes.js";
import { templateRouter } from "./routes/template.routes.js";
import { hostingRouter } from "./routes/hosting.routes.js";
// ── A2 (Fase 5 jail) — punto de integración: registro de router propio ──
import { hostingJailRouter } from "./routes/jail.routes.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { hostingAgentCapability } from "./agent-capability.js";

export function registerHostingModule(app: Express): void {
  registerModuleOperations("hosting", providerRouter, { include: path => path.startsWith("/api/hosting/providers"), permission: "hosting.providers" });
  app.use(templateRouter);
  registerModuleOperations("hosting", templateRouter);
  app.use(hostingRouter);
  registerModuleOperations("hosting", hostingRouter);
  // ── A2 (Fase 5 jail) — montar el router del chroot (líneas aisladas para
  //    fusión trivial con el registro del router de auditoría de A1). ──
  app.use(hostingJailRouter);
  registerModuleOperations("hosting", hostingJailRouter);
  agentCapabilityRegistry.register(hostingAgentCapability);
}
