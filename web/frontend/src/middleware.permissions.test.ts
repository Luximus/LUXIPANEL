import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("astro:middleware", () => ({ defineMiddleware: (handler: unknown) => handler, sequence: (...handlers: any[]) => (context: any, next: any) => { const run = (i: number): any => i < handlers.length ? handlers[i](context, () => run(i + 1)) : next(); return run(0); } }));
vi.mock("@/lib/ui-bootstrap", () => ({ getUiBootstrap: async () => null }));
vi.mock("@/lib/auth", async original => ({ ...await original<Record<string, unknown>>(), getSession: mocked.session }));
import { onRequest } from "./middleware";

const routes = [
  ["/mail", "panel.mail"], ["/mail/7/inbox", "panel.mail"], ["/mail/compose", "panel.mail"],
  ["/monitor", "panel.monitor"], ["/files", "panel.files"], ["/firewall", "panel.firewall"],
  ["/bitninja", "panel.bitninja"], ["/assistant", "panel.assistant"], ["/assistant/market", "panel.assistant"], ["/nginx", "panel.dns"],
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

describe("Market route", () => {
  it.each(["/", "/panel?__lxp_internal__=1"])("allows returning to chat at %s with the assistant view and a hidden menu", async path => {
    mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: [], views: ["panel.assistant"], actions: [] } });
    const { response } = await navigate(path);
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
  });
  it("retains the legacy dashboard permission for the home page", async () => {
    mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: [], views: ["panel.dashboard"], actions: [] } });
    expect((await navigate("/")).response.status).toBe(200);
    const { response, rewrite } = await navigate("/assistant/market");
    expect(response.headers.get("Location")).toBe("/");
    expect(rewrite).not.toHaveBeenCalled();
  });
  it("does not treat a visible assistant menu as permission to open home or Market", async () => {
    mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: ["assistant"], views: [], actions: ["*"] } });
    for (const path of ["/", "/assistant/market"]) {
      const { response, rewrite } = await navigate(path);
      expect(response.status).toBe(403);
      expect(rewrite).not.toHaveBeenCalled();
    }
  });
  it("rechecks the current session when changing to a target without the view", async () => {
    mocked.session.mockResolvedValueOnce({ kind: "user", direct: true, targetId: "server-a", permissions: { sidebar: [], views: ["panel.assistant"], actions: [] } });
    expect((await navigate("/assistant/market")).response.status).toBe(200);
    mocked.session.mockResolvedValueOnce({ kind: "user", direct: true, targetId: "server-b", permissions: { sidebar: ["assistant"], views: [], actions: [] } });
    expect((await navigate("/assistant/market")).response.status).toBe(403);
  });
  it("normalizes the internal panel link while preserving its query", async () => {
    const { response, rewrite } = await navigate("/panel/assistant/market?from=search");
    expect(response.headers.get("Location")).toBe("/assistant/market?from=search");
    expect(rewrite).not.toHaveBeenCalled();
  });
  it("requires a session before rendering Market", async () => {
    mocked.session.mockResolvedValue(null);
    const { response, rewrite } = await navigate("/assistant/market");
    expect(response.headers.get("Location")).toBe("/login");
    expect(rewrite).not.toHaveBeenCalled();
  });
  it("does not let an internal rewrite flag bypass its view permission", async () => {
    const { response, next } = await navigate("/panel/assistant/market?__lxp_internal__=1");
    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("rewrites a permitted public visit to the dedicated Market page", async () => {
    mocked.session.mockResolvedValue({ kind: "user", permissions: { sidebar: [], views: ["panel.assistant"], actions: [] } });
    const { response, rewrite } = await navigate("/assistant/market");
    expect(response.status).toBe(200);
    expect(new URL((rewrite.mock.calls[0] as unknown as [Request])[0].url).pathname).toBe("/panel/assistant/market");
  });
});

describe("mandatory GitHub connection",()=>{
 it.each(["/","/files","/assistant","/settings","/module-dev"])("redirects an unlinked administrator at %s",async route=>{
  mocked.session.mockResolvedValue({kind:"admin",github:{required:true,connected:false}});
  const {response,rewrite}=await navigate(route);expect(response.headers.get("Location")).toBe("/connect-github");expect(rewrite).not.toHaveBeenCalled();
 });
 it("allows the linked account to keep its existing panel permissions",async()=>{
  mocked.session.mockResolvedValue({kind:"admin",github:{required:true,connected:true}});
  const {response,rewrite}=await navigate("/assistant");expect(response.status).toBe(200);expect(rewrite).toHaveBeenCalledOnce();
 });
 it.each(["/files","/assistant","/settings","/module-dev"])("allows an unlinked SSH administrator at %s when GitHub is optional",async route=>{
  mocked.session.mockResolvedValue({kind:"admin",direct:true,targetId:"remote",github:{required:false,connected:false}});
  const {response,rewrite}=await navigate(route);
  expect(response.status).toBe(200);expect(response.headers.get("Location")).toBeNull();expect(rewrite).toHaveBeenCalledOnce();
 });
 it("still enforces remote panel permissions when GitHub is optional",async()=>{
  mocked.session.mockResolvedValue({kind:"user",direct:true,targetId:"remote",permissions:{sidebar:[],views:[],actions:[]},github:{required:false,connected:false}});
  const {response,rewrite}=await navigate("/files");
  expect(response.status).toBe(403);expect(rewrite).not.toHaveBeenCalled();
 });
});
