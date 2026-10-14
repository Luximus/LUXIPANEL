// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { registerModuleOperations, moduleOperationRegistry, isManagementRoute } from "./registry.js";
import { registerManagementCapabilities } from "./catalog.js";
import { agentCapabilityRegistry } from "../agent-capability/registry.js";
const routers = {
  'chat': '../../../modules/chat/routes/chat.routes.js',
  'notifications': '../../../modules/notifications/routes/notifications.routes.js',
  'jobs': '../../../modules/jobs/routes/jobs.routes.js',
  'search': '../../../modules/search/routes/search.routes.js',
  'terminal-cli': '../../../modules/terminal-cli/routes/terminal-cli.routes.js',
  'users': '../../../modules/users/routes/users.routes.js',
  'mail': '../../../modules/mail/routes/mail.routes.js',
  'monitor': '../../../modules/monitor/routes/monitor.routes.js',
  'files': '../../../modules/files/routes/files.routes.js',
  'firewall': '../../../modules/firewall/routes/firewall.routes.js',
  'bitninja': '../../../modules/bitninja/routes/bitninja.routes.js',
  'dns': '../../../modules/nginx/routes/nginx.routes.js',
  'backups': '../../../modules/backup/routes/backup.routes.js',
  'cron': '../../../modules/cron/routes/cron.routes.js',
  'databases': '../../../modules/databases/routes/databases.routes.js',
  'obsidian': '../../../modules/obsidian/routes/obsidian.routes.js',
  'cloudflare': '../../../modules/cloudflare/routes/cloudflare.routes.js',
  'server-alerts': '../../../modules/server-alerts/routes/server-alerts.routes.js',
  'expo': '../../../modules/expo/routes/expo.routes.js',
  'webhooks': '../../../modules/webhooks/routes/webhooks.routes.js',
  'openclaw': '../../../modules/openclaw/routes/openclaw.routes.js',
  'hosting': '../../../modules/hosting/routes/hosting.routes.js',
  'terminal': '../../../modules/terminal/routes/terminal.routes.js',
  'module-dev': '../../../modules/module-dev/routes/module-dev.routes.js'
};
beforeAll(async () => {
  // Transform the real owners before the timed assertions, which only verify
  // routing/catalog parity. This inventory imports most of the application.
  for (const file of Object.values(routers)) await import(file.replace("../../../modules/", "../../modules/"));
}, 60_000);
afterEach(() => { moduleOperationRegistry.resetForTest(); agentCapabilityRegistry._resetForTest(); });
describe("core management route coverage", () => {
  it("enrolls every management route of every module router", async () => {
    moduleOperationRegistry.resetForTest(); agentCapabilityRegistry._resetForTest();
    for (const [id, file] of Object.entries(routers)) {
      const imported = await import(file.replace("../../../modules/", "../../modules/"));
      const router = Object.values(imported).find(value => typeof value === "function" && Array.isArray((value as any).stack)) as any;
      expect(router, id).toBeDefined();
      registerModuleOperations(id, router);
      const expected = router.stack.flatMap((layer: any) => !layer.route ? [] : [layer.route.path].flat().filter((path: unknown) => typeof path === "string" && isManagementRoute(path)).flatMap((path: string) => Object.keys(layer.route.methods).filter(method => layer.route.methods[method] && method !== "head").map(method => `${method.toUpperCase()} ${path}`)));
      expect(expected.length, id).toBeGreaterThan(0);
      expect(moduleOperationRegistry.list(id).map(operation => operation.id).sort(), id).toEqual(expected.sort());
    }
    registerManagementCapabilities();
    for (const [id] of Object.entries(routers)) expect(agentCapabilityRegistry.get(id)?.tools.length, id).toBeGreaterThan(0);
  }, 30_000);
});

it("covers the entire manager catalog and its connectors at application registration", async () => {
  moduleOperationRegistry.resetForTest(); agentCapabilityRegistry._resetForTest();
  const app = { use() {} } as any;
  const { registerAdminModule } = await import("../../modules/admin/index.js");
  const { registerMCPModule } = await import("../../modules/mcp/index.js");
  registerAdminModule(app); registerMCPModule(app);
  // Route owners enroll their own routers; importing assistant routes enrolls
  // the protected router and fixed connector operations, without booting jobs.
  await import("../../modules/ai-assistant/routes/ai.routes.js");
  const { aiRouter } = await import("../../modules/ai-assistant/routes/ai.routes.js");
  // Its nested router was already imported by core parity; explicitly re-enroll.
  const protectedLayer = (aiRouter as any).stack.find((layer: any) => layer.handle?.stack?.some((child: any) => child.route?.path === "/projects"));
  expect(protectedLayer).toBeDefined();
  registerModuleOperations("assistant", protectedLayer.handle, { prefix: "/api/ai" });
  for (const id of ["google-drive", "onedrive", "dropbox", "notion"]) registerModuleOperations(id, protectedLayer.handle, { prefix: "/api/ai", include: path => path.startsWith("/api/ai/connectors/"), fixedParams: { id } });
  for (const [id, file] of Object.entries(routers)) {
    const imported = await import(file.replace("../../../modules/", "../../modules/"));
    const router = Object.values(imported).find(value => typeof value === "function" && Array.isArray((value as any).stack)) as any;
    registerModuleOperations(id, router);
  }
  const { registerHostingModule } = await import("../../modules/hosting/index.js"); registerHostingModule(app);
  registerManagementCapabilities();
  const { moduleRegistryService } = await import("../../modules/admin/services/module-registry.service.js");
  for (const entry of moduleRegistryService.getAll()) {
    if (entry.id === "codebase-graph") continue; // distinct project-scoped channel
    expect(agentCapabilityRegistry.list().some(cap => (cap.catalogModuleId ?? cap.moduleId) === entry.id && cap.tools.length > 0), entry.id).toBe(true);
  }
  const admin = moduleOperationRegistry.list("admin");
  expect(admin.some(operation => operation.path.includes("modules") && operation.method !== "GET")).toBe(true);
  expect(moduleOperationRegistry.list("hosting").some(operation => operation.path === "/api/hosting/providers" && operation.method === "POST")).toBe(true);
}, 30_000);
