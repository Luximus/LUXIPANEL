// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Executor } from "../../../../../shared/executor/types.js";

import {
  buildPromptWithContext,
  ensureCodexConversationHome,
  codexThreadHasWriter,
  discoverCodexOrphanJob,
  TRANSCRIPT_MAX_CHARS,
  TRANSCRIPT_TURN_CLAMP,
} from "./cli-session.js";

describe("codexThreadHasWriter", () => {
  const id = "01a10cc5-2afc-7d81-ae90-503a452b325a";
  it("finds a live writer and ignores zombies or a quoted id in another prompt", async () => {
    const executor = { exec: async () => ({ stdout: [
      `702047 S /home/sample-user/.npm-global/bin/codex exec resume ${id} --json`,
      `702048 Z /home/sample-user/.npm-global/bin/codex exec resume ${id} --json`,
    ].join("\n") }) } as unknown as Executor;
    await expect(codexThreadHasWriter(executor, id)).resolves.toBe(true);
    const zombieOnly = { exec: async () => ({ stdout: `702048 Z /bin/codex exec resume ${id} --json\n` }) } as unknown as Executor;
    await expect(codexThreadHasWriter(zombieOnly, id)).resolves.toBe(false);
    const quoted = { exec: async () => ({ stdout: `702049 S /bin/codex exec --json arregla codex exec resume ${id}\n` }) } as unknown as Executor;
    await expect(codexThreadHasWriter(quoted, id)).resolves.toBe(false);
  });
});

it("discovers the original nohup job behind a still-running Codex thread", async () => {
  const id = "01a10cc5-2afc-7d81-ae90-503a452b325a";
  const executor = { exec: async (command: string) => ({ stdout:
    command.includes("-C codex") ? `702047 702040 Sl /usr/local/bin/codex exec resume ${id} --json\n`
      : command.includes("-p 702040") ? "702038 node /home/sample-user/.npm-global/bin/codex exec resume\n"
      : command.includes("-p 702038") ? "1 bash -c codex exec resume 'id' \"$(cat '/tmp/lxp-cli-1791245821678-3yh4ub-prompt.txt')\"\n"
      : command.includes("test -f") ? "Y\n" : "",
  }) } as unknown as Executor;
  await expect(discoverCodexOrphanJob(executor, id)).resolves.toEqual({
    jobId: "lxp-cli-1791245821678-3yh4ub", pid: "702038",
  });
});

const SYS = "SISTEMA";

