import fs from "node:fs/promises";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { diagnosticContext, diagnosticScope } from "./context.js";
import { sanitize, sanitizeText, fingerprint } from "./sanitize.js";
import { DEFAULT_LOGS_CONFIG, type Incident, type LogEvent, type LogsConfig, type Severity } from "./types.js";
import { moduleDiagnosticContext, persistModuleEvent, emitDiagnostic } from "./module-events.js";
import { APP_VERSION } from "../../config/version.js";

export const diagnosticsRoot = () => path.join(env.LUXIPANEL_CONFIG_DIR, "module-dev", "logs");
export const scopeKey = (scope: string) => createHash("sha256").update(scope).digest("hex").slice(0, 24);
export const scopeDir = (scope: string) => path.join(diagnosticsRoot(), scopeKey(scope));
export async function atomicJson(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temp, file);
}
export class DiagnosticsStore {
  private queue: LogEvent[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private flushing?: Promise<void>;
  private incidentCache = new Map<string, Map<string, Incident>>();
  private configs = new Map<string, LogsConfig>();
  private recent = new Map<string, number>();
  private revisions = new Map<string, number>();
  health = { accepted: 0, dropped: 0, lastWrite: "", error: "", history: {} as Record<string, { path?: string; status: string; offset: number }> };

  capture(input: { severity: Severity; source?: string; module?: string; message: string; stack?: string; requestId?: string; scope?: string; timestamp?: string; details?: unknown; url?: string; status?: number; historical?: boolean; administratorId?: number; id?: string }): string | undefined {
    try {
      const ctx = diagnosticContext.getStore()?.();
      const scope = input.scope || diagnosticScope(ctx?.user);
      if (this.configs.get("instance")?.enabled === false || this.configs.get(scope)?.enabled === false) return;
      const browser = input.source?.startsWith("frontend") === true;
      if (!browser && (input.url || ctx?.url || "").includes("/api/telemetry/errors")) return;
      const message = sanitizeText(input.message).slice(0, 8192);
      const stack = input.stack ? sanitizeText(input.stack).slice(0, 65536) : undefined;
      const url = input.url || (browser ? "" : ctx?.url || "");
      const routeModule = url.split(/[?#]/)[0]?.match(/^\/api\/([^/]+)/)?.[1];
      const module = sanitizeText(input.module && input.module !== "runtime" ? input.module : routeModule || "runtime").slice(0, 128);
      const source = input.source || "backend";
      // The telemetry transport ID is not the ID of every event in its batch.
      const requestId = input.requestId || (browser ? undefined : ctx?.requestId);
      // The request handler and the response logger describe the same failure.
      const dedupe = requestId ? `${scope}:${requestId}:${source}` : input.id;
      const now = Date.now();
      if (input.id && this.recent.has(input.id) && now - this.recent.get(input.id)! < 120_000) return;
      if (dedupe && this.recent.has(dedupe) && now - this.recent.get(dedupe)! < 120_000) return;
      if (dedupe) this.recent.set(dedupe, now);
      if (this.recent.size > 10_000) for (const [k, t] of this.recent) if (now - t > 120_000) this.recent.delete(k);
      if (this.queue.length >= 5000) { this.health.dropped++; return; }
      const event: LogEvent = {
        id: input.id || randomUUID(), timestamp: input.timestamp || new Date().toISOString(), scope,
        severity: input.severity, source, module, message, stack, requestId,
        details: sanitize(input.details), url: sanitizeText(url), status: input.status,
        administratorId: input.administratorId,
        fingerprint: fingerprint(input.severity, source, module, message, stack), historical: input.historical,
        component: moduleDiagnosticContext.getStore() || { kind: "luxipanel", id: "luxipanel", version: APP_VERSION, origin: "execution" },
      };
      const component = event.component!;
      event.fingerprint = fingerprint(input.severity, source, `${module}:${component.kind}:${component.id}:${component.version}`, message, stack);
      if (component.kind === "module") { if (persistModuleEvent(event)) { this.health.accepted++; return event.id; } this.health.dropped++; return; }
      this.recent.set(event.id, now);
      while (this.recent.size > 10000) this.recent.delete(this.recent.keys().next().value!);
      if (event.severity === "fatal") {
        try { mkdirSync(scopeDir(scope), { recursive: true, mode: 0o700 }); appendFileSync(path.join(scopeDir(scope), `${event.timestamp.slice(0, 10)}.ndjson`), JSON.stringify(event) + "\n", { mode: 0o600 }); }
        catch (err) { this.health.dropped++; this.health.error = sanitizeText(String(err)); }
      } else this.queue.push(event);
      this.health.accepted++;
      emitDiagnostic(event);
      this.revisions.set(scope, (this.revisions.get(scope) || 0) + 1);
      const groups = this.incidentCache.get(scope);
      if (groups) {
        const group = groups.get(event.fingerprint);
        if (group) { group.count++; group.firstSeen = group.firstSeen < event.timestamp ? group.firstSeen : event.timestamp; if (event.timestamp >= group.lastSeen) { group.lastSeen = event.timestamp; group.sample = event; } }
        else groups.set(event.fingerprint, { id: event.fingerprint, severity: event.severity, source: event.source, module: event.module, message: event.message, firstSeen: event.timestamp, lastSeen: event.timestamp, count: 1, sample: event });
      }
      if (!this.timer) { this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 100); this.timer.unref(); }
      return event.id;
    } catch { this.health.dropped++; }
  }

  async flush(): Promise<void> {
    if (this.flushing) { await this.flushing; if (this.queue.length) return this.flush(); return; }
    const batch = this.queue.splice(0);
    if (!batch.length) return;
    this.flushing = (async () => {
      const files = new Map<string, LogEvent[]>();
      for (const event of batch) {
        const file = path.join(scopeDir(event.scope), `${event.timestamp.slice(0, 10)}.ndjson`);
        const list = files.get(file) || []; list.push(event); files.set(file, list);
      }
      for (const [file, events] of files) {
        try {
          await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
          await fs.appendFile(file, events.map((e) => JSON.stringify(e)).join("\n") + "\n", { mode: 0o600 });
          this.health.lastWrite = new Date().toISOString(); this.health.error = "";
        } catch (err) { this.health.dropped += events.length; this.health.error = sanitizeText(String(err)); for (const event of events) this.incidentCache.delete(event.scope); }
      }
    })();
    try { await this.flushing; } finally { this.flushing = undefined; }
  }

  async config(scope: string): Promise<LogsConfig> {
    if (this.configs.has(scope)) return this.configs.get(scope)!;
    let saved: Record<string, unknown> = {}; try { saved = JSON.parse(await fs.readFile(path.join(scopeDir(scope), "config.json"), "utf8")); delete saved.scope; } catch { /* first run */ }
    const config = { ...DEFAULT_LOGS_CONFIG, ...saved };
    this.configs.set(scope, config); return config;
  }
  async saveConfig(scope: string, config: LogsConfig): Promise<void> {
    await atomicJson(path.join(scopeDir(scope), "config.json"), { ...config, scope });
    this.configs.set(scope, config); await this.prune(scope);
  }

  async *events(scope: string): AsyncGenerator<LogEvent> {
    await this.flush();
    let files: string[] = []; try { files = (await fs.readdir(scopeDir(scope))).filter((f) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(f)).sort(); } catch { return; }
    // Stream lines instead of loading a retained day (up to 512MiB) into RAM.
    const { createReadStream } = await import("node:fs");
    const { createInterface } = await import("node:readline");
    const importedIds = new Set<string>();
    for (const file of files) {
      const reader = createInterface({ input: createReadStream(path.join(scopeDir(scope), file)), crlfDelay: Infinity });
      for await (const line of reader) { try { const event = JSON.parse(line) as LogEvent; if (event.scope === scope && !importedIds.has(event.id)) { importedIds.add(event.id); yield event; } } catch { /* interrupted final line */ } }
    }
  }
  async incidents(scope: string): Promise<Incident[]> {
    await this.flush();
    let groups = this.incidentCache.get(scope);
    if (!groups) {
      const revision = this.revisions.get(scope) || 0;
      groups = new Map();
      for await (const event of this.events(scope)) {
        const group = groups.get(event.fingerprint);
        if (group) {
          group.count++; if (event.timestamp < group.firstSeen) group.firstSeen = event.timestamp;
          if (event.timestamp >= group.lastSeen) { group.lastSeen = event.timestamp; group.sample = event; }
        } else groups.set(event.fingerprint, { id: event.fingerprint, severity: event.severity, source: event.source, module: event.module, message: event.message, firstSeen: event.timestamp, lastSeen: event.timestamp, count: 1, sample: event });
      }
      // A capture during the stream must not leave a stale cached index.
      if (revision === (this.revisions.get(scope) || 0)) this.incidentCache.set(scope, groups);
    }
    return [...groups.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }
  async detail(scope: string, id: string, offset = 0, limit = 100): Promise<{ incident?: Incident; events: LogEvent[]; total: number }> {
    const incident = (await this.incidents(scope)).find((i) => i.id === id);
    const events: LogEvent[] = []; let total = 0;
    if (incident) for await (const event of this.events(scope)) if (event.fingerprint === id) { if (total >= offset && events.length < limit) events.push(event); total++; }
    return { incident, events, total };
  }
  async prune(scope: string): Promise<void> {
    const config = await this.config(scope); const cutoff = Date.now() - config.retentionDays * 86400_000;
    let files: string[]; try { files = (await fs.readdir(scopeDir(scope))).filter((f) => /^\d{4}-\d{2}-\d{2}\.ndjson$/.test(f)).sort().reverse(); } catch { return; }
    let bytes = 0;
    for (const file of files) {
      const full = path.join(scopeDir(scope), file); const stat = await fs.stat(full); bytes += stat.size;
      if (Date.parse(file.slice(0, 10)) + 86400_000 < cutoff || bytes > config.maxStorageMiB * 1024 * 1024) { await fs.unlink(full); this.incidentCache.delete(scope); }
    }
  }
  async warmConfigs(): Promise<void> {
    let dirs: string[]; try { dirs = await fs.readdir(diagnosticsRoot()); } catch { return; }
    for (const dir of dirs.filter((name) => /^[a-f0-9]{24}$/.test(name))) {
      try { const saved = JSON.parse(await fs.readFile(path.join(diagnosticsRoot(), dir, "config.json"), "utf8")); if (typeof saved.scope === "string" && scopeKey(saved.scope) === dir) { const { scope, ...config } = saved; this.configs.set(scope, { ...DEFAULT_LOGS_CONFIG, ...config }); } } catch { /* report through normal config access */ }
    }
  }
  async pruneAll(): Promise<void> {
    for (const scope of new Set(["instance", ...this.configs.keys()])) await this.prune(scope);
  }
}
export const diagnosticsStore = new DiagnosticsStore();
