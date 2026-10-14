// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { proxySchema, nginxUpstreamServerSchema } from "./nginx.model.js";

describe("nginxUpstreamServerSchema", () => {
  const valid = [
    "127.0.0.1",
    "127.0.0.1:3000",
    "app.internal",
    "web-1.example.com",
    "[::1]:8080",
    "[fe80::1]:9000",
    "unix:/var/run/php-fpm.sock",
    "unix:/run/foo.sock",
    "10.0.0.1:65535",
  ];
  for (const v of valid) {
    it(`accepts: ${v}`, () => {
      expect(() => nginxUpstreamServerSchema.parse(v)).not.toThrow();
    });
  }

  const malicious = [
    "127.0.0.1; } location /x { root /etc; #",
    "127.0.0.1 ; rm -rf /",
    "127.0.0.1\nlocation",
    "127.0.0.1 # comment",
    "127.0.0.1 { foo }",
    "127.0.0.1 bad space",
    "127.0.0.1:99999",  // port out of range
    "http://1.2.3.4",   // scheme not allowed for `server`
  ];
  for (const v of malicious) {
    it(`rejects: ${JSON.stringify(v)}`, () => {
      expect(() => nginxUpstreamServerSchema.parse(v)).toThrow();
    });
  }
});

describe("proxySchema", () => {
  it("acepta un upstream válido y propaga server al shape final", () => {
    const cfg = proxySchema.parse({
      domain: "example.com",
      upstreams: [{ server: "10.0.0.1:3000", weight: 5 }],
    });
    expect(cfg.upstreams).toHaveLength(1);
    expect(cfg.upstreams[0]!.server).toBe("10.0.0.1:3000");
    expect(cfg.upstreams[0]!.weight).toBe(5);
  });

  it("rechaza un upstream malicioso en `server`", () => {
    expect(() =>
      proxySchema.parse({
        domain: "example.com",
        upstreams: [{ server: "127.0.0.1; } location /x { root /etc; #" }],
      }),
    ).toThrow();
  });
});