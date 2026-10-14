// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it } from "vitest";
import express from "express";
import busboy from "busboy";
import { registerModuleOperations, moduleOperationRegistry } from "./registry.js";
import { toolRequestContext } from "./request-context.js";
import { runWithExecutor, setContextFileJail } from "../executor/context.js";
import { getExecutor } from "../executor/factory.js";
import { requireAuth } from "../../modules/auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../modules/auth/middlewares/csrf.middleware.js";
import { requireActionPermission } from "../../modules/auth/middlewares/require-permission.middleware.js";
import type { Executor } from "../executor/types.js";
import type { SessionUser } from "../types/index.js";
const user = { userId: 7, username: "admin", displayName: "Admin", role: "admin", modules: [], kind: "admin" } as SessionUser;
const executor = { target: { id: "server-A", name: "A" } } as Executor;
const invoke = (id: string, input: unknown = {}) => runWithExecutor(executor, () => moduleOperationRegistry.list().find(operation => operation.id === id)!.tool.handler(input), user.userId, user);
beforeEach(() => moduleOperationRegistry.resetForTest());
describe("module router tools", () => {
  it("replays authentication, CSRF, middleware and controller with the pinned server", async () => {
    const router = express.Router();
    router.use(requireAuth);
    router.post("/api/demo/:id", csrfProtection, requireActionPermission("demo.edit"), (req, res) => res.json({ id: req.params.id, query: req.query, body: req.body, target: getExecutor(req).target.id }));
    registerModuleOperations("demo", router);
    expect(moduleOperationRegistry.list()[0]?.tool.permission).toBe("demo.edit");
    expect(await invoke("POST /api/demo/:id", { params: { id: "hello world" }, query: { limit: 4 }, body: { value: true } })).toEqual({ ok: true, output: { status: 200, data: { id: "hello world", query: { limit: "4" }, body: { value: true }, target: "server-A" } } });
  });
  it("cannot be authorized by a forged HTTP header or an arbitrary URL", async () => {
    expect(toolRequestContext({ headers: { "x-luxipanel-tool": "true" } } as any)).toBeUndefined();
    const router = express.Router(); router.get("/api/demo", (_req, res) => res.json({ ok: true })); registerModuleOperations("demo", router);
    await expect(invoke("GET /api/demo", { url: "/api/admin/users" })).rejects.toThrow("Unknown tool input");
    expect(await moduleOperationRegistry.list()[0]!.tool.handler({})).toMatchObject({ ok: false });
  });
  it("preserves the project jail on nested file paths", async () => {
    const router = express.Router(); router.post("/api/demo", (_req, res) => res.json({ ok: true })); registerModuleOperations("demo", router);
    await expect(runWithExecutor(executor, () => { setContextFileJail(["/srv/project"]); return moduleOperationRegistry.list()[0]!.tool.handler({ body: { files: [{ path: "/etc/shadow" }] } }); }, 7, user)).rejects.toThrow("project scope");
  });
  it("replays the original raw upload parser and returns binary downloads", async () => {
    const router = express.Router(); router.post("/api/demo/upload", express.raw({ type: "application/octet-stream", limit: "1kb" }), (req, res) => res.type("application/octet-stream").send(req.body)); registerModuleOperations("demo", router);
    expect(await invoke("POST /api/demo/upload", { raw: { base64: Buffer.from("abc").toString("base64"), contentType: "application/octet-stream" } })).toEqual({ ok: true, output: { status: 200, data: { contentType: "application/octet-stream", base64: "YWJj" } } });
  });
  it("excludes auth, chat transport and generic MCP call forwarding", () => {
    const router = express.Router(); for (const path of ["/api/auth/login", "/api/ai/agent", "/api/ai/mcp/modules", "/api/mcp/:id/call-tool/:toolName", "/api/demo/stream"]) router.post(path, (_req, res) => res.end()); registerModuleOperations("demo", router); expect(moduleOperationRegistry.list()).toEqual([]);
  });
});

it("keeps finite event history routes and uses distinct names for colliding sanitized paths", () => {
  const router = express.Router();
  for (const route of ["/api/demo/alerts/events", "/api/demo/a-b", "/api/demo/a_b"]) router.get(route, (_req, res) => res.json([]));
  registerModuleOperations("demo", router);
  expect(moduleOperationRegistry.list()).toHaveLength(3);
  expect(new Set(moduleOperationRegistry.list().map(operation => operation.tool.name)).size).toBe(3);
});

it("replays multipart fields and file bytes through the original streaming parser", async () => {
  const router = express.Router();
  router.post("/api/demo/multipart", (req, res) => {
    const parser = busboy({ headers: req.headers }), fields: Record<string, string> = {}, files: unknown[] = [];
    parser.on("field", (name, value) => { fields[name] = value; });
    parser.on("file", (_name, stream, info) => {
      const chunks: Buffer[] = []; stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => files.push({ name: info.filename, body: Buffer.concat(chunks).toString("utf8") }));
    });
    parser.on("close", () => res.json({ fields, files })); req.pipe(parser);
  });
  registerModuleOperations("demo", router);
  const result = await invoke("POST /api/demo/multipart", { multipart: { fields: { title: "sample" }, files: [{ field: "attachment", name: "sample.txt", contentType: "text/plain", base64: "YWJj" }] } });
  expect(result).toEqual({ ok: true, output: { status: 200, data: { fields: { title: "sample" }, files: [{ name: "sample.txt", body: "abc" }] } } });
});
