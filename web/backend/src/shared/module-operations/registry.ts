// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { mapErrorToResponse } from "../errors/error-handler.js";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Request, Response, Router } from "express";
import express from "express";
import type { AgentTool } from "../agent-capability/types.js";
import { bindToolRequest } from "./request-context.js";
import { getContextUser, getContextExecutor } from "../executor/context.js";
import { actionForHttp } from "../auth/module-actions.js";
import { authConfig } from "../../config/auth.js";
import { operationPermission } from "./permissions.js";
import { pathInFileJail } from "../executor/context.js";

export interface ModuleOperation {
  id: string;
  moduleId: string;
  method: string;
  path: string;
  params: string[];
  tool: AgentTool;
}

interface RouterOptions {
  prefix?: string;
  include?: (path: string) => boolean;
  fixedParams?: Record<string, string>;
  permission?: string;
}

const operations = new Map<string, ModuleOperation>();
const internalApp = express();
const MAX_BYTES = 16 * 1024 * 1024;
// Authentication/session issuance, assistant transport and live subscriptions
// are infrastructure, not module management operations.
export function isManagementRoute(path: string): boolean {
  return !/(?:^|\/)(?:auth|login|logout|sso|stream)(?:\/|$)/.test(path)
    && !/^\/api\/ai\/(?:mcp(?:\/|$)|chat|agent(?:\/|$)|pairing|voice\/transcribe)/.test(path)
    && !/\/(?:editor\/chat|editor-chat)(?:\/|$)/.test(path)
    && !/\/call-tool(?:\/|$)/.test(path);
}

function suffix(method: string, path: string): string {
  const readable = `${method.toLowerCase()}_${path.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/_$/, "")}`.toLowerCase();
  return `${readable.slice(0, 39)}_${createHash("sha256").update(method + path).digest("hex").slice(0, 8)}`;
}

function object(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}

/** Register the actual router owned by a module. Middleware, input validation
 * and controllers are replayed together, never a user-selected URL/handler. */
export function registerModuleOperations(moduleId: string, router: Router, options: RouterOptions = {}): void {
  for (const layer of (router as Router & { stack: any[] }).stack) {
    if (!layer.route) continue;
    const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
    for (const routePath of paths) {
      if (typeof routePath !== "string") throw new Error("Module tools require a literal route path");
      const fullPath = `${options.prefix ?? ""}${routePath}`;
      if (!isManagementRoute(fullPath) || (options.include && !options.include(fullPath))) continue;
      for (const method of Object.keys(layer.route.methods).filter(m => layer.route.methods[m] && m !== "head")) {
        const id = `${method.toUpperCase()} ${fullPath}`;
        const fixedParams = options.fixedParams ?? {};
        const params = [...routePath.matchAll(/:([a-zA-Z0-9_]+)/g)].map(m => m[1]!).filter(p => !(p in fixedParams));
        const name = `${moduleId}.${suffix(method, fullPath)}`;
        const kind = method === "get" ? "read" : "action";
        const tool: AgentTool = {
          name, title: id, description: `Manage ${moduleId}: ${id}. params supplies URL identifiers, query supplies query fields, body supplies the same JSON payload as the module UI. Server-side validation and all route permissions apply.`,
          kind, dangerous: kind === "action", permission: options.permission ?? operationPermission(layer.route.stack) ?? (moduleId === "terminal" ? "terminal.view" : undefined) ?? actionForHttp(moduleId, method.toUpperCase(), fullPath) ?? (moduleId === "users" ? "users.view" : `${moduleId}.${kind === "read" ? "read" : "execute"}`),
          inputSchema: {
            type: "object", additionalProperties: false,
            properties: {
              params: { type: "object", properties: Object.fromEntries(params.map(p => [p, { type: "string" }])), required: params, additionalProperties: false },
              query: { type: "object", additionalProperties: true },
              body: { description: "JSON body, validated by the module's existing controller" },
              raw: { type: "object", properties: { base64: { type: "string" }, contentType: { type: "string" } }, required: ["base64", "contentType"], additionalProperties: false },
              multipart: { type: "object", description: "Multipart upload: fields object and files [{field,name,contentType,base64}]; the original upload limits apply", properties: { fields: { type: "object" }, files: { type: "array", items: { type: "object", properties: { field: { type: "string" }, name: { type: "string" }, contentType: { type: "string" }, base64: { type: "string" } }, required: ["field", "name", "base64"] } } } },
            }, required: params.length ? ["params"] : [],
          },
          handler: input => dispatch(router, routePath, fullPath, method.toUpperCase(), fixedParams, input),
        };
        const key = `${moduleId}:${id}`;
        if (operations.has(key)) continue; // registrar idempotency
        operations.set(key, { id, moduleId, method: method.toUpperCase(), path: fullPath, params, tool });
      }
    }
  }
}

