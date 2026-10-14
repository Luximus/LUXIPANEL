// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { RequestOptions } from "node:https";
import { Agent as HttpsAgent, request as httpsRequest } from "node:https";
import { Agent as HttpAgent, request as httpRequest } from "node:http";
import { createPrivateKey } from "node:crypto";
import { URL } from "node:url";

import { env } from "../config/env.js";
import { createModuleLogger } from "./logger/index.js";

const log = createModuleLogger("license-server-tls");

type TlsConfig = {
  cert?: string;
  key?: string;
  ca?: string;
  rejectUnauthorized?: boolean;
};

type JsonResponse<T> = {
  ok?: boolean;
  data?: T;
  [key: string]: unknown;
};

function normalizePem(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  // Values stored as base64-encoded PEM are decoded automatically.
  if (!text.includes("-----BEGIN")) {
    return Buffer.from(text, "base64").toString("utf8");
  }
  return text;
}

export function licenseServerTlsConfig(): TlsConfig {
  const cert = normalizePem(env.LICENSE_SERVER_TLS_CLIENT_CERT_PEM);
  const key = normalizePem(env.LICENSE_SERVER_TLS_CLIENT_KEY_PEM);
  const ca = normalizePem(env.LICENSE_SERVER_TLS_CA_PEM);

  return {
    cert,
    key,
    ca,
    // Always verify LP's server cert against the system trust store: LP serves a
    // PUBLIC cert (via Cloudflare). This is a hard transport invariant (see
    // CLAUDE.md §Transporte). The former LICENSE_SERVER_TLS_REJECT_UNAUTHORIZED
    // toggle was inert — `var || enabled` collapsed to `true` whenever a client
    // cert was present (the normal case) — and misleading, so it was removed.
    rejectUnauthorized: true,
  };
}

// Decide ONCE whether the optional mTLS client cert is usable. A corrupt or
// missing LICENSE_SERVER_TLS_CLIENT_KEY_PEM otherwise throws an opaque
// `ERR_OSSL_UNSUPPORTED` deep inside the https Agent on EVERY call to LP
// (SSO, SSH-key lookup, refresh…), breaking ALL login methods.
//
// mTLS is an OPTIONAL defense-in-depth layer on top of LUXIPANEL_KEY +
// IP allowlist. If the client key can't be loaded we DEGRADE GRACEFULLY:
// connect without a client cert (LP authenticates the call via the shared
// secret + allowlist) and log a single actionable warning — never crash
// every request over a missing/garbled panel cert.
let clientTlsUsable: boolean | null = null;

function useClientCert(tls: TlsConfig): boolean {
  if (clientTlsUsable === null) {
    let reason = "";
    if (!tls.key || !tls.cert) {
      reason = "LICENSE_SERVER_TLS_CLIENT_CERT_PEM/KEY_PEM not configured";
    } else {
      try {
        createPrivateKey(tls.key);
      } catch (err) {
        reason = `LICENSE_SERVER_TLS_CLIENT_KEY_PEM is not a valid private key (${(err as Error).message})`;
      }
    }
    clientTlsUsable = reason === "";
    if (!clientTlsUsable) {
      log.warn(
        { remediation: "Optional: restore a valid base64 PEM in LICENSE_SERVER_TLS_CLIENT_KEY_PEM (must match the luxipanel-backend client cert) to re-enable mTLS. Service auth still uses LUXIPANEL_KEY + IP allowlist." },
        `LP mTLS client cert unusable (${reason}) — connecting WITHOUT a client cert. This requires LUXIPANEL_MTLS_REQUIRED=false on LP-LICENSE-SERVER.`,
      );
    }
  }
  return clientTlsUsable;
}

function requestOptions(method: string, headers: Record<string, string>): RequestOptions {
  const tls = licenseServerTlsConfig();
  const withCert = useClientCert(tls);
  // SERVER verification (is `api.luxisoft.com` genuine) always uses Node's
  // default trust store: LP's public endpoint serves a publicly-trusted
  // cert. The internal `LICENSE_SERVER_TLS_CA_PEM` is NOT for this — it is
  // the CA nginx uses to verify OUR client cert. Passing it as `ca` here
  // would REPLACE the default store and break verification of the public
  // server cert. So never set `ca`; always keep rejectUnauthorized=true.
  //
  // CLIENT identity (mTLS): present cert+key when a valid pair is loaded;
  // degrade without it otherwise (LP then relies on LUXIPANEL_KEY).
  return {
    method,
    headers,
    cert: withCert ? tls.cert : undefined,
    key: withCert ? tls.key : undefined,
    rejectUnauthorized: tls.rejectUnauthorized,
  };
}

/**
 * TLS options for an OUTBOUND WebSocket / raw socket to LP (the agents
 * shell + SFTP streams). MUST mirror {@link requestOptions} exactly:
 *
 *   - present the mTLS CLIENT cert+key only when usable (degrade otherwise);
 *   - NEVER set `ca` — LP's public endpoint serves a publicly-trusted server
 *     cert, so server verification uses Node's default trust store. Passing
 *     the internal `LICENSE_SERVER_TLS_CA_PEM` here REPLACES that store and
 *     breaks verification (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`), which closes
 *     the socket instantly. That was the "terminal: Sesión terminada (exit 1)"
 *     bug — the HTTP path omitted `ca` but the WebSocket path didn't.
 */
