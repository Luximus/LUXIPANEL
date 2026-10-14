// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi, beforeEach } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { assertPublicUrl, isBlockedAddress, SsrfBlockedError } from "./ssrf-guard.js";

beforeEach(() => {
  lookupMock.mockReset();
});

describe("isBlockedAddress", () => {
  it("blocks IPv4 loopback / private / link-local / reserved", () => {
    for (const ip of [
      "127.0.0.1",
      "127.10.20.30",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "100.64.0.1",
      "224.0.0.1",
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("blocks IPv6 loopback, unique-local, link-local and IPv4-mapped private", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6 and IPv4-mapped public", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("fails closed on non-IP input", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("ftp://example.com/x")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects http when httpsOnly is set", async () => {
    await expect(assertPublicUrl("http://example.com", { httpsOnly: true })).rejects.toBeInstanceOf(
      SsrfBlockedError,
    );
  });

  it("rejects an IP-literal host in a private range without DNS", async () => {
    await expect(assertPublicUrl("http://127.0.0.1:9000/hook")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertPublicUrl("http://[::1]/hook")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects a hostname that resolves to loopback (DNS rebinding)", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertPublicUrl("https://evil.example.com/x")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects when ANY resolved address is private", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.1.2.3", family: 4 },
    ]);
    await expect(assertPublicUrl("https://mixed.example.com/x")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a host that cannot be resolved", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicUrl("https://nope.invalid/x")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("accepts a public https URL and returns the parsed URL", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const url = await assertPublicUrl("https://example.com/webhook?a=1", { httpsOnly: true });
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe("example.com");
  });

  it("never leaks the raw URL in the error message", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    try {
      await assertPublicUrl("https://evil.example.com/x?key=SECRET");
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain("SECRET");
    }
  });
});
