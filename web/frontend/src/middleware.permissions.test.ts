import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("astro:middleware", () => ({ defineMiddleware: (handler: unknown) => handler, sequence: (...handlers: any[]) => (context: any, next: any) => { const run = (i: number): any => i < handlers.length ? handlers[i](context, () => run(i + 1)) : next(); return run(0); } }));
vi.mock("@/lib/ui-bootstrap", () => ({ getUiBootstrap: async () => null }));
vi.mock("@/lib/auth", () => ({ getSession: mocked.session }));
import { onRequest } from "./middleware";

const routes = [
  ["/mail", "panel.mail"], ["/mail/7/inbox", "panel.mail"], ["/mail/compose", "panel.mail"],
  ["/monitor", "panel.monitor"], ["/files", "panel.files"], ["/firewall", "panel.firewall"],
  ["/bitninja", "panel.bitninja"], ["/assistant", "panel.assistant"], ["/nginx", "panel.dns"],
  ["/backups", "panel.backups"], ["/cron", "panel.cron"], ["/databases", "panel.databases"],
  ["/obsidian", "panel.obsidian"], ["/cloudflare", "panel.cloudflare"], ["/expo", "panel.expo"],
  ["/webhooks", "panel.webhooks"], ["/users", "panel.users"], ["/modules", "panel.modules"],
  ["/settings", "panel.settings"], ["/preferences", "panel.preferences"], ["/hosting", "panel.hosting"],
  ["/openclaw", "panel.openclaw"], ["/repository-store", "panel.repository-store"],
  ["/module-dev", "panel.module-dev"], ["/project-map", "panel.module-dev"],
  ["/server-alerts", "panel.server-alerts"], ["/codebase-graph", "panel.codebase-graph"],
  ["/servers", "panel.server-switcher"], ["/terminal", "terminal.view"],
];
async function navigate(path: string) {
  const url = new URL(path, "https://panel.example.test");
  const rewrite = vi.fn(async () => new Response("module", { status: 200 }));
  const next = vi.fn(async () => new Response("public", { status: 200 }));
  const context = { url, request: new Request(url), cookies: { get: () => undefined }, locals: {}, rewrite,
    redirect: (to: string) => new Response(null, { status: 302, headers: { Location: to } }) };
  const response = await onRequest(context as never, next as never);
  if (!response) throw new Error("Middleware did not return a response");
  return { response, rewrite, next };
}
beforeEach(() => mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: [], views: [], actions: [] } }));
describe("all panel routes", () => {
  it.each(routes)("denies a direct visit to %s without its view", async (path) => {
    const { response, rewrite, next } = await navigate(path!);
    expect(response.status).toBe(403);
    expect(rewrite).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
  it.each(routes)("allows %s with its view, independently of menu visibility", async (path, permission) => {
    mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: [], views: [permission], actions: [permission] } });
    const { response, rewrite } = await navigate(path!);
    expect(response.status).toBe(200);
    expect(rewrite).toHaveBeenCalledOnce();
  });
});