export function licenseServerSocketTlsOptions(): {
  cert?: string;
  key?: string;
  rejectUnauthorized?: boolean;
} {
  const tls = licenseServerTlsConfig();
  const withCert = useClientCert(tls);
  return {
    cert: withCert ? tls.cert : undefined,
    key: withCert ? tls.key : undefined,
    rejectUnauthorized: tls.rejectUnauthorized,
  };
}

// Keep-alive connection pools. Without these, every LP call pays a fresh
// TCP + TLS + mTLS client-cert handshake — the dominant latency users feel
// as "todo lento al conectarse". The agents reuse the already-established,
// already-authenticated secure channel: SAME cert/key/rejectUnauthorized,
// SAME LUXIPANEL_KEY, SAME IP allowlist — zero change to the security model,
// we just stop renegotiating it per request. TLS material lives on the
// agent because Node pools sockets per-agent and ignores per-request
// cert/key once a custom agent is supplied. mTLS cert comes from env and is
// static for the process lifetime, so the agent is memoized once.
let httpsAgent: HttpsAgent | null = null;
let httpAgentInstance: HttpAgent | null = null;

function keepAliveAgent(protocol: string): HttpsAgent | HttpAgent {
  if (protocol === "http:") {
    httpAgentInstance ??= new HttpAgent({
      keepAlive: true,
      keepAliveMsecs: 10_000,
      maxSockets: 24,
      maxFreeSockets: 8,
      scheduling: "lifo",
    });
    return httpAgentInstance;
  }
  if (!httpsAgent) {
    const tls = licenseServerTlsConfig();
    const withCert = useClientCert(tls);
    httpsAgent = new HttpsAgent({
      keepAlive: true,
      keepAliveMsecs: 10_000,
      maxSockets: 24,
      maxFreeSockets: 8,
      scheduling: "lifo",
      // CLIENT identity (mTLS) lives on the agent so pooled sockets carry it.
      cert: withCert ? tls.cert : undefined,
      key: withCert ? tls.key : undefined,
      // SERVER verification always uses Node's default trust store (LP's
      // public cert). Never set `ca` — see requestOptions() for why.
      rejectUnauthorized: tls.rejectUnauthorized,
    });
  }
  return httpsAgent;
}

export async function postLicenseServerJson<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
  baseUrl?: string,
): Promise<T> {
  const url = new URL(path, baseUrl || env.LICENSE_SERVER_URL);
  const payload = JSON.stringify(body);
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload).toString(),
    ...extraHeaders,
  };

  const raw = await lpHttpRequest({
    method: "POST",
    url,
    headers,
    body: payload,
    timeoutMs,
  });

  return JSON.parse(raw) as JsonResponse<T> as T;
}

/**
 * Low-level transport: fires a single HTTP/HTTPS request to LP and resolves
 * with the response body as a string. Throws `Error` on non-2xx (with the
 * server-provided snippet for diagnostics) or transport failure (timeout,
 * socket reset, …). Pure transport — no JSON parsing, no auth header
 * inspection beyond what {@link requestOptions} already does.
 */
export async function lpHttpRequest(opts: {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}): Promise<string> {
  const { method, url, headers, body, timeoutMs } = opts;
  const client = url.protocol === "http:" ? httpRequest : httpsRequest;
  const options: RequestOptions = {
    ...requestOptions(method, headers),
    agent: keepAliveAgent(url.protocol),
  };

  return await new Promise<string>((resolve, reject) => {
    const req = client(url, options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("error", reject);
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          // SECURITY: do not log the outbound Bearer key prefix (or any
          // portion of LUXIPANEL_KEY) — partial-prefix logging narrows the
          // brute-force surface for any reader of the log file.
          log.warn(
            { path: url.pathname, status: res.statusCode, body: raw.slice(0, 200) },
            "LP call returned non-2xx",
          );
          reject(
            new Error(
              `License server returned ${res.statusCode ?? "unknown"}${raw ? `: ${raw}` : ""}`,
            ),
          );
          return;
        }
        resolve(raw);
      });
    });

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("License server request timed out")));
    if (body) req.write(body);
    req.end();
  });
}

// ── License-server URL helpers (SSOT) ─────────────────────────────────────
//
// Several modules repeated the `env.LICENSE_SERVER_AGENTS_URL ||
// env.LICENSE_SERVER_URL` fallback (and string-trim / slash normalization) by
// hand. Centralised here so the one live caller (`ssh-proxy-client`) and any
// future copy import the SAME value instead of re-deriving it.

/** Base URL for the agents gateway (`/api/agents/*`). May point at LP loopback in dev. */
export function agentsBaseUrl(): string {
  return (env.LICENSE_SERVER_AGENTS_URL || env.LICENSE_SERVER_URL).replace(/\/+$/, "");
}
