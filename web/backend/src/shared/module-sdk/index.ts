// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import { SDK_VERSION } from "./sdk-version.js";
import { sdkRangeSupported } from "./sdk-range.js";
import { chatContractErrors, type ChatContract } from "./chat-contract.js";
import { getContextUser, pathInFileJail } from "../executor/context.js";
import { canAccessPath, canExecuteCommand } from "../auth/role-permissions.js";
/**
 * @luxipanel/module-sdk (interno) — contrato de un módulo de comunidad.
 *
 * Un dev escribe `export default defineModule((m) => { m.tool(...) })`. El loader
 * (modules/community) inyecta el `manifest`, construye un `AgentCapability` (con
 * el prefijo `<id>.` autogenerado) y lo registra. Los handlers reciben `ctx` —
 * el ÚNICO puente con efectos — con gate de `capabilities` en runtime.
 * Ver LUXIPANEL/MODULE-SDK-SPEC.md.
 */
import type { AgentCapability, AgentTool, AgentDataPanel, ToolInputSchema } from "../agent-capability/types.js";
import type { ExecOptions, ExecResult, DirEntry, FileStat } from "../executor/types.js";
import { getContextExecutor } from "../executor/context.js";
import { moduleDiagnosticContext } from "../diagnostics/module-events.js";
import { kv } from "../kv-store/index.js";
import { createModuleLogger } from "../logger/index.js";
import { checkUrlAllowlisted } from "../net/host-allowlist.js";

export type Capability = "server.exec" | "server.sudo" | "server.fs.read" | "server.fs.write" | "storage" | "http";

/**
 * Versión actual del SDK interno. Única fuente para el `TemplateContext` del
 * architecture pack del asistente y para el campo `sdk` del manifest borrador
 * que genera la IA (flujo marketplace — MODULE-DEV-AI-FLOW.md).
 */
export { SDK_VERSION } from "./sdk-version.js";

/** Subconjunto del manifest que el runtime necesita (el schema completo lo valida el pipeline). */
export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  capabilities: Capability[];
  chat?: ChatContract;
  http_allowlist?: string[];
  [k: string]: unknown;
}

export interface ModuleCtx {
  runId: string;
  now: number;
  user: { linux?: string };
  target: { id: string; name: string };
  log: ReturnType<typeof createModuleLogger>;
  server: {
    exec(cmd: string, opts?: ExecOptions & { sudo?: boolean }): Promise<ExecResult>;
    readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
    readdir(path: string): Promise<DirEntry[]>;
    stat(path: string): Promise<FileStat>;
    writeFile(path: string, data: string | Buffer): Promise<void>;
    mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    unlink(path: string): Promise<void>;
  };
  storage: ReturnType<ReturnType<typeof kv>["module"]>;
  http: { fetch(url: string, init?: RequestInit): Promise<Response> };
  events: { emit(event: string, payload?: unknown): void };
}

export interface ToolDef {
  title: string;
  description: string;
  kind: "read" | "action";
  input: ToolInputSchema;
  /** Permiso de usuario requerido (slug). El dispatch lo verifica. */
  permission?: string;
  handler: (input: any, ctx: ModuleCtx) => Promise<{ ok: boolean; output: unknown }>;
}

export interface DataPanelDef {
  title: string;
  description: string;
  ttlSeconds?: number;
  collect: (ctx: ModuleCtx) => Promise<Record<string, unknown>>;
}

class ModuleBuilder {
  readonly tools: { suffix: string; def: ToolDef }[] = [];
  readonly panels: { suffix: string; def: DataPanelDef }[] = [];
  readonly prompts: string[] = [];
  tool(suffix: string, def: ToolDef): void { this.tools.push({ suffix, def }); }
  dataPanel(suffix: string, def: DataPanelDef): void { this.panels.push({ suffix, def }); }
  suggest(prompt: string): void { this.prompts.push(prompt); }
}

export type ModuleSetup = (m: ModuleBuilder) => void;
export interface ModuleFactory { readonly __luxModule: true; setup: ModuleSetup; }

/** Punto de entrada que el dev exporta por defecto. */
export function defineModule(setup: ModuleSetup): ModuleFactory {
  return { __luxModule: true, setup };
}

// ── Runtime interno (lo usa el loader) ────────────────────────────

let runCounter = 0;

function assertAllowlisted(manifest: ModuleManifest, url: string): void {
  // Matcher semantics live in `shared/net/host-allowlist.ts` (SSOT shared with
  // the preview-sandbox broker); only the wording is SDK-specific.
  const { ok, host } = checkUrlAllowlisted(manifest.http_allowlist ?? [], url);
  if (host === null) throw new Error(`URL inválida: ${url}`);
  if (!ok) throw new Error(`Module ${manifest.id}: host "${host}" no está en http_allowlist`);
}

/**
 * Allowlisted fetch that re-validates EVERY hop. `fetch`'s default
 * `redirect: "follow"` only checks the initial URL, so an allowlisted host could
 * 302 the module into `http://127.0.0.1:8080` or the cloud metadata endpoint
 * (`169.254.169.254`) — SSRF from the panel process. We drive redirects manually
 * and re-run `assertAllowlisted` on each `Location`, so every host a
 * community-module request touches must be on its allowlist.
 */
