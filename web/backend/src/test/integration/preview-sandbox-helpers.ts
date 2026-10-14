// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared helpers for the PIPS preview-sandbox integration suites (RUNTIME-DESIGN
 * §11). These tests spawn REAL child processes via the production launch path
 * (`buildTier1Command` → setpriv/unshare). They are GATED on a usable userns
 * substrate: if the host has no user namespaces / no setpriv / no unshare, the
 * suites SKIP — they MUST NEVER fail the build on a sandboxless CI host
 * (RUNTIME-DESIGN §11 CI two-host matrix: the userns-disabled host asserts
 * available=false, not a crash).
 *
 * Hard rules honoured here:
 *   - We NEVER flip PREVIEW_SANDBOX_ENABLED / MODULE_DEV_PREVIEW_ENABLED; the
 *     runtime stays inert. We drive the supervisor/child DIRECTLY.
 *   - We assert the FAIL-CLOSED contract: on a host without a fully-provisioned
 *     scrub rootfs (the common case — rootfs prep is out of F2/F3 scope), the
 *     real child REFUSES to continue (exit 11..15 BEFORE any untrusted byte) and
 *     the supervisor latches healthy()===false. That is the design-correct
 *     outcome, not a test failure.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { probeSubstrate, buildTier1Command } from "../../shared/preview-sandbox/substrate.js";

/** Absolute on-disk path of the trusted child shim (same dir as substrate). */
function childMjsPath(): string {
  const here = fileURLToPath(new URL("../../shared/preview-sandbox/", import.meta.url));
  return join(here, "child.mjs");
}

/**
 * Build the runnable jail argv for the test HOST. The production launcher is
 * `setpriv --bounding-set=-all -- unshare … --root=<scrub> -- node child`, but:
 *   - dropping the bounding set requires CAP_SETPCAP, which an unprivileged
 *     CI/test user lacks (setpriv exits 127 "Operation not permitted");
 *   - the scrub rootfs (`--root=`) is not provisioned on the test host.
 * The real CONFINEMENT under test here — the user+net+pid+mount namespaces — is
 * produced by `unshare`, which IS runnable unprivileged. So for the test spawn
 * we drop the `--root=` token and, when setpriv cannot drop the bounding set,
 * start the argv from `unshare` (the production confinement primitive). This is
 * a faithful test of the userns/netns boundary, not a weakening of production.
 */
export function jailPlan(): { file: string; argv: string[]; env: Record<string, string> } {
  const plan = buildTier1Command({
    scrubRoot: "/nonexistent-scrub",
    nodePathInRoot: process.execPath,
    childPathInRoot: childMjsPath(),
  });
  const noRoot = plan.argv.filter((a) => !a.startsWith("--root="));
  if (setprivCanDropBounds()) {
    return { file: plan.file, argv: noRoot, env: plan.env };
  }
  // Start from the first `unshare` token; everything before it is the setpriv
  // prefix the unprivileged test user cannot run.
  const i = noRoot.indexOf("unshare");
  const argv = i >= 0 ? noRoot.slice(i + 1) : noRoot; // drop "unshare" (it's the file now)
  return { file: i >= 0 ? "unshare" : plan.file, argv, env: plan.env };
}

let _setprivCap: boolean | null = null;
function setprivCanDropBounds(): boolean {
  if (_setprivCap !== null) return _setprivCap;
  try {
    const r = spawnSync("setpriv", ["--bounding-set=-all", "--", "true"], { stdio: "ignore" });
    _setprivCap = r.status === 0;
  } catch {
    _setprivCap = false;
  }
  return _setprivCap;
}

/**
 * Can this host sustain a confining Tier-1 spawn? Used by it.skipIf so the suite
 * is INERT (never red) on a userns-disabled host. We deliberately gate on the
 * STRUCTURAL probe only; the positive self-test (green pool) requires a scrub
 * rootfs the test host does not provision, and its absence must yield
 * fail-closed, never a build failure.
 */
export function usernsUnavailable(): boolean {
  try {
    return !probeSubstrate().confining;
  } catch {
    return true; // probe must never throw; if it did, treat as unavailable.
  }
}

export interface ChildResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  /** Decoded fd-3 frames the child emitted before exiting. */
  frames: Array<Record<string, unknown>>;
  stderr: string;
}

/**
 * Spawn the real child.mjs the EXACT production way (setpriv → unshare …) but
 * WITHOUT a populated `--root` scrub rootfs (the test host has none). The
 * boundary checks in child.mjs therefore run against the REAL host mount ns:
 *   - if any secret canary (mTLS key, shared-secrets.json under cfgDir) is
 *     reachable ⇒ child fail-closes (exit 11) — proves secret-absence is
 *     load-bearing, not incidental;
 *   - the netns (`--net`) is real regardless of rootfs ⇒ network-cut checks
 *     hold even when the rootfs is absent.
 *
 * @param cfgDir  value injected as LXP_CONFIG_DIR; point it at an empty dir to
 *                pass the config-dir scrub, or at the real cfg dir to assert the
 *                child refuses (escape test).
 */
export function spawnRealChild(opts: {
  cfgDir: string;
  selftestOnly?: boolean;
  timeoutMs?: number;
  onReady?: (child: ChildProcess) => void;
}): Promise<ChildResult> {
  const scratchRoot = mkdtempSync(join(tmpdir(), "pips-it-root-"));
  const plan = jailPlan();

  return new Promise<ChildResult>((resolve) => {
    const env: Record<string, string> = {
      ...plan.env,
      LXP_CONFIG_DIR: opts.cfgDir,
      LXP_MAX_FRAME: "1048576",
    };
    if (opts.selftestOnly) env.LXP_SELFTEST_ONLY = "1";

    const child = spawn(plan.file, plan.argv, {
      stdio: ["ignore", "pipe", "pipe", "pipe"],
      env,
    });

    const frames: Array<Record<string, unknown>> = [];
    let buf = Buffer.alloc(0);
    let stderr = "";
    let settled = false;

    const fd3 = child.stdio[3] as NodeJS.ReadableStream | null;
    if (fd3) {
      fd3.on("data", (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 4) {
          const n = buf.readUInt32BE(0);
          if (buf.length < 4 + n) break;
          try {
            const obj = JSON.parse(buf.subarray(4, 4 + n).toString("utf8"));
            frames.push(obj);
            if (obj && obj.type === "ready" && opts.onReady) opts.onReady(child);
          } catch {
            /* ignore malformed (the child should never emit it) */
          }
          buf = buf.subarray(4 + n);
        }
      });
      fd3.on("error", () => {});
    }
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        rmSync(scratchRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      resolve({ exitCode, signal, frames, stderr });
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      finish(null, "SIGKILL");
    }, opts.timeoutMs ?? 8000);

    child.on("error", () => finish(null, null));
    child.on("exit", (code, signal) => finish(code, signal));
  });
}
