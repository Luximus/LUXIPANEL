#!/usr/bin/env node
/**
 * Smoke de os-compat-derive.mjs (sin red, fixtures temporales).
 * Correr: node security/os-compat-derive.smoke.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TOOL = path.join(HERE, "os-compat-derive.mjs");

let n = 0;
const ok = (name) => console.log(`  ✓ ${++n}. ${name}`);
const assert = (cond, msg) => { if (!cond) { console.error(`  ✗ FAIL: ${msg}`); process.exit(1); } };

function runOn(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oscd-"));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  try {
    return JSON.parse(execFileSync("node", [TOOL, dir], { encoding: "utf8" }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 1. módulo apt/ufw → familia debian
{
  const v = runOn({
    "backend/index.js": `
      export default (m) => m.tool("setup", { async handler(_, ctx) {
        await ctx.server.exec("sudo apt-get install -y nginx && ufw allow 80/tcp");
        await ctx.server.exec("systemctl reload nginx");
      }});`,
  });
  assert(v.os_compat.includes("ubuntu>=22.04") && v.os_compat.includes("debian>=12"), `debian-family esperada, got ${v.os_compat}`);
  assert(!v.baselineUsed, "no debe ser baseline (hay evidencia apt)");
  assert(v.evidence.some((e) => e.token === "apt-get"), "evidencia apt-get");
  assert(v.runtime_deps_hints.some((h) => h.cmd === "nginx"), "hint runtime nginx");
  ok("apt-get + ufw → ubuntu/debian, evidencia y hints");
}

// 2. módulo dnf → familia rhel
{
  const v = runOn({ "backend/index.js": `await ctx.server.exec("dnf install -y redis-server");` });
  assert(v.os_compat.includes("rhel>=9"), `rhel-family esperada, got ${v.os_compat}`);
  assert(!v.os_compat.includes("ubuntu>=22.04"), "no debe incluir ubuntu");
  ok("dnf → rhel/almalinux/rocky");
}

// 3. mixto apt + dnf (módulo con fallback por distro) → unión de familias
{
  const v = runOn({ "backend/index.js": `const cmd = isDebian ? "apt-get install x" : "dnf install x";` });
  assert(v.os_compat.includes("debian>=12") && v.os_compat.includes("rhel>=9"), `unión esperada, got ${v.os_compat}`);
  ok("apt + dnf → unión debian+rhel");
}

// 4. sin señales distro → baseline
{
  const v = runOn({ "backend/index.js": `await ctx.server.exec("cat /etc/hostname");` });
  assert(v.baselineUsed === true, "baseline esperada");
  assert(v.os_compat.join(",") === "ubuntu>=22.04,debian>=12", `baseline got ${v.os_compat}`);
  ok("sin señales → baseline ubuntu/debian");
}

// 5. arch: binario solo x86_64 → acota; ambas menciones → ambas
{
  const v1 = runOn({ "backend/index.js": `const url = "https://dl.acme.com/tool-linux-amd64.tar.gz";` });
  assert(v1.arch.join(",") === "x86_64", `solo x86_64 esperado, got ${v1.arch}`);
  const v2 = runOn({ "backend/index.js": `const u = arch === "arm64" ? "tool-aarch64" : "tool-x86_64";` });
  assert(v2.arch.length === 2, `ambas archs esperadas, got ${v2.arch}`);
  ok("arch acotada solo con señal unilateral");
}

// 6. ignora node_modules y archivos no-fuente
{
  const v = runOn({
    "backend/index.js": `await ctx.server.exec("uptime");`,
    "backend/node_modules/dep/index.js": `exec("apt-get install evil");`,
    "README.md": "apt-get install algo",
  });
  assert(v.baselineUsed === true, "node_modules/README no deben contar");
  ok("node_modules y no-fuente ignorados");
}

console.log(`\nos-compat-derive: ${n} smokes OK`);
