// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory nginx site store backing the mocked nginxSitesService.
const store: Record<string, string> = {};
let sites: any[] = [];

vi.mock("./nginx-sites.service.js", () => ({
  nginxSitesService: {
    listSites: vi.fn(async () => sites),
    listSitesWithContent: vi.fn(async () =>
      sites.map((s: any) => ({ ...s, content: store[s.name] ?? "" })),
    ),
    readRaw: vi.fn(async (_e: unknown, name: string) => store[name] ?? ""),
    writeSite: vi.fn(async (_e: unknown, name: string, content: string) => {
      // Mimic the real contract: reject obviously broken brace balance.
      const open = (content.match(/\{/g) || []).length;
      const close = (content.match(/\}/g) || []).length;
      if (open !== close) throw new Error(`unbalanced braces (${open} vs ${close})`);
      store[name] = content;
    }),
  },
}));

const { nginxBasicAuthService } = await import("./nginx-basic-auth.service.js");

const STATIC_SITE = `server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
`;

const PHP_SITE = `server {
    listen 80;
    server_name shop.example.com;
    root /var/www/shop;
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
    }
}
`;

const ex = { target: { id: "test", name: "test" } } as any;

describe("nginxBasicAuthService", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it("injects auth_basic into a static site for a subfolder", async () => {
    store["site"] = STATIC_SITE;
    sites = [{ name: "site", enabled: true, root: "/var/www/html", domains: ["example.com"], proxyPass: null }];

    const res = await nginxBasicAuthService.enableForDir(ex, "/var/www/html/private", "Zona", "/var/www/html/private/.htpasswd");
    expect(res.enforced).toBe(true);
    expect(res.url).toBe("/private/");

    const out = store["site"]!;
    expect(out).toContain("location ^~ /private/ {");
    expect(out).toContain('auth_basic "Zona";');
    expect(out).toContain("auth_basic_user_file /var/www/html/private/.htpasswd;");
    // No PHP handler in a static site → no nested \.php$ block.
    expect(out).not.toContain("\\.php$");
    // Original content preserved.
    expect(out).toContain("try_files $uri $uri/ =404;");
  });

  it("nests the PHP handler inside the protected location for PHP sites", async () => {
    store["site"] = PHP_SITE;
    sites = [{ name: "site", enabled: true, root: "/var/www/shop", domains: ["shop.example.com"], proxyPass: null }];

    const res = await nginxBasicAuthService.enableForDir(ex, "/var/www/shop/admin", "Admin", "/var/www/shop/admin/.htpasswd");
    expect(res.enforced).toBe(true);

    const out = store["site"]!;
    // Protected prefix location with a nested php location carrying fastcgi.
    expect(out).toContain("location ^~ /admin/ {");
    const block = out.slice(out.indexOf("location ^~ /admin/ {"));
    expect(block).toContain("location ~ \\.php$ {");
    expect(block).toContain("fastcgi_pass unix:/run/php/php8.2-fpm.sock;");
    expect(block).toContain("include snippets/fastcgi-php.conf;");
  });

  it("is idempotent and round-trips (enable → disable restores原 structure)", async () => {
    store["site"] = STATIC_SITE;
    sites = [{ name: "site", enabled: true, root: "/var/www/html", domains: ["example.com"], proxyPass: null }];

    await nginxBasicAuthService.enableForDir(ex, "/var/www/html/private", "Zona", "/var/www/html/private/.htpasswd");
    // Enabling twice must not duplicate the block.
    await nginxBasicAuthService.enableForDir(ex, "/var/www/html/private", "Zona", "/var/www/html/private/.htpasswd");
    expect((store["site"]!.match(/location \^~ \/private\/ \{/g) || []).length).toBe(1);

    const st = await nginxBasicAuthService.statusForDir(ex, "/var/www/html/private");
    expect(st.enforced).toBe(true);

    await nginxBasicAuthService.disableForDir(ex, "/var/www/html/private");
    expect(store["site"]).not.toContain("LUXIPANEL dir-privacy");
    expect(store["site"]).not.toContain("auth_basic");
    const st2 = await nginxBasicAuthService.statusForDir(ex, "/var/www/html/private");
    expect(st2.enforced).toBe(false);
  });

  it("reports no-site when the folder is not under any web root", async () => {
    sites = [{ name: "site", enabled: true, root: "/var/www/html", domains: ["example.com"], proxyPass: null }];
    const res = await nginxBasicAuthService.enableForDir(ex, "/home/jose/secret", "X", "/home/jose/secret/.htpasswd");
    expect(res.enforced).toBe(false);
    expect(res.reason).toBe("no-site");
  });
});