const MAX_MODULE_FETCH_REDIRECTS = 5;
async function allowlistedFetch(
  manifest: ModuleManifest,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_MODULE_FETCH_REDIRECTS; hop++) {
    assertAllowlisted(manifest, currentUrl);
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res; // 3xx without Location — hand it back as-is
    // Resolve relative Locations against the current URL, then re-validate.
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error(`Module ${manifest.id}: demasiadas redirecciones HTTP (>${MAX_MODULE_FETCH_REDIRECTS})`);
}

function buildCtx(manifest: ModuleManifest, declared: Set<Capability>): ModuleCtx {
  const gate = (cap: Capability) => {
    if (!declared.has(cap)) throw new Error(`Module ${manifest.id} usó la capability "${cap}" no declarada en el manifest`);
  };
  const exec = () => {
    const e = getContextExecutor();
    if (!e) throw new Error(`Module ${manifest.id}: no hay executor de servidor en contexto (fail-closed)`);
    return e;
  };
  const checkPath = (p: string, op: "read" | "write") => {
    const user = getContextUser();
    if (!p.startsWith("/") || !pathInFileJail(path.posix.resolve(p)) || (user && !canAccessPath(user, path.posix.resolve(p), op))) throw new Error("Module path access denied");
  };
  const log = createModuleLogger(`community:${manifest.id}`);
  return {
    runId: `cm_${Date.now()}_${runCounter++}`,
    now: Date.now(),
    get user() { return { linux: exec().sshUsername }; },
    get target() { return exec().target; },
    log,
    server: {
      exec: (cmd, o) => { gate("server.exec"); const user = getContextUser(); if (user && !canExecuteCommand(user, cmd)) throw new Error("Module command access denied"); if (o?.sudo) gate("server.sudo"); return exec().exec(cmd, o); },
      readFile: (p, enc) => { gate("server.fs.read"); checkPath(p, "read"); return exec().readFile(p, enc); },
      readdir: (p) => { gate("server.fs.read"); checkPath(p, "read"); return exec().readdir(p); },
      stat: (p) => { gate("server.fs.read"); checkPath(p, "read"); return exec().stat(p); },
      writeFile: (p, d) => { gate("server.fs.write"); checkPath(p, "write"); return exec().writeFile(p, d); },
      mkdir: (p, o) => { gate("server.fs.write"); checkPath(p, "write"); return exec().mkdir(p, o); },
      rename: (f, t) => { gate("server.fs.write"); checkPath(f, "write"); checkPath(t, "write"); return exec().rename(f, t); },
      unlink: (p) => { gate("server.fs.write"); checkPath(p, "write"); return exec().unlink(p); },
    },
    storage: kv(exec()).module(`community:${manifest.id}`),
    http: {
      fetch: (url, init) => { gate("http"); return allowlistedFetch(manifest, url, init); },
    },
    events: { emit: (event, payload) => { log.info({ event, payload }, "module event"); } },
  };
}

/** Construye el AgentCapability a partir de un factory + manifest. */
export function buildCapability(manifest: ModuleManifest, factory: ModuleFactory): AgentCapability {
  if (!sdkRangeSupported(manifest.sdk, SDK_VERSION)) throw new Error("Module SDK version is incompatible");
  if (!factory?.__luxModule) throw new Error(`Module ${manifest.id}: el export por defecto no es defineModule(...)`);
  const b = new ModuleBuilder();
  factory.setup(b);
  const declared = new Set<Capability>(manifest.capabilities ?? []);

  const tools: AgentTool[] = b.tools.map(({ suffix, def }) => ({
    name: `${manifest.id}.${suffix}`,          // prefijo autogenerado (evita el crash del registry)
    title: def.title,
    description: def.description,
    kind: def.kind,
    permission: def.permission ?? (manifest.tool_permissions as Record<string, string> | undefined)?.[suffix],
    inputSchema: def.input,
    handler: (input: unknown) => moduleDiagnosticContext.run({ kind: "module", id: manifest.id, version: manifest.version, origin: "execution" }, async () => { try { return await def.handler(input, buildCtx(manifest, declared)); } catch (error) { createModuleLogger(manifest.id).error({ err: error }, "Module tool failed"); throw error; } }),
  }));

  const dataPanels: AgentDataPanel[] = b.panels.map(({ suffix, def }) => ({
    name: `${manifest.id}.${suffix}`,
    title: def.title,
    description: def.description,
    ttlSeconds: def.ttlSeconds,
    collect: () => moduleDiagnosticContext.run({ kind: "module", id: manifest.id, version: manifest.version, origin: "execution" }, async () => { try { return await def.collect(buildCtx(manifest, declared)); } catch (error) { createModuleLogger(manifest.id).error({ err: error }, "Module data collection failed"); throw error; } }),
  }));

  const capability: AgentCapability = { moduleId: manifest.id, catalogModuleId: manifest.id, moduleVersion: manifest.version, version: 1, tools, dataPanels, suggestedPrompts: b.prompts };
  const errors = chatContractErrors(manifest, capability);
  if (errors.length) throw new Error(errors.join("; "));
  return capability;
}
