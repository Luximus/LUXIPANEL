// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — cloudflare.service orchestration: the token-presence short
 * circuit in `testToken`, the `pointsToServer` annotation on DNS listings, and
 * the fail-safe server-IP probe (which must NEVER throw).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./cloudflare-config.service.js", () => ({
  cloudflareConfigService: {
    getConfig: vi.fn(),
    getToken: vi.fn(),
  },
}));
vi.mock("./cloudflare-api.service.js", () => ({
  cloudflareApiService: {
    verifyToken: vi.fn(),
    listDnsRecords: vi.fn(),
  },
}));

import { cloudflareService, getServerPublicIp } from "./cloudflare.service.js";
import { cloudflareConfigService } from "./cloudflare-config.service.js";
import { cloudflareApiService } from "./cloudflare-api.service.js";
import type { Executor } from "../../../shared/executor/index.js";

const cfg = vi.mocked(cloudflareConfigService);
const api = vi.mocked(cloudflareApiService);

function execWith(stdout: string, opts: { throws?: boolean } = {}): Executor {
  const exec = vi.fn(async () => {
    if (opts.throws) throw new Error("ssh down");
    return { stdout, stderr: "", exitCode: 0 };
  });
  return { exec, target: { id: "t1", name: "t1" } } as unknown as Executor;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("cloudflareService.testToken", () => {
  it("short-circuits to invalid/status:0 when no token is stored (never calls the API)", async () => {
    cfg.getConfig.mockResolvedValue({ tokenSet: false, tokenPreview: "" });

    const result = await cloudflareService.testToken();

    expect(result).toEqual({
      valid: false,
      status: 0,
      message: "No hay un token de API de Cloudflare configurado",
    });
    expect(cfg.getToken).not.toHaveBeenCalled();
    expect(api.verifyToken).not.toHaveBeenCalled();
  });

  it("verifies the stored token through the API when one is present", async () => {
    cfg.getConfig.mockResolvedValue({ tokenSet: true, tokenPreview: "abcd…wxyz" });
    cfg.getToken.mockResolvedValue("the-token");
    api.verifyToken.mockResolvedValue({ valid: true, status: 200, message: "ok" });

    const result = await cloudflareService.testToken();

    expect(api.verifyToken).toHaveBeenCalledWith("the-token");
    expect(result.valid).toBe(true);
  });
});

describe("cloudflareService.listDnsRecords — pointsToServer annotation", () => {
  it("marks records whose content equals the probed server IP", async () => {
    cfg.getToken.mockResolvedValue("tok");
    api.listDnsRecords.mockResolvedValue([
      { id: "a", type: "A", name: "root", content: "203.0.113.7", ttl: 1, proxied: false },
      { id: "b", type: "A", name: "other", content: "198.51.100.9", ttl: 1, proxied: false },
    ]);

    const { records, serverIp } = await cloudflareService.listDnsRecords(
      execWith("203.0.113.7\n"),
      "z".repeat(32),
    );

    expect(serverIp).toBe("203.0.113.7");
    expect(records.find((r) => r.id === "a")?.pointsToServer).toBe(true);
    expect(records.find((r) => r.id === "b")?.pointsToServer).toBe(false);
  });

  it("annotates every record as pointsToServer:false when the probe yields no IP", async () => {
    cfg.getToken.mockResolvedValue("tok");
    api.listDnsRecords.mockResolvedValue([
      { id: "a", type: "A", name: "root", content: "203.0.113.7", ttl: 1, proxied: false },
    ]);

    const { records, serverIp } = await cloudflareService.listDnsRecords(
      execWith("garbage-not-an-ip\n"),
      "z".repeat(32),
    );

    expect(serverIp).toBeNull();
    expect(records[0]?.pointsToServer).toBe(false);
  });
});

describe("getServerPublicIp — fail-safe probe", () => {
  it("returns the first valid IP line", async () => {
    expect(await getServerPublicIp(execWith("  203.0.113.7  \n"))).toBe("203.0.113.7");
  });

  it("returns null for an invalid probe output", async () => {
    expect(await getServerPublicIp(execWith("nope"))).toBeNull();
  });

  it("returns null (never throws) when the executor throws", async () => {
    expect(await getServerPublicIp(execWith("", { throws: true }))).toBeNull();
  });
});
