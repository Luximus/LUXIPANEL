import express, { type Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { buildEffectivePermissions } from "../services/role-permissions.service.js";

vi.mock("./session.middleware.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuthNoExecutor: (_req: unknown, _res: unknown, next: () => void) => next(),
  optionalAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../admin/services/module-registry.service.js", async (original) => {
  const actual = await original<typeof import("../../admin/services/module-registry.service.js")>();
  return { ...actual, moduleRegistryService: { ...actual.moduleRegistryService, isEnabled: async () => true } };
});

const modules = [
  ["mail", "mail", "mailRouter", "/api/mail"],
  ["monitor", "monitor", "monitorRouter", "/api/monitor"],
  ["files", "files", "filesRouter", "/api/files"],
  ["firewall", "firewall", "firewallRouter", "/api/firewall"],
  ["bitninja", "bitninja", "bitninjaRouter", "/api/bitninja"],
  ["backup", "backups", "backupRouter", "/api/backups"],
  ["cron", "cron", "cronRouter", "/api/cron"],
  ["databases", "databases", "databasesRouter", "/api/databases"],
  ["obsidian", "obsidian", "obsidianRouter", "/api/obsidian"],
  ["cloudflare", "cloudflare", "cloudflareRouter", "/api/cloudflare"],
  ["expo", "expo", "expoRouter", "/api/expo"],
  ["nginx", "dns", "nginxRouter", "/api/nginx"],
  ["openclaw", "openclaw", "openclawRouter", "/api/openclaw"],
  ["server-alerts", "server-alerts", "serverAlertsRouter", "/api/server-alerts"],
  ["webhooks", "webhooks", "webhooksRouter", "/api/webhooks"],
  ["module-dev", "module-dev", "moduleDevRouter", "/api/module-dev"],
  ["notifications", "notifications", "notificationsRouter", "/api/notifications"],
  ["servers", "server-switcher", "serversRouter", "/api/servers"],
  ["search", "search", "searchRouter", "/api/search"],
  ["users", "users", "usersRouter", "/api/users"],
  ["terminal", "terminal", "terminalRouter", "/api/terminal"],
  ["ai-assistant", "assistant", "aiRouter", "/api/ai"],
] as const;

async function appFor(directory: string, slug: string, exportName: string, views: string[], grants = true) {
  const file = directory === "ai-assistant" ? "ai" : directory;
  const loaded = await import(`../../${directory}/routes/${file}.routes.ts`) as Record<string, Router>;
  expect(loaded[exportName], `router export for ${slug}`).toBeDefined();
  const app = express();
  app.use((_req, res, next) => {
    res.locals.user = { userId: 1, username: "reader", role: "user", kind: "user", modules: grants ? [slug] : [],
      permissions: buildEffectivePermissions({ rolePermissions: { version: 2, views, actions: [`${slug}.read`] }, modules: [], isAdminKind: false }) };
    next();
  });
  app.use(loaded[exportName]!);
  app.use((_req, res) => { res.sendStatus(204); });
  app.use((error: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.statusCode ?? 500).json({ ok: false });
  });
  return app;
}

describe("actual HTTP module routers", () => {
  it.each(modules.filter(row => ["firewall", "bitninja", "monitor"].includes(row[0])))("%s stays administrator-only even with a read grant", async (directory, slug, name, prefix) => {
    const app = await appFor(directory, slug, name, [`panel.${slug}`]);
    expect((await request(app).get(`${prefix}/__permission_probe/missing`)).status).toBe(403);
  });
  it.each(modules)("%s denies API access when its view was unchecked", async (directory, slug, name, prefix) => {
    const app = await appFor(directory, slug, name, []);
    for (const method of ["get", "post", "put", "delete"] as const) {
      expect((await request(app)[method](`${prefix}/__permission_probe/missing`)).status).toBe(403);
    }
  });
  it.each(modules.filter((row) => !["notifications", "servers", "search"].includes(row[0])))("%s denies access without the module grant", async (directory, slug, name, prefix) => {
    const app = await appFor(directory, slug, name, [`panel.${slug}`], false);
    expect((await request(app).get(`${prefix}/__permission_probe/missing`)).status).toBe(403);
  });
  it.each(modules.filter((row) => !["files", "mail", "webhooks", "module-dev", "cron", "users", "terminal", "ai-assistant", "firewall", "bitninja", "monitor"].includes(row[0])))("%s permits its view without requiring a visible menu", async (directory, slug, name, prefix) => {
    const app = await appFor(directory, slug, name, [`panel.${slug}`]);
    expect((await request(app).get(`${prefix}/__permission_probe/missing`)).status).toBe(204);
  });
});