describe("ensureCodexConversationHome", () => {
  it("prepares a syntactically valid shell with protected MCP channels", async () => {
    const executor = {
      async exec(command: string) {
        // Parse the inner login script without executing it or reading credentials.
        execFileSync("bash", ["-c", command.replace(/^bash -c /, "bash -n -c ")]);
        return { stdout: "__LXP_CODEX_HOME__/tmp/test-codex-conversation\n", stderr: "", exitCode: 0 };
      },
    } as unknown as Executor;
    await expect(ensureCodexConversationHome(executor, "test-conversation", {
      url: "https://panel.test/graph", token: "graph-fixture",
    }, { url: "https://panel.test/modules", token: "modules-fixture" }))
      .resolves.toBe("/tmp/test-codex-conversation");
  });
  it("creates the isolated config and removes inherited unscoped graph access", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "lxp-codex-home-test-"));
    const shared = path.join(directory, "codex");
    mkdirSync(shared);
    const original = 'model = "fixture"\n[mcp_servers.codebase-memory]\ncommand = "unscoped-fixture"\n[mcp_servers.luxipanel]\ntransport = "http"\nheaders = { Authorization = "Bearer stale-fixture" }\n[mcp_servers.luxipanel.env]\nOLD = "stale"\n[mcp_servers.luxipanel-modules]\nurl = "https://old.test"\n[mcp_servers.other]\nurl = "https://other.test"\n';
    writeFileSync(path.join(shared, "config.toml"), original);
    writeFileSync(path.join(shared, "auth.json"), '{"fixture":true}');
    const executor = {
      async exec(command: string) {
        const inner = command.slice("bash -c '".length, -1).replaceAll("'\"'\"'", "'");
        const script = inner.slice(inner.indexOf('shared="$HOME/.codex"'))
          .replace('shared="$HOME/.codex"', `shared="${shared}"`);
        const stdout = execFileSync("bash", ["-c", script], { encoding: "utf8" });
        return { stdout, stderr: "", exitCode: 0 };
      },
    } as unknown as Executor;
    try {
      const home = await ensureCodexConversationHome(executor, "fixture", undefined,
        { url: "https://panel.test/modules", token: "modules-fixture" });
      const config = readFileSync(path.join(home, "config.toml"), "utf8");
      expect(config).toContain('[mcp_servers.luxipanel-modules]');
      expect(config).toContain('Bearer modules-fixture');
      expect(config).not.toContain('unscoped-fixture');
      expect(config).not.toContain('https://old.test');
      expect(config).not.toContain('stale-fixture');
      expect(config).not.toContain('[mcp_servers.luxipanel]');
      expect(config).toContain('https://other.test');
      expect(readFileSync(path.join(shared, "config.toml"), "utf8")).toBe(original);
      expect(statSync(path.join(home, "config.toml")).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("buildPromptWithContext", () => {
  it("incluye los turnos previos pequeños tal cual", () => {
    const prompt = buildPromptWithContext(
      [
        { role: "user", content: "arregla el bug del footer" },
        { role: "assistant", content: "hecho, era un z-index" },
        { role: "user", content: "y ahora el header" },
      ],
      SYS,
    );
    expect(prompt).toContain("Usuario: arregla el bug del footer");
    expect(prompt).toContain("Asistente: hecho, era un z-index");
    expect(prompt).toContain("Usuario: y ahora el header");
  });

  // Regresión 2026-07-22: los runs CLI persisten TODO el log del terminal como
  // `content` del asistente (>24k rutinario). El walk cortaba en el PRIMER
  // turno previo sobredimensionado y el reseed por overflow salía con la
  // "Conversación previa" VACÍA → la sesión nueva no sabía nada de la tarea
  // delegada ("empezó a trabajar y luego olvidó").
  it("un turno previo gigante no vacía el transcript (se clampa, no se corta)", () => {
    const hugeAssistant = `⚠ banner del CLI\n${"x".repeat(TRANSCRIPT_MAX_CHARS + 2_000)}\nCONCLUSION-FINAL`;
    const prompt = buildPromptWithContext(
      [
        { role: "user", content: "TAREA-ORIGINAL: delega el refactor al equipo" },
        { role: "assistant", content: hugeAssistant },
        { role: "user", content: "ya esta el plan ?" },
      ],
      SYS,
    );
    // La tarea original SIEMPRE sobrevive al reseed.
    expect(prompt).toContain("TAREA-ORIGINAL");
    // Del turno gigante quedan cabeza y cola (la respuesta real vive al final).
    expect(prompt).toContain("⚠ banner del CLI");
    expect(prompt).toContain("CONCLUSION-FINAL");
    expect(prompt).toContain("[turno truncado");
    // Y no revienta el presupuesto: el turno quedó acotado al clamp.
    expect(prompt.length).toBeLessThan(SYS.length + TRANSCRIPT_MAX_CHARS);
  });

  it("respeta el presupuesto global descartando los turnos más viejos", () => {
    const turn = "y".repeat(TRANSCRIPT_TURN_CLAMP - 100);
    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `T${i} ${turn}`,
    }));
    messages.push({ role: "user", content: "último" });
    const prompt = buildPromptWithContext(messages, SYS, { maxTurns: 100 });
    // Caben ~4 turnos de ~6k en 24k: los más recientes entran, los viejos no.
    expect(prompt).toContain("T11");
    expect(prompt).not.toContain("T0 ");
    expect(prompt).toContain("Usuario: último");
  });

  it("con un solo mensaje no emite bloque de conversación previa", () => {
    const prompt = buildPromptWithContext([{ role: "user", content: "hola" }], SYS);
    expect(prompt).toBe(`${SYS}\n\nUsuario: hola`);
    expect(prompt).not.toContain("Conversación previa");
  });
});