function payload(input: Record<string, unknown>): { data?: Buffer; contentType?: string } {
  if (input.raw && input.multipart) throw new Error("Use raw or multipart, not both");
  if (input.raw) {
    const raw = object(input.raw);
    if (typeof raw.base64 !== "string" || typeof raw.contentType !== "string" || /[\r\n]/.test(raw.contentType)) throw new Error("Invalid raw upload");
    return { data: Buffer.from(raw.base64, "base64"), contentType: raw.contentType };
  }
  if (input.multipart) {
    const multipart = object(input.multipart), boundary = `lxp${randomBytes(16).toString("hex")}`;
    const chunks: Buffer[] = [];
    const quoted = (v: unknown) => { if (typeof v !== "string" || /[\r\n"\\]/.test(v)) throw new Error("Invalid multipart name"); return v; };
    for (const [key, value] of Object.entries(object(multipart.fields))) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${quoted(key)}"\r\n\r\n${String(value)}\r\n`));
    if (!Array.isArray(multipart.files)) throw new Error("Expected multipart files");
    for (const entry of multipart.files) {
      const file = object(entry), type = String(file.contentType ?? "application/octet-stream");
      if (/[\r\n]/.test(type) || typeof file.base64 !== "string") throw new Error("Invalid multipart file");
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${quoted(file.field)}"; filename="${quoted(file.name)}"\r\nContent-Type: ${type}\r\n\r\n`), Buffer.from(file.base64, "base64"), Buffer.from("\r\n"));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return { data: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
  }
  return {};
}

async function dispatch(router: Router, routePath: string, fullPath: string, method: string, fixedParams: Record<string, string>, value: unknown): Promise<{ ok: boolean; output: unknown }> {
  const user = getContextUser(), executor = getContextExecutor();
  if (!user || !executor) return { ok: false, output: "Authenticated server context required" };
  const input = object(value), params = { ...object(input.params), ...fixedParams }, query = object(input.query);
  for (const key of Object.keys(input)) if (!["params", "query", "body", "raw", "multipart"].includes(key)) throw new Error(`Unknown tool input: ${key}`);
  const replace = (path: string) => path.replace(/:([a-zA-Z0-9_]+)/g, (_match, name: string) => {
    if (typeof params[name] !== "string" && typeof params[name] !== "number") throw new Error(`Missing route parameter: ${name}`);
    const parameter = String(params[name]);
    if (parameter === "." || parameter === ".." || /[\0]/.test(parameter)) throw new Error(`Invalid route parameter: ${name}`);
    return encodeURIComponent(parameter);
  });
  // HTTP file operations must retain the agent/project jail, even for admins.
  const checkPaths = (value: unknown, key = "") => {
    if (typeof value === "string" && /(?:paths?|directory|destination|source|root|cwd)$/i.test(key) && value.startsWith("/") && !pathInFileJail(path.posix.resolve(value))) throw new Error("Path outside the agent's project scope");
    if (Array.isArray(value)) for (const item of value) checkPaths(item, key);
    else if (value && typeof value === "object") for (const [name, item] of Object.entries(value)) checkPaths(item, name);
  };
  checkPaths({ params, query, body: input.body });
  const qs = new URLSearchParams();
  for (const [key, v] of Object.entries(query)) {
    if (Array.isArray(v)) for (const item of v) qs.append(key, String(item));
    else if (v !== undefined && v !== null) qs.append(key, String(v));
  }
  const queryString = qs.size ? `?${qs}` : "";
  const upload = payload(input);
  if ((upload.data?.length ?? Buffer.byteLength(JSON.stringify(input.body ?? {}))) > MAX_BYTES) throw new Error("Tool input exceeds 16 MiB");
  const req = new IncomingMessage(new Socket()) as Request;
  Object.setPrototypeOf(req, express.request);
  req.app = internalApp;
  const csrf = randomBytes(32).toString("hex");
  req.method = method; req.url = replace(routePath) + queryString; req.originalUrl = replace(fullPath) + queryString;
  req.headers = { host: user.targetHost ?? "localhost", "x-csrf-token": csrf, "accept-language": "es", ...(upload.contentType ? { "content-type": upload.contentType, "content-length": String(upload.data!.length) } : {}) };
  req.cookies = { [authConfig.cookie.csrfName]: csrf }; req.body = upload.data ? undefined : input.body ?? {};
  bindToolRequest(req);
  return new Promise(resolve => {
    const res = new ServerResponse(req) as Response;
    Object.setPrototypeOf(res, express.response);
    res.app = internalApp;
    res.locals = { user, authBaseUser: user, locale: "es" }; req.res = res; res.req = req;
    const buffers: Buffer[] = []; let size = 0, settled = false;
    const finish = (ok: boolean, output: unknown) => { if (settled) return; settled = true; clearTimeout(timer); req.destroy(); resolve({ ok, output }); };
    const timer = setTimeout(() => finish(false, "Module operation timed out; check its status before retrying an action"), 60_000);
    const append = (chunk: any) => { const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)); if (settled) return; size += b.length; if (size > MAX_BYTES) { finish(false, "Tool output exceeds 16 MiB; check the operation status before retrying"); return; } buffers.push(b); };
    res.write = ((chunk: any) => { append(chunk); return true; }) as Response["write"];
    res.end = ((chunk?: any) => {
      if (chunk !== undefined) append(chunk);
      const bytes = Buffer.concat(buffers), contentType = String(res.getHeader("content-type") ?? "text/plain");
      let output: unknown = bytes.toString("utf8");
      if (/json/.test(contentType)) { try { output = JSON.parse(String(output)); } catch { /* ordinary text */ } }
      else if (!/text|javascript|xml/.test(contentType)) output = { contentType, base64: bytes.toString("base64") };
      finish(res.statusCode < 400, { status: res.statusCode, data: output });
      res.emit("finish"); return res;
    }) as Response["end"];
    const failed = (error: unknown) => {
      const mapped = mapErrorToResponse(error, "es");
      if (mapped.body.code === "INTERNAL_ERROR") mapped.body.error = "Module operation failed";
      finish(false, { status: mapped.statusCode, data: mapped.body });
    };
    res.on("error", failed);
    try {
      router(req, res, error => error ? failed(error) : finish(false, "Module route not found"));
      if (upload.data) req.push(upload.data);
      req.push(null);
    } catch (error) { failed(error); }
  });
}

export const moduleOperationRegistry = {
  list(moduleId?: string): ModuleOperation[] { return [...operations.values()].filter(op => !moduleId || op.moduleId === moduleId); },
  resetForTest(): void { operations.clear(); },
};
