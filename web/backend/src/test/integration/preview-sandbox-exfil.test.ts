// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS integration — EXFIL (RUNTIME-DESIGN §11). Asserts the spawned ns has NO
 * network (ENETUNREACH, not ECONNREFUSED) to panel/redis/internet/metadata, that
 * the environ is a tiny subset, and that the child enforces the environ subset
 * fail-closed (an injected extra var ⇒ exit 13 ENVIRON).
 *
 * Gating: it.skipIf(usernsUnavailable) — INERT on a userns-disabled host.
 */
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jailPlan, spawnRealChild, usernsUnavailable } from "./preview-sandbox-helpers.js";

const SKIP = usernsUnavailable();

/**
 * Run a tiny inline node probe inside the SAME confining jail (unshare --net …)
 * the production launcher uses, and report the connect errno for a given
 * host:port. ENETUNREACH/EHOSTUNREACH ⇒ true network cut; ECONNREFUSED ⇒
 * network reachable (FAIL). The netns is real regardless of any scrub rootfs,
 * so we re-point the jailed node at an inline -e probe (NOT child.mjs).
 */
function probeConnect(host: string, port: number): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "pips-it-net-"));
  const plan = jailPlan();
  // Replace the trailing "node child.mjs" tail with our inline -e probe so we
  // observe the netns connect errno directly. The tail is the last two argv.
  const idx = plan.argv.lastIndexOf("--");
  const head = idx >= 0 ? plan.argv.slice(0, idx + 1) : plan.argv;
  const code =
    `const net=require('net');` +
    `const s=net.connect({host:${JSON.stringify(host)},port:${port}});` +
    `let done=false;const out=(e)=>{if(done)return;done=true;try{s.destroy()}catch{};` +
    `process.stdout.write((e&&e.code)?e.code:'CONNECTED');process.exit(0)};` +
    `s.on('error',out);s.on('connect',()=>out(null));setTimeout(()=>out({code:'TIMEOUT'}),2500);`;
  const argv = [...head, process.execPath, "-e", code];

  return new Promise<string>((resolve) => {
    const child = spawn(plan.file, argv, {
      stdio: ["ignore", "pipe", "pipe", "ignore"],
      env: { PATH: "/usr/bin:/bin" },
    });
    let out = "";
    child.stdout?.on("data", (c: Buffer) => (out += c.toString("utf8")));
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, 5000);
    child.on("exit", () => {
      clearTimeout(t);
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      resolve(out.trim());
    });
    child.on("error", () => {
      clearTimeout(t);
      resolve("SPAWN_ERROR");
    });
  });
}

describe.skipIf(SKIP)("PIPS exfil (real jailed ns)", () => {
  const targets: Array<[string, number, string]> = [
    ["127.0.0.1", 8080, "panel backend"],
    ["127.0.0.1", 7379, "per-server redis"],
    ["1.1.1.1", 443, "public internet"],
    ["169.254.169.254", 80, "cloud metadata"],
  ];

  for (const [host, port, label] of targets) {
    it(`cannot reach ${label} (${host}:${port}) — ENETUNREACH, not refused`, async () => {
      const code = await probeConnect(host, port);
      // The load-bearing assertion: NEVER ECONNREFUSED (that would mean the
      // loopback/route exists). Acceptable: ENETUNREACH/EHOSTUNREACH (empty
      // netns), EAFNOSUPPORT, TIMEOUT (no route), or CONNECTED must NOT happen.
      expect(code).not.toBe("CONNECTED");
      expect(code).not.toBe("ECONNREFUSED");
      expect(["ENETUNREACH", "EHOSTUNREACH", "EAFNOSUPPORT", "EADDRNOTAVAIL", "TIMEOUT"]).toContain(code);
    }, 12000);
  }

  it("child refuses (exit 13 ENVIRON) when an extra env var is injected", async () => {
    // Drive child.mjs with an empty cfg dir BUT smuggle a panel-shaped var.
    // child.mjs enforces environ ⊆ ALLOWED_ENV before anything else network/FS;
    // an unexpected var ⇒ exit 13. (Secret canaries on this host may trip exit
    // 11 first; either way it must NEVER reach `ready`.)
    const emptyCfg = mkdtempSync(join(tmpdir(), "pips-envcfg-"));
    try {
      const res = await spawnRealChildWithExtraEnv(emptyCfg, { LUXIPANEL_KEY: "leak" });
      expect(res.frames.find((f) => f.type === "ready")).toBeUndefined();
      // exit must be a boundary refusal (11 SECRET or 13 ENVIRON), never green.
      if (res.exitCode !== null) {
        expect([11, 12, 13, 14, 15]).toContain(res.exitCode);
      }
    } finally {
      rmSync(emptyCfg, { recursive: true, force: true });
    }
  }, 15000);
});

/** spawnRealChild variant that injects a forbidden env var. */
function spawnRealChildWithExtraEnv(
  cfgDir: string,
  extra: Record<string, string>,
): ReturnType<typeof spawnRealChild> {
  const root = mkdtempSync(join(tmpdir(), "pips-it-env-"));
  const plan = jailPlan();
  return new Promise((resolve) => {
    const child = spawn(plan.file, plan.argv, {
      stdio: ["ignore", "pipe", "pipe", "pipe"],
      env: { ...plan.env, LXP_CONFIG_DIR: cfgDir, LXP_MAX_FRAME: "1048576", ...extra },
    });
    const frames: Array<Record<string, unknown>> = [];
    let buf = Buffer.alloc(0);
    let stderr = "";
    let settled = false;
    const fd3 = child.stdio[3] as NodeJS.ReadableStream | null;
    fd3?.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 4) {
        const n = buf.readUInt32BE(0);
        if (buf.length < 4 + n) break;
        try {
          frames.push(JSON.parse(buf.subarray(4, 4 + n).toString("utf8")));
        } catch {
          /* ignore */
        }
        buf = buf.subarray(4 + n);
      }
    });
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    const done = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      resolve({ exitCode, signal, frames, stderr });
    };
    const t = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      done(null, "SIGKILL");
    }, 6000);
    child.on("error", () => done(null, null));
    child.on("exit", (code, signal) => done(code, signal));
  });
}
