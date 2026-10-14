// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep the token lookup and GraphQL/API layers out of the way.
vi.mock("./expo-config.service.js", () => ({
  expoConfigService: { getToken: vi.fn(async () => "tok_test") },
}));
vi.mock("./expo-api.service.js", () => ({
  expoApiService: {},
}));
// sudo injection is a no-op in tests: the script body passes through unchanged
// so the executor mock can route on the literal command substrings.
vi.mock("../../../shared/system/sudo-runtime.js", () => ({
  injectSudoIntoShellScript: vi.fn(async (_e: unknown, body: string) => body),
}));

import { classifyDevClientFailure, expoService } from "./expo.service.js";
import type { Executor } from "../../../shared/executor/index.js";

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Build a fake Executor that routes `exec` calls by the literal command
 * substring `startDevClient` emits, consuming per-call queues so a test can
 * script the exact sequence of Metro states / URL polls / log tails.
 */
function makeExecutor(script: {
  isActive?: boolean[];
  expUrl?: string[];
  tail?: string[];
  launchExit?: number;
  residualKills?: number[];
  runtime?: string;
}) {
  const isActiveQ = [...(script.isActive ?? [])];
  const expUrlQ = [...(script.expUrl ?? [])];
  const tailQ = [...(script.tail ?? [])];
  const residualKillsQ = [...(script.residualKills ?? [])];
  const launchExit = script.launchExit ?? 0;
  const state = { launches: 0, cleanups: 0 };
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    if (cmd.includes("<<APPJSON>>")) {
      return { stdout: `<<APPJSON>>\n{}\n<<PKGJSON>>\n{"dependencies":{"expo":"*"}}\n<<RUNTIME>>\n${script.runtime ?? "11"}<<END>>\n`, stderr: "", exitCode: 0 };
    }
    if (cmd.includes("systemctl is-active")) {
      const active = isActiveQ.shift() ?? false;
      return { stdout: active ? "active" : "inactive", stderr: "", exitCode: 0 };
    }
    if (cmd.includes("id -un")) {
      return { stdout: "tester\n/home/tester", stderr: "", exitCode: 0 };
    }
    // Residual reap runs before every attempt (pgrep/pkill of stray Metro/ngrok).
    if (cmd.includes("pkill") || cmd.includes("pgrep")) {
      state.cleanups += 1;
      return { stdout: String(residualKillsQ.shift() ?? 0), stderr: "", exitCode: 0 };
    }
    if (cmd.includes("grep -aoE")) {
      return { stdout: expUrlQ.shift() ?? "", stderr: "", exitCode: 0 };
    }
    if (cmd.includes("tail -n 12")) {
      return { stdout: tailQ.shift() ?? "", stderr: "", exitCode: 0 };
    }
    if (cmd.includes("systemd-run")) {
      state.launches += 1;
      return { stdout: "", stderr: "", exitCode: launchExit };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  });
  const writeFile = vi.fn(async (): Promise<void> => {});
  return { executor: { exec, writeFile } as unknown as Executor, exec, state };
}

const VALID_URL = "exp+myapp://expo-development-client/?url=https%3A%2F%2Fabc.exp.direct";
const TRANSIENT_TAIL =
  "CommandError: TypeError: Cannot read properties of undefined (reading 'body')\n" +
  "Check the Ngrok status page for outages: https://status.ngrok.com/";
const MISSING_TAIL = "CommandError: Install @expo/ngrok@^4.1.0 and try again, or see the docs.";

describe("expoService.devClientStatus — read-only session discovery", () => {
  it("finds an existing tunnel without launching Metro or writing credentials", async () => {
    const { executor, exec, state } = makeExecutor({ isActive: [true], expUrl: [VALID_URL] });
    expect(await expoService.devClientStatus(executor, { path: "/srv/app" })).toEqual({ status: "running", url: VALID_URL });
    expect(state.launches).toBe(0); expect(executor.writeFile).not.toHaveBeenCalled();
    expect(exec.mock.calls.every(([cmd]) => !/systemd-run|fuser|pkill|rm -f/.test(cmd))).toBe(true);
    expect(exec.mock.calls[1]?.[0]).toContain("luxipanel-expo-metro-srv_app.log");
  });
  it("never returns an old log URL after the unit stops", async () => {
    const { executor, exec } = makeExecutor({ isActive: [false], expUrl: [VALID_URL] });
    expect(await expoService.devClientStatus(executor, { path: "/srv/app" })).toEqual({ status: "stopped", url: null });
    expect(exec).toHaveBeenCalledTimes(1);
  });
  it("reports a starting session until its tunnel URL is available", async () => {
    const { executor } = makeExecutor({ isActive: [true], expUrl: [""] });
    expect(await expoService.devClientStatus(executor, { path: "/srv/app" })).toEqual({ status: "starting", url: null });
  });
});

