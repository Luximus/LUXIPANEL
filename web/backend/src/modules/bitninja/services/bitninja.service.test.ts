// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization — the BitNinja agent wrapper: status detection + defensive
 * module parsing (JSON and text fallback), license-info validity heuristic, and
 * the license-key safety gate that must reject unsafe tokens BEFORE any
 * privileged `sudoShell` runs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../shared/system/index.js", () => ({
  sudoShell: vi.fn(async () => ({ ok: true, exitCode: 0, output: "done", code: undefined })),
}));

import { handlerExecutor, type MockExecHandler } from "../../../shared/executor/__fixtures__/mock-executor.js";
import { bitninjaService } from "./bitninja.service.js";
import { sudoShell } from "../../../shared/system/index.js";

const mockedSudo = vi.mocked(sudoShell);

const makeExecutor = (handler: MockExecHandler) => handlerExecutor(handler, "box") as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStatus", () => {
  it("reports not installed when bitninjacli is absent (no further probes)", async () => {
    const ex = makeExecutor((cmd) => {
      if (cmd.includes("command -v bitninjacli")) return { stdout: "no" };
      return { stdout: "" };
    });
    const status = await bitninjaService.getStatus(ex);
    expect(status).toEqual({ installed: false, running: false, licenseValid: false, version: null, components: [], raw: "" });
  });

  it("parses a JSON module list, version, running unit and a valid license", async () => {
    const ex = makeExecutor((cmd) => {
      if (cmd.includes("command -v bitninjacli")) return { stdout: "yes" };
      if (cmd.includes("--status-all")) {
        return { stdout: '[{"name":"WAFManager","status":"running"},{"name":"DosDetection","status":"off"}]' };
      }
      if (cmd.includes("--version")) return { stdout: "BitNinja 3.11.6" };
      if (cmd.includes("systemctl is-active bitninja")) return { stdout: "active" };
      if (cmd.includes("--licenseinfo")) return { stdout: "License OK, valid until 2030" };
      return { stdout: "" };
    });
    const status = await bitninjaService.getStatus(ex);
    expect(status.installed).toBe(true);
    expect(status.running).toBe(true);
    expect(status.version).toBe("BitNinja 3.11.6");
    expect(status.licenseValid).toBe(true);
    expect(status.components).toEqual([
      { name: "WAFManager", active: true },
      { name: "DosDetection", active: false },
    ]);
  });

  it("flags the license invalid when licenseinfo says so", async () => {
    const ex = makeExecutor((cmd) => {
      if (cmd.includes("command -v bitninjacli")) return { stdout: "yes" };
      if (cmd.includes("--status-all")) return { stdout: "WAFManager: running" };
      if (cmd.includes("--licenseinfo")) return { stdout: "no license found" };
      return { stdout: "" };
    });
    const status = await bitninjaService.getStatus(ex);
    expect(status.licenseValid).toBe(false);
  });

  it("falls back to the text parser for non-JSON status output (needs a ':' or tab separator)", async () => {
    const ex = makeExecutor((cmd) => {
      if (cmd.includes("command -v bitninjacli")) return { stdout: "yes" };
      // The text parser requires a ':' or tab between name and state; a
      // space-only line is intentionally NOT matched.
      if (cmd.includes("--status-all")) return { stdout: "WAFManager: running\nMalwareDetection: active\nDosDetection: off\n" };
      return { stdout: "" };
    });
    const status = await bitninjaService.getStatus(ex);
    expect(status.components).toEqual([
      { name: "WAFManager", active: true },
      { name: "MalwareDetection", active: true },
      { name: "DosDetection", active: false },
    ]);
    // A parseable module list means the agent is up even if the unit probe is empty.
    expect(status.running).toBe(true);
  });
});

describe("install / setLicense — license-key safety gate", () => {
  it("install with no key returns an error WITHOUT running sudo", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    const res = await bitninjaService.install(ex, { licenseKey: "" });
    expect(res.ok).toBe(false);
    expect(mockedSudo).not.toHaveBeenCalled();
  });

  it("install rejects an unsafe license token (shell metachars) without running sudo", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    const res = await bitninjaService.install(ex, { licenseKey: "bad; rm -rf /" });
    expect(res.ok).toBe(false);
    expect(mockedSudo).not.toHaveBeenCalled();
  });

  it("install with a safe key runs sudoShell and maps the result", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    const res = await bitninjaService.install(ex, { licenseKey: "ABC-123_key" });
    expect(mockedSudo).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: true, exitCode: 0, output: "done", code: undefined });
  });

  it("setLicense rejects an unsafe key without running sudo", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    const res = await bitninjaService.setLicense(ex, { licenseKey: "$(evil)" });
    expect(res.ok).toBe(false);
    expect(mockedSudo).not.toHaveBeenCalled();
  });
});

describe("setService / setComponent", () => {
  it("setService runs sudoShell for the requested action", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    await bitninjaService.setService(ex, "restart", {});
    expect(mockedSudo).toHaveBeenCalledTimes(1);
  });

  it("setComponent rejects an unsafe component name without running sudo", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    const res = await bitninjaService.setComponent(ex, "WAF Manager; ls", true, {});
    expect(res.ok).toBe(false);
    expect(mockedSudo).not.toHaveBeenCalled();
  });

  it("setComponent with a safe name runs sudoShell", async () => {
    const ex = makeExecutor(() => ({ stdout: "" }));
    await bitninjaService.setComponent(ex, "WAFManager", false, {});
    expect(mockedSudo).toHaveBeenCalledTimes(1);
  });
});
