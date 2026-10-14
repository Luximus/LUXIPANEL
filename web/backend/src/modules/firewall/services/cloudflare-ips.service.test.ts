// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests for cloudflareIpsService.fetchRanges — the strict
 * CIDR validation + suspect-response guard are pure parsing logic and must not
 * change. `fetch` is mocked; no network is touched.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { cloudflareIpsService } from "./cloudflare-ips.service.js";
import { AppError } from "../../../shared/errors/index.js";

// 15 real-shaped IPv4 CIDRs (Cloudflare publishes ~15).
const V4 = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
].join("\n");

const V6 = ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32"].join("\n");

function mockFetch(map: Record<string, { ok: boolean; status?: number; body?: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const entry = map[url.includes("v4") ? "v4" : "v6"]!;
      return {
        ok: entry.ok,
        status: entry.status ?? 200,
        text: async () => entry.body ?? "",
      } as unknown as Response;
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("cloudflareIpsService.fetchRanges (characterization)", () => {
  it("returns validated v4 + v6 ranges", async () => {
    mockFetch({ v4: { ok: true, body: V4 }, v6: { ok: true, body: V6 } });
    const ranges = await cloudflareIpsService.fetchRanges();
    expect(ranges.v4).toHaveLength(15);
    expect(ranges.v6).toEqual(["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32"]);
  });

  it("silently discards lines that fail the strict CIDR regex", async () => {
    const dirty = V4 + "\n999.1.1.1/33\nnot-a-cidr\n  \n10.0.0.0/8";
    mockFetch({ v4: { ok: true, body: dirty }, v6: { ok: true, body: V6 } });
    const ranges = await cloudflareIpsService.fetchRanges();
    // 15 valid CF ranges + the well-formed 10.0.0.0/8 = 16; junk dropped.
    expect(ranges.v4).toContain("10.0.0.0/8");
    expect(ranges.v4).not.toContain("999.1.1.1/33");
    expect(ranges.v4).not.toContain("not-a-cidr");
    expect(ranges.v4).toHaveLength(16);
  });

  it("throws CLOUDFLARE_IPS_SUSPECT when fewer than 10 valid IPv4 ranges survive", async () => {
    mockFetch({ v4: { ok: true, body: "173.245.48.0/20\n103.21.244.0/22" }, v6: { ok: true, body: V6 } });
    await expect(cloudflareIpsService.fetchRanges()).rejects.toMatchObject({
      code: "CLOUDFLARE_IPS_SUSPECT",
      statusCode: 502,
    });
  });

  it("throws CLOUDFLARE_IPS_FETCH_FAILED on a non-2xx response", async () => {
    mockFetch({ v4: { ok: false, status: 503, body: "" }, v6: { ok: true, body: V6 } });
    await expect(cloudflareIpsService.fetchRanges()).rejects.toBeInstanceOf(AppError);
  });
});
