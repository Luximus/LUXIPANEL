// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Smoke del runtime de módulos de comunidad (SDK + loader + dispatch logic),
 * standalone (sin DB/red): executor stub vía runWithExecutor.
 *   Run: npx tsx src/modules/community/community.smoke.ts
 */
import { defineModule, type ModuleManifest } from "../../shared/module-sdk/index.js";
import { loadModule, unloadModule } from "./community-loader.service.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/registry.js";
import { runWithExecutor } from "../../shared/executor/context.js";
import type { Executor } from "../../shared/executor/types.js";

let pass = 0, fail = 0;
const ok = (l: string, c: boolean, e = "") => { if (c) { pass++; console.log("PASS " + l); } else { fail++; console.log("FAIL " + l + (e ? "  → " + e : "")); } };

const stub = {
  target: { id: "test-server", name: "Test" },
  sshUsername: "tester",
  async exec(cmd: string) { return { stdout: `ran: ${cmd}`, stderr: "", exitCode: 0, durationMs: 1 }; },
  async readFile() { return "{}"; },
  async writeFile() {},
  async readdir() { return []; },
  async stat() { return {} as any; },
  async mkdir() {},
  async unlink() {},
  async rename() {},
  spawn() { throw new Error("no spawn"); },
} as unknown as Executor;

const manifest: ModuleManifest = {
  id: "hello-world", name: "Hello", version: "1.0.0",
  capabilities: ["server.exec", "storage"], // NOTA: http NO declarado a propósito
};

const factory = defineModule((m) => {
  m.tool("greet", {
    title: "Saludar", description: "Runs echo on the server.", kind: "read",
    input: { type: "object", properties: { who: { type: "string" } }, required: ["who"] },
    async handler({ who }, ctx) {
      const r = await ctx.server.exec(`echo hello ${who}`);
      return { ok: r.exitCode === 0, output: { said: r.stdout } };
    },
  });
  m.tool("leak", {
    title: "Fuga", description: "Tries undeclared http capability.", kind: "action",
    input: { type: "object" },
    async handler(_input, ctx) {
      await ctx.http.fetch("https://evil.example.com"); // debe lanzar (http no declarado)
      return { ok: true, output: {} };
    },
  });
});

await (async () => {
  // 1) Carga → registra con prefijo autogenerado
  loadModule(manifest, factory);
  const found = agentCapabilityRegistry.findTool("hello-world.greet");
  ok("loader: tool 'hello-world.greet' registrada", !!found && found.moduleId === "hello-world");
  ok("loader: prefijo autogenerado (no requiere que el dev lo ponga)", agentCapabilityRegistry.findTool("hello-world.leak") != null);

  // 2) Ejecuta el handler dentro del scope del executor
  const greet = agentCapabilityRegistry.findTool("hello-world.greet")!;
  const out = await runWithExecutor(stub, () => greet.tool.handler({ who: "luxi" }));
  ok("dispatch: handler usa ctx.server.exec", (out.output as any)?.said === "ran: echo hello luxi", JSON.stringify(out));

  // 3) Gate de capabilities: http no declarado → lanza
  const leak = agentCapabilityRegistry.findTool("hello-world.leak")!;
  let threw = false;
  try { await runWithExecutor(stub, () => leak.tool.handler({})); } catch (e: any) { threw = /http/.test(e?.message ?? ""); }
  ok("gate: capability http no declarada lanza", threw);

  // 4) Sin executor en contexto → fail-closed
  let failClosed = false;
  try { await greet.tool.handler({ who: "x" }); } catch (e: any) { failClosed = /executor/.test(e?.message ?? ""); }
  ok("fail-closed: sin executor de contexto lanza", failClosed);

  // 5) Unload → desregistra
  unloadModule("hello-world");
  ok("unload: tool ya no resuelve", agentCapabilityRegistry.findTool("hello-world.greet") == null);

  console.log(`\n[community] ${pass} PASS, ${fail} FAIL`);
  process.exit(fail > 0 ? 1 : 0);
})();
