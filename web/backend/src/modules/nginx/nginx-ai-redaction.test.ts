// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { diagnosticDirectives, redactNginxDiagnostic } from "./nginx-ai-redaction.js";

describe("NGINX assistant diagnostics", () => {
  it("removes credentials, URL parameters and client IPs from log excerpts", () => {
    const input = '10.2.3.4 GET /login?token=secret&next=/ HTTP/1.1\nCookie: session=secret; other=hidden\nAuthorization: Bearer secret';
    const output = redactNginxDiagnostic(input);
    expect(output).not.toMatch(/10\.2\.3\.4|secret|other=hidden/);
    expect(output).toContain("?[parámetros ocultos]");
  });

  it("only exposes allowlisted site directives", () => {
    const output = diagnosticDirectives('server_name example.com;\nproxy_set_header Authorization "secret";\nroot /var/www/example.com;');
    expect(output).toEqual(["server_name example.com;", "root /var/www/example.com;"]);
  });
});
