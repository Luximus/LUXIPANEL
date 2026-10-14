// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX module — request/response schemas and types.
 *
 * The filesystem (`/etc/nginx/sites-available` + `sites-enabled`) is the
 * source of truth. We do not mirror site state into the kv-store; every
 * operation reads/writes the connected target through the executor.
 */

import { z } from "zod";
import { domainSchema, emailSchema } from "../../../shared/validators/index.js";

/** Safe nginx site/file identifier (no path traversal). */
export const siteNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._-]+$/, "Invalid site name (only letters, digits, dot, underscore, hyphen)")
  .refine((v) => v !== "." && v !== ".." && !v.includes("/"), "Invalid site name");

/** Site backend kind for the guided (form) generator. */
export const siteKindSchema = z.enum(["static", "php", "proxy"]);

/** Guided form payload — server block is generated from these fields. */
export const siteFormSchema = z.object({
  kind: siteKindSchema.default("static"),
  domain: domainSchema,
  /** Extra server_name aliases (e.g. "www.example.com"). */
  aliases: z.array(domainSchema).max(20).default([]),
  /** Document root for static / php sites. */
  root: z.string().trim().max(512).optional(),
  /** PHP-FPM socket/host for kind=php. */
  phpSocket: z.string().trim().max(256).optional(),
  /** Upstream URL for kind=proxy, e.g. http://127.0.0.1:3000. */
  proxyPass: z.string().trim().max(512).optional(),
  /** Pass WebSocket upgrade headers (kind=proxy). */
  websocket: z.boolean().default(false),
  /** Redirect every request to this URL instead of serving content. */
  redirectTo: z.string().trim().max(512).optional(),
  /** Redirect HTTP → HTTPS (only meaningful once TLS is enabled). */
  forceHttps: z.boolean().default(false),
  /** Extra raw directives injected inside the main server block. */
  extraDirectives: z.string().max(8192).optional(),
});

/** Create a site: either guided (`form`) or raw config text. */
export const createSiteSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("form"), enabled: z.boolean().default(true), form: siteFormSchema }),
  z.object({
    mode: z.literal("raw"),
    name: siteNameSchema,
    enabled: z.boolean().default(true),
    content: z.string().min(1).max(256 * 1024),
  }),
]);

/** Update a site: guided regen or raw overwrite. */
export const updateSiteSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("form"), form: siteFormSchema, expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional() }),
  z.object({
    mode: z.literal("raw"),
    content: z.string().min(1).max(256 * 1024),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }),
]);

/** Preview a generated config without writing it. */
export const previewSiteSchema = siteFormSchema;

/**
 * An nginx `server` value inside an `upstream {}` block.
 *
 * THIS IS AN INJECTION BOUNDARY. The value is written verbatim into the nginx
 * config as `server <value>;`, so anything that can close the directive escapes
 * into the config grammar:
 *
 *     server 127.0.0.1; } location /x { root /etc; #
 *
 * …ends the `server` directive, closes the `upstream` block and opens a new
 * `location` serving `/etc`. Previously `server` was just `z.string().max(256)`,
 * so that parsed fine.
 *
 * Defence is an ALLOWLIST of the four shapes nginx actually accepts — never a
 * blacklist of bad characters, which always loses (`;`, `\n`, `#`, `{`, spaces,
 * tabs, `\r`, comments…). Whatever is not one of these four is rejected:
 *
 *   host            app.internal, web-1.example.com
 *   IPv4[:port]     10.0.0.1, 127.0.0.1:3000
 *   [IPv6]:port     [::1]:8080
 *   unix:/abs/path  unix:/run/php-fpm.sock
 *
 * Ports are range-checked (1–65535), so `:99999` is out. Schemes (`http://…`)
 * are NOT valid in a `server` directive and are rejected too.
 */
const PORT = "(?::(?:6553[0-5]|655[0-2]\\d|65[0-4]\\d{2}|6[0-4]\\d{3}|[1-5]\\d{4}|[1-9]\\d{0,3}))";
const HOSTNAME = "(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*";
const IPV4 = "(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})";
const IPV6_BRACKETED = "(?:\\[[0-9A-Fa-f:]{2,45}\\])";
const UNIX_SOCKET = "(?:unix:/[^\\s;{}#'\"\\\\]*)";
const UPSTREAM_SERVER_RE = new RegExp(
  `^(?:${UNIX_SOCKET}|${IPV6_BRACKETED}${PORT}|(?:${IPV4}|${HOSTNAME})${PORT}?)$`,
);

