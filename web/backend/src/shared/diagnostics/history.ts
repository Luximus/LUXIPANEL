import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { localExecutor } from "../executor/index.js";
import { atomicJson, diagnosticsRoot, diagnosticsStore } from "./store.js";
import { installRuntimeDiagnostics } from "./runtime.js";
import { historyRecord } from "./history-format.js";
import { sanitizeText } from "./sanitize.js";

interface Cursor { inode: number; offset: number; pending?: { text: string; position: number } }
interface Source { name: string; file: string; source: string; stderr: boolean }
let running = false; let started = false;
const cursors: Record<string, Cursor> = {};
let sources: Source[] = [];
function parse(source: Source, line: string, position: number, historical: boolean): void {
  const record = historyRecord(line, source.stderr); if (!record) return;
  diagnosticsStore.capture({ ...record, id: record.id || createHash("sha256").update(`${source.file}:${cursors[source.file]?.inode}:${position}`).digest("hex"), scope: "instance", source: source.source, historical });
}
async function discover(): Promise<void> {
  try {
    const result = await localExecutor.exec("pm2 jlist", { timeoutMs: 8000 });
    if (result.exitCode !== 0) throw new Error("PM2 no disponible");
    const rows = JSON.parse(result.stdout) as { name: string; pm2_env?: { pm_out_log_path?: string; pm_err_log_path?: string } }[];
    sources = rows.filter((r) => ["luxipanel-backend", "luxipanel-frontend"].includes(r.name)).flatMap((row) => {
      const out: Source[] = [];
      for (const [key, stderr] of [["pm_out_log_path", false], ["pm_err_log_path", true]] as const) {
        const file = row.pm2_env?.[key]; if (file && path.isAbsolute(file)) out.push({ name: row.name, file, stderr, source: row.name.endsWith("frontend") ? "frontend-ssr" : "backend" });
      }
      return out;
    });
    if (!sources.length) diagnosticsStore.health.history.pm2 = { status: "No hay procesos LUXIPANEL con historial disponible.", offset: 0 };
  } catch { diagnosticsStore.health.history.pm2 = { status: "PM2 no disponible. La captura directa sigue activa.", offset: 0 }; }
}
async function poll(historical = false): Promise<void> {
  if (running) return; running = true;
  try {
    for (const source of sources) {
      try {
        const stat = await fs.stat(source.file); let cursor = cursors[source.file];
        const backfill = historical || diagnosticsStore.health.history[source.name + (source.stderr ? ":stderr" : ":stdout")]?.status === "Importando historial";
        if (cursor?.pending && (cursor.inode !== stat.ino || cursor.offset > stat.size)) parse(source, cursor.pending.text, cursor.pending.position, backfill);
        if (!cursor || cursor.inode !== stat.ino || cursor.offset > stat.size) cursor = cursors[source.file] = { inode: stat.ino, offset: 0 };
        // Direct backend hooks own new events. The PM2 importer owns its historical backfill.
        if (!backfill && source.source === "backend") { cursor.offset = stat.size; continue; }
        const handle = await fs.open(source.file, "r");
        try {
          let budget = 2 * 1024 * 1024;
          while (cursor.offset < stat.size && budget > 0) {
            const buffer = Buffer.alloc(Math.min(128 * 1024, stat.size - cursor.offset, budget));
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, cursor.offset); if (!bytesRead) break;
            const lastNewline = buffer.subarray(0, bytesRead).lastIndexOf(10);
            if (lastNewline < 0) { if (bytesRead >= 128 * 1024) { diagnosticsStore.health.dropped++; cursor.offset += bytesRead; budget -= bytesRead; continue; } break; }
            const start = cursor.offset; cursor.offset += lastNewline + 1; budget -= lastNewline + 1;
            const lines = buffer.subarray(0, lastNewline).toString("utf8").split("\n");
            let position = start;
            for (const line of lines) {
              if (cursor.pending && /^\s*(?:at\s|\d+:\s|\.\.\. \d+ more|Caused by:|File ")/.test(line)) cursor.pending.text = (cursor.pending.text + "\n" + sanitizeText(line)).slice(0, 65536);
              else {
                if (cursor.pending) { parse(source, cursor.pending.text, cursor.pending.position, backfill); cursor.pending = undefined; }
                if (line.trim().startsWith("{")) parse(source, line, position, backfill);
                else if (historyRecord(line, source.stderr)) cursor.pending = { text: sanitizeText(line), position };
              }
              position += Buffer.byteLength(line) + 1;
            }
            await diagnosticsStore.flush();
          }
          if (cursor.offset >= stat.size && cursor.pending) { parse(source, cursor.pending.text, cursor.pending.position, backfill); cursor.pending = undefined; }
        } finally { await handle.close(); }
        diagnosticsStore.health.history[source.name + (source.stderr ? ":stderr" : ":stdout")] = { status: cursor.offset < stat.size ? "Importando historial" : "Activo", offset: cursor.offset };
      } catch (err) { diagnosticsStore.health.history[source.name + (source.stderr ? ":stderr" : ":stdout")] = { status: String((err as Error).message), offset: 0 }; }
    }
    await diagnosticsStore.flush();
    await atomicJson(path.join(diagnosticsRoot(), "history-cursors.json"), cursors);
  } catch (err) { diagnosticsStore.health.error = String((err as Error).message); }
  finally { running = false; }
}
export async function startDiagnostics(): Promise<void> {
  if (started) return; started = true; installRuntimeDiagnostics();
  try { Object.assign(cursors, JSON.parse(await fs.readFile(path.join(diagnosticsRoot(), "history-cursors.json"), "utf8"))); } catch { /* first start */ }
  await diagnosticsStore.warmConfigs(); await discover(); await poll(true);
  const timer = setInterval(() => { void poll(); }, 3000); timer.unref();
  const cleanup = setInterval(() => { void diagnosticsStore.pruneAll().catch(() => undefined); }, 60_000); cleanup.unref();
}
