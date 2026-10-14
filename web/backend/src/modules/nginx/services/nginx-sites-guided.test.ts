// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { nginxSitesService } from "./nginx-sites.service.js";

describe("guided NGINX site editing", () => {
  it.each(["static", "php", "proxy"] as const)("round-trips a generated %s site with HTTPS", (kind) => {
    const form = {
      kind,
      domain: "example.com",
      aliases: ["www.example.com"],
      root: "/var/www/example.com",
      phpSocket: "unix:/run/php/php-fpm.sock",
      proxyPass: "http://127.0.0.1:3000",
      websocket: kind === "proxy",
      forceHttps: true,
    };
    const config = nginxSitesService.generateConfig(form);
    const parsed = nginxSitesService.parseManagedForm(config);
    expect(parsed).not.toBeNull();
    expect(parsed?.kind).toBe(kind);
    expect(nginxSitesService.generateConfig(parsed!)).toBe(config);
  });

  it("refuses guided editing when custom directives or TLS blocks exist", () => {
    const config = nginxSitesService.generateConfig({
      kind: "static", domain: "example.com", aliases: [], root: "/var/www/example.com",
    });
    expect(nginxSitesService.parseManagedForm(config.replace("\n}\n", "\n    add_header X-Custom yes;\n}\n"))).toBeNull();
    expect(nginxSitesService.parseManagedForm(config + "\nserver { listen 443 ssl; }\n")).toBeNull();
  });
});