export const nginxUpstreamServerSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((v) => UPSTREAM_SERVER_RE.test(v), {
    message:
      "Upstream inválido. Usa host, host:puerto, IP, IP:puerto, [IPv6]:puerto o unix:/ruta/al.sock.",
  });

/** Reverse-proxy / upstream builder. */
export const proxySchema = z.object({
  domain: domainSchema,
  aliases: z.array(domainSchema).max(20).default([]),
  /** Upstream targets; >1 enables an `upstream {}` block + load balancing. */
  upstreams: z
    .array(
      z.object({
        server: nginxUpstreamServerSchema,
        weight: z.coerce.number().int().min(1).max(100).optional(),
      }),
    )
    .min(1)
    .max(32),
  /** lb method when multiple upstreams: round-robin (default) | least_conn | ip_hash. */
  balance: z.enum(["round_robin", "least_conn", "ip_hash"]).default("round_robin"),
  websocket: z.boolean().default(false),
  forceHttps: z.boolean().default(false),
  extraDirectives: z.string().max(8192).optional(),
  enabled: z.boolean().default(true),
});

/** Global nginx.conf write. */
export const configWriteSchema = z.object({
  content: z.string().min(1).max(512 * 1024),
});

/** systemctl-style service action. */
export const serviceActionSchema = z.object({
  action: z.enum(["start", "stop", "restart", "reload", "test"]),
});

/** Log tail query. */
export const logsQuerySchema = z.object({
  site: siteNameSchema.optional(),
  type: z.enum(["access", "error"]).default("error"),
  lines: z.coerce.number().int().min(1).max(2000).default(200),
});

/** Performance tuning — applied via a managed conf.d snippet + nginx.conf. */
export const performanceSchema = z.object({
  /** gzip compression for text responses. */
  gzip: z.boolean().default(true),
  /** gzip_comp_level 1–9. */
  gzipLevel: z.coerce.number().int().min(1).max(9).default(5),
  /** sendfile + tcp_nopush + tcp_nodelay (fast static file serving). */
  sendfile: z.boolean().default(true),
  /** keepalive_timeout seconds (0 disables). */
  keepaliveTimeout: z.coerce.number().int().min(0).max(600).default(65),
  /** Cache-Control max-age (days) for static assets; 0 disables. */
  staticCacheDays: z.coerce.number().int().min(0).max(365).default(30),
  /** open_file_cache for file descriptors/metadata. */
  openFileCache: z.boolean().default(true),
  /** Enable a shared proxy_cache zone for proxied responses. */
  proxyCache: z.boolean().default(false),
  /** worker_processes: "auto" or a positive integer. */
  workerProcesses: z.union([z.literal("auto"), z.coerce.number().int().min(1).max(64)]).default("auto"),
  /** worker_connections per worker (concurrent connections). */
  workerConnections: z.coerce.number().int().min(64).max(65536).default(1024),
});
export type PerformanceConfig = z.infer<typeof performanceSchema>;

/** Enable HTTPS for a site (issues a Let's Encrypt cert via the SSL module). */
export const enableSslSchema = z.object({
  // `emailSchema` (not bare `.email()`) so the address is length-capped (320)
  // upstream: this value flows into certbot's `-m <email>` argv, and an
  // unbounded string could push the arg list past E2BIG and fail the exec.
  // Defence-in-depth: `certbotService.issueWithExecutor` re-validates too.
  email: emailSchema,
});

export interface NginxSiteSummary {
  name: string;
  file: string;
  enabled: boolean;
  domains: string[];
  root: string | null;
  proxyPass: string | null;
  ssl: boolean;
  kind: "static" | "php" | "proxy" | "redirect" | "unknown";
}

export interface NginxStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
  enabledSites: number;
  availableSites: number;
  configTest: { ok: boolean; output: string };
}

export type SiteForm = z.infer<typeof siteFormSchema>;
export type ProxyConfig = z.infer<typeof proxySchema>;
