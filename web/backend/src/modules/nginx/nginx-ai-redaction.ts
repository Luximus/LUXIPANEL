// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Only a bounded, scrubbed diagnostic excerpt may leave the server for AI. */
export function redactNginxDiagnostic(value: string): string {
  return value
    .slice(0, 64_000)
    .replace(/\b(Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n]*/gi, "$1: [oculto]")
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [oculto]")
    .replace(/\?[^\s"']+/g, "?[parámetros ocultos]")
    .replace(/(?:\d{1,3}\.){3}\d{1,3}/g, "[IP]");
}

/** No arbitrary directives or credentials from a vhost reach the model. */
export function diagnosticDirectives(content: string): string[] {
  const allowed = /^\s*(listen|server_name|root|proxy_pass|fastcgi_pass|return|client_max_body_size|proxy_read_timeout)\s+([^;]+);/gim;
  return [...content.matchAll(allowed)].slice(0, 80).map((match) =>
    redactNginxDiagnostic(`${match[1]} ${match[2]};`),
  );
}