describe("classifyDevClientFailure", () => {
  it("classifies the ngrok API 'body' hiccup as transient (not missing package)", () => {
    expect(classifyDevClientFailure(TRANSIENT_TAIL)).toBe("tunnelTransient");
  });

  it("classifies the ngrok status-page outage hint as transient", () => {
    expect(classifyDevClientFailure("Check the Ngrok status page for outages")).toBe("tunnelTransient");
  });

  it("classifies a genuine missing-package message as ngrokMissing", () => {
    expect(classifyDevClientFailure(MISSING_TAIL)).toBe("ngrokMissing");
    expect(classifyDevClientFailure("@expo/ngrok is not installed")).toBe("ngrokMissing");
  });

  it("falls back to a generic exit for unrelated failures", () => {
    expect(classifyDevClientFailure("Metro error: SyntaxError in index.js")).toBe("exited");
  });
});

describe("expoService.startDevClient — transient ngrok retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not launch Metro when expo is not installed", async () => {
    const { executor, state } = makeExecutor({ runtime: "00" });
    const result = await expoService.startDevClient(executor, { path: "/srv/app" });
    expect(result.messageCode).toBe("expoMissing");
    expect(state.launches).toBe(0);
  });

  it("does not launch Metro when @expo/ngrok is not installed", async () => {
    const { executor, state } = makeExecutor({ runtime: "10" });
    const result = await expoService.startDevClient(executor, { path: "/srv/app" });
    expect(result.messageCode).toBe("ngrokMissing");
    expect(state.launches).toBe(0);
  });

  it("retries a transient ngrok failure and then succeeds", async () => {
    // reuse-check: not active. Attempt 1: no url, unit died with transient tail.
    // Attempt 2 (retry): url appears.
    const { executor, state } = makeExecutor({
      isActive: [false, false],
      expUrl: ["", VALID_URL],
      tail: [TRANSIENT_TAIL],
    });

    const p = expoService.startDevClient(executor, { path: "/srv/app" });
    await vi.advanceTimersByTimeAsync(300_000);
    const res = await p;

    expect(res.messageCode).toBe("started");
    expect(res.url).toBe(VALID_URL);
    // Two launches: the failed attempt + the successful retry.
    expect(state.launches).toBe(2);
    // Residual reap runs before EVERY attempt (including the first).
    expect(state.cleanups).toBe(2);
  });

  it("reaps residuals before every attempt and settles when it kills something", async () => {
    // Attempt 1 fails transient; attempt 2 succeeds. First reap reports 2 killed
    // (residual ngrok) so the launch must still settle + retry to the URL.
    const { executor, state } = makeExecutor({
      isActive: [false, false],
      expUrl: ["", VALID_URL],
      tail: [TRANSIENT_TAIL],
      residualKills: [2, 0],
    });

    const p = expoService.startDevClient(executor, { path: "/srv/app" });
    await vi.advanceTimersByTimeAsync(300_000);
    const res = await p;

    expect(res.url).toBe(VALID_URL);
    expect(state.cleanups).toBe(2);
  });

  it("does NOT retry a missing-package failure and reports exitedBeforeUrlNgrok", async () => {
    const { executor, state } = makeExecutor({
      isActive: [false, false],
      expUrl: [""],
      tail: [MISSING_TAIL],
    });

    const p = expoService.startDevClient(executor, { path: "/srv/app" });
    await vi.advanceTimersByTimeAsync(300_000);
    const res = await p;

    expect(res.messageCode).toBe("exitedBeforeUrlNgrok");
    expect(res.url).toBeNull();
    // Only the first launch — no retry for a non-transient failure.
    expect(state.launches).toBe(1);
  });

  it("retries transient up to 4 total launches, then reports exitedBeforeUrlTunnel", async () => {
    const { executor, state } = makeExecutor({
      isActive: [false, false, false, false, false],
      expUrl: ["", "", "", ""],
      tail: [TRANSIENT_TAIL, TRANSIENT_TAIL, TRANSIENT_TAIL, TRANSIENT_TAIL],
    });

    const p = expoService.startDevClient(executor, { path: "/srv/app" });
    await vi.advanceTimersByTimeAsync(300_000);
    const res = await p;

    expect(res.messageCode).toBe("exitedBeforeUrlTunnel");
    expect(res.url).toBeNull();
    // Max 4 launches, each preceded by a residual reap.
    expect(state.launches).toBe(4);
    expect(state.cleanups).toBe(4);
  });
});
