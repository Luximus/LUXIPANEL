import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { normalizeProxyHeaders, trustedClientIp } from "./trusted-proxy.js";

const secret = "security-test-proxy-key-with-32-characters";
function request(peer: string, headers: Record<string, string> = {}) {
  return { socket: { remoteAddress: peer }, headers } as Request;
}
afterEach(() => vi.unstubAllEnvs());
describe("ingress client IP attestation", () => {
  it("rejects loopback header spoofing without a secret", () => {
    vi.stubEnv("LUXIPANEL_PROXY_SECRET", secret);
    expect(trustedClientIp(request("127.0.0.1", { "cf-connecting-ip": "8.8.8.8", "x-luxipanel-client-ip": "8.8.8.8" }))).toBeNull();
  });
  it("rejects an incorrect secret, non-IP values and remote peers", () => {
    vi.stubEnv("LUXIPANEL_PROXY_SECRET", secret);
    const headers = { "x-luxipanel-proxy-secret": secret, "x-luxipanel-client-ip": "8.8.8.8" };
    expect(trustedClientIp(request("192.0.2.1", headers))).toBeNull();
    expect(trustedClientIp(request("127.0.0.1", { ...headers, "x-luxipanel-proxy-secret": "x".repeat(secret.length) }))).toBeNull();
    expect(trustedClientIp(request("127.0.0.1", { ...headers, "x-luxipanel-client-ip": "8.8.8.8, 9.9.9.9" }))).toBeNull();
  });
  it("accepts authenticated local ingress for IPv4 and IPv6", () => {
    vi.stubEnv("LUXIPANEL_PROXY_SECRET", secret);
    for (const ip of ["8.8.8.8", "2001:db8::123"])
      expect(trustedClientIp(request("::ffff:127.0.0.1", { "x-luxipanel-proxy-secret": secret, "x-luxipanel-client-ip": ip }))).toBe(ip);
  });
  it("discards unverified forwarding headers before request IP and origin are read", () => {
    const req = request("127.0.0.1", { "x-forwarded-for": "8.8.8.8", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https", "cf-connecting-ip": "8.8.8.8" });
    normalizeProxyHeaders(req, {} as never, vi.fn());
    expect(req.headers).toEqual({});
  });
  it("overwrites a spoofed forwarding chain with the attested client", () => {
    vi.stubEnv("LUXIPANEL_PROXY_SECRET", secret);
    const req = request("127.0.0.1", { "x-luxipanel-proxy-secret": secret, "x-luxipanel-client-ip": "8.8.8.8", "x-forwarded-for": "evil", "cf-connecting-ip": "evil" });
    normalizeProxyHeaders(req, {} as never, vi.fn());
    expect(req.headers["x-forwarded-for"]).toBe("8.8.8.8");
    expect(req.headers["cf-connecting-ip"]).toBe("8.8.8.8");
  });
});
