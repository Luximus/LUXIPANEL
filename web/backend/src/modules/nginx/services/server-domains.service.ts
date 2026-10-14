// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Server domain discovery for the DNS module.
 *
 * Scans common web server configuration locations and extracts hostnames
 * from nginx, Apache, and Caddy-style configs so the panel can show
 * domains that exist on the server even if they are not registered in DB.
 */

import path from "node:path";
import type { Executor, SftpBatchOperation } from "../../../shared/executor/index.js";
import { readPrivilegedFileOrEmpty } from "../../../shared/system/privileged-file-io.js";
import { serverNamesFromContent } from "../../../shared/nginx/server-name.js";
import { domainSchema } from "../../../shared/validators/index.js";
import {
  NGINX_CONF,
  NGINX_CONF_D,
  NGINX_VHOSTS_D,
  NGINX_VHOST_D,
  SITES_AVAILABLE,
  SITES_ENABLED,
  CERTBOT_WEBROOT,
} from "../nginx-constants.js";

export interface DiscoveredServerDomain {
  name: string;
  sources: string[];
  documentRoot: string | null;
  documentRoots: string[];
  configPath: string | null;
  configPaths: string[];
}

type ServerConfigSource = {
  vendor: "nginx" | "apache" | "caddy";
  paths: string[];
};

type DiscoveryEntry = {
  sources: Set<string>;
  documentRoots: Set<string>;
  documentRoot: string | null;
  configPaths: Set<string>;
  configPath: string | null;
};

const COMMON_SERVER_CONFIGS: ServerConfigSource[] = [
  {
    vendor: "nginx",
    paths: [
      NGINX_CONF,
      SITES_ENABLED,
      SITES_AVAILABLE,
      NGINX_CONF_D,
      NGINX_VHOSTS_D,
      NGINX_VHOST_D,
      "/usr/local/nginx/conf/nginx.conf",
      "/usr/local/nginx/conf/conf.d",
      "/usr/local/nginx/conf/vhosts",
      "/etc/openresty/nginx.conf",
      "/etc/openresty/conf.d",
      "/etc/openresty/sites-enabled",
      "/usr/local/openresty/nginx/conf/conf.d",
      "/usr/local/openresty/nginx/conf/vhosts",
      "/www/server/panel/vhost/nginx",
      "/opt/bitnami/nginx/conf/vhosts",
    ],
  },
  {
    vendor: "apache",
    paths: [
      "/etc/apache2/apache2.conf",
      "/etc/apache2/sites-enabled",
      "/etc/apache2/conf-enabled",
      "/etc/apache2/sites-available",
      "/etc/httpd/conf/httpd.conf",
      "/etc/httpd/conf.d",
      "/etc/httpd/sites-enabled",
      "/etc/httpd/sites-available",
      "/usr/local/apache2/conf/vhosts",
      "/etc/apache2/conf.d/userdata",
      "/www/server/panel/vhost/apache",
      "/opt/bitnami/apache2/conf/vhosts",
    ],
  },
  {
    vendor: "caddy",
    paths: [
      "/etc/caddy/Caddyfile",
      "/usr/local/etc/caddy/Caddyfile",
      "/etc/caddy/conf.d",
      "/etc/caddy/sites-enabled",
    ],
  },
];

const MAX_REMOTE_SCAN_DEPTH = 2;
const MAX_REMOTE_SCAN_FILES = 200;
const MAX_REMOTE_DOCROOT_LOOKUPS = 32;
const REMOTE_BATCH_READ_SIZE = 25;

function normalizeCandidate(value: string): string | null {
  const lowered = value.toLowerCase().trim();
  if (!lowered || lowered.includes("*")) {
    return null;
  }

  const trimmed = lowered
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .replace(/:\d+$/, "");

  if (!trimmed || trimmed === "_" || trimmed === "localhost") {
    return null;
  }

  const parsed = domainSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

function extractFromNginx(content: string): string[] {
  // Directive parsing is shared (`shared/nginx/server-name.ts`); the extra
  // normalization (strip port/path/trailing dot + `domainSchema`) stays here
  // because only this discovery path applies it.
  return serverNamesFromContent(content)
    .map(normalizeCandidate)
    .filter((value): value is string => Boolean(value));
}

function extractNginxDocumentRoot(content: string): string | null {
  const match = content.match(/^\s*root\s+([^;]+);/gmi)?.[0];
  if (!match) return null;
  const value = match.replace(/^\s*root\s+/i, "").replace(/;$/, "").trim();
  if (value === CERTBOT_WEBROOT && content.includes("acme-challenge")) {
    return null;
  }
  return value || null;
}

function extractFromApache(content: string): string[] {
  const domains: string[] = [];
  const directives = [
    ...content.matchAll(/^\s*ServerName\s+(.+)$/gmi),
    ...content.matchAll(/^\s*ServerAlias\s+(.+)$/gmi),
  ];

  for (const directive of directives) {
    const value = directive[1] ?? "";
    const candidateList = value
      .split(/\s+/)
      .map(normalizeCandidate)
      .filter((candidate): candidate is string => Boolean(candidate));
    domains.push(...candidateList);
  }

  return domains;
}

function extractApacheDocumentRoot(content: string): string | null {
  const match = content.match(/^\s*DocumentRoot\s+(.+)$/gmi)?.[0];
  if (!match) return null;
  const value = match.replace(/^\s*DocumentRoot\s+/i, "").trim().replace(/["']/g, "");
  return value || null;
}

function extractFromCaddy(content: string): string[] {
  const domains: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([a-z0-9.-]+\.[a-z]{2,})(?:\s|$)/i);
    if (!match?.[1]) continue;

    const domain = normalizeCandidate(match[1]);
    if (domain) domains.push(domain);
  }

  return domains;
}

function extractCaddyDocumentRoot(content: string): string | null {
  const match = content.match(/^\s*root\s+\*?\s+(.+)$/gmi)?.[0];
  if (!match) return null;
  const value = match.replace(/^\s*root\s+\*?\s+/i, "").trim().replace(/["']/g, "");
  return value || null;
}

/**
 * Build the `/var/www/...` document-root candidate set for a domain. Returns
 * an empty set when the domain does not normalize. Shared by the local and
 * executor inference paths so both probe the exact same paths.
 */
function docrootCandidates(domain: string): Set<string> {
  const normalized = normalizeCandidate(domain);
  if (!normalized) return new Set<string>();

  const parts = normalized.split(".").filter(Boolean);
  const candidates = new Set<string>();
  const firstLabel = parts[0] ?? normalized;
  const registrableLabel = parts.length >= 2 ? parts[parts.length - 2] : normalized;

  for (const base of [normalized, firstLabel, registrableLabel]) {
    if (!base) continue;
    candidates.add(`/var/www/${base}`);
    candidates.add(`/var/www/${base}/public`);
  }

  return candidates;
}

async function inferFilesystemDocumentRootWithExecutor(domain: string, executor: Executor): Promise<string | null> {
  const candidates = docrootCandidates(domain);
  if (candidates.size === 0) return null;

  if (typeof executor.batchSftp === "function") {
    const candidateList = [...candidates];
    const operations: SftpBatchOperation[] = candidateList.map((candidate, index) => ({
      id: `docroot-${index}`,
      op: "stat",
      path: candidate,
    }));
    const results = await executor.batchSftp(operations);
    const resultById = new Map(results.map((item) => [item.id, item]));

    for (let i = 0; i < candidateList.length; i += 1) {
      const candidate = candidateList[i];
      if (!candidate) continue;
      const result = resultById.get(`docroot-${i}`);
      if (!result?.ok) continue;
      const stat = result.data as { type?: string; isDir?: boolean } | undefined;
      if (stat?.type === "dir" || stat?.isDir === true) {
        return candidate;
      }
    }
    return null;
  }

  for (const candidate of candidates) {
    try {
      const stat = await executor.stat(candidate);
      if (stat.type === "dir") {
        return candidate;
      }
    } catch {
      // Candidate path does not exist on target, continue.
    }
  }

  return null;
}

function extractDomainsFromConfig(content: string, vendor: ServerConfigSource["vendor"]): { domains: string[]; documentRoot: string | null } {
  if (vendor === "nginx") {
    return { domains: extractFromNginx(content), documentRoot: extractNginxDocumentRoot(content) };
  }
  if (vendor === "apache") {
    return { domains: extractFromApache(content), documentRoot: extractApacheDocumentRoot(content) };
  }
  return { domains: extractFromCaddy(content), documentRoot: extractCaddyDocumentRoot(content) };
}

function shouldReadConfigFile(filePath: string, vendor: ServerConfigSource["vendor"]): boolean {
  const base = path.posix.basename(filePath).toLowerCase();
  if (vendor === "caddy") {
    if (base === "caddyfile" || base.startsWith("caddyfile.")) return true;
    if (base.endsWith(".conf") || base.endsWith(".caddy")) return true;
    return !base.includes(".");
  }

  if (base.endsWith(".conf") || base.endsWith(".vhost")) return true;
  // In sites-enabled, symlink names are usually domain names without extension.
  return !base.includes(".");
}

function upsertDiscoveredDomain(
  results: Map<string, DiscoveryEntry>,
  domain: string,
  vendor: ServerConfigSource["vendor"],
  inferredRoot: string | null,
  configPath: string,
): void {
  if (!results.has(domain)) {
    results.set(domain, {
      sources: new Set(),
      documentRoots: new Set(),
      documentRoot: null,
      configPaths: new Set(),
      configPath: null,
    });
  }
  const entry = results.get(domain);
  if (!entry) return;
  entry.sources.add(vendor);
  entry.configPaths.add(configPath);
  if (!entry.configPath) {
    entry.configPath = configPath;
  }
  if (inferredRoot) {
    entry.documentRoots.add(inferredRoot);
    if (!entry.documentRoot) {
      entry.documentRoot = inferredRoot;
    }
  }
}

/**
 * Document-root inference budget/cache scoped to a SINGLE {@link serverDomainsService.list}
 * call. `list` always runs against exactly one target (its `executor`), so a
 * fresh scope per call is inherently keyed by `executor.target.id`: it is shared
 * across the config paths of that one target and NEVER leaks inferred roots to
 * another target's scan.
 */
type DocRootInferenceScope = {
  cache: Map<string, string | null>;
  lookups: number;
};

type RemoteScanNode = {
  path: string;
  depth: number;
  kind?: "file" | "dir" | "symlink";
};

async function collectConfigFilesFromExecutor(
  executor: Executor,
  target: string,
  vendor: ServerConfigSource["vendor"],
): Promise<string[]> {
  const files: string[] = [];
  const queue: RemoteScanNode[] = [{ path: target, depth: 0 }];
  const visited = new Set<string>([target]);

  while (queue.length > 0 && files.length < MAX_REMOTE_SCAN_FILES) {
    const current = queue.shift();
    if (!current) break;

    let currentType = current.kind;
    if (!currentType) {
      let stat: Awaited<ReturnType<Executor["stat"]>>;
      try {
        stat = await executor.stat(current.path);
      } catch {
        continue;
      }
      currentType = stat.type;
    }

    if (currentType === "dir") {
      if (current.depth >= MAX_REMOTE_SCAN_DEPTH) continue;
      let entries: Awaited<ReturnType<Executor["readdir"]>>;
      try {
        entries = await executor.readdir(current.path);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry?.name || entry.name === "." || entry.name === "..") continue;
        const nextPath = path.posix.join(current.path, entry.name);
        if (visited.has(nextPath)) continue;
        visited.add(nextPath);
        queue.push({ path: nextPath, depth: current.depth + 1, kind: entry.type });
      }
      continue;
    }

    if ((currentType === "file" || currentType === "symlink") && shouldReadConfigFile(current.path, vendor)) {
      files.push(current.path);
    }
  }

  return files;
}

async function scanPathWithExecutor(
  target: string,
  vendor: ServerConfigSource["vendor"],
  results: Map<string, DiscoveryEntry>,
  executor: Executor,
  docRoot: DocRootInferenceScope,
): Promise<void> {
  const files = await collectConfigFilesFromExecutor(executor, target, vendor);

  const fileContents = new Map<string, string>();
  if (typeof executor.batchSftp === "function") {
    for (let offset = 0; offset < files.length; offset += REMOTE_BATCH_READ_SIZE) {
      const chunk = files.slice(offset, offset + REMOTE_BATCH_READ_SIZE);
      const operations: Array<Extract<SftpBatchOperation, { op: "readFile" }>> = chunk.map((filePath, index) => ({
        id: `read-${offset + index}`,
        op: "readFile",
        path: filePath,
        encoding: "utf8",
      }));
      const results = await executor.batchSftp(operations);
      const pathById = new Map(operations.map((op) => [op.id, op.path]));
      for (const result of results) {
        if (!result.ok || typeof result.data !== "string") continue;
        const resultPath = pathById.get(result.id);
        if (!resultPath) continue;
        fileContents.set(resultPath, result.data);
      }
    }
  } else {
    for (const filePath of files) {
      try {
        const raw = await executor.readFile(filePath, "utf-8");
        const content = typeof raw === "string" ? raw : raw.toString("utf-8");
        fileContents.set(filePath, content);
      } catch {
        // Ignore unreadable files; sudo fallback below picks them up.
      }
    }
  }

  // Sudo fallback for files that weren't readable (typical for nginx
  // sites-enabled which is root-only on many distros).
  const missing = files.filter((f) => !fileContents.has(f));
  for (const filePath of missing) {
    // SFTP was already attempted above, so only the privileged rung is left.
    const content = await readPrivilegedFileOrEmpty(executor, filePath, { sudoOnly: true });
    if (content.trim().length > 0) fileContents.set(filePath, content);
  }

  for (const filePath of files) {
    const content = fileContents.get(filePath);
    if (!content) continue;

    const { domains, documentRoot } = extractDomainsFromConfig(content, vendor);
    for (const domain of domains) {
      let inferredRoot = documentRoot;
      if (!inferredRoot) {
        if (!docRoot.cache.has(domain)) {
          if (docRoot.lookups >= MAX_REMOTE_DOCROOT_LOOKUPS) {
            docRoot.cache.set(domain, null);
          } else {
            docRoot.lookups += 1;
            docRoot.cache.set(domain, await inferFilesystemDocumentRootWithExecutor(domain, executor));
          }
        }
        inferredRoot = docRoot.cache.get(domain) ?? null;
      }
      upsertDiscoveredDomain(results, domain, vendor, inferredRoot, filePath);
    }
  }
}

export const serverDomainsService = {
  // `executor` is REQUIRED: domain discovery reads the CONNECTED target's config
  // tree over SSH/SFTP. There is no local-fs fallback — a missing executor would
  // scan the panel host's filesystem, leaking one server's vhosts to another.
  async list(executor: Executor): Promise<DiscoveredServerDomain[]> {
    const results = new Map<string, DiscoveryEntry>();
    const docRoot: DocRootInferenceScope = { cache: new Map(), lookups: 0 };

    for (const source of COMMON_SERVER_CONFIGS) {
      for (const target of source.paths) {
        await scanPathWithExecutor(target, source.vendor, results, executor, docRoot);
      }
    }

    return [...results.entries()]
      .map(([name, data]) => ({
        name,
        sources: [...data.sources].sort(),
        documentRoot: data.documentRoot,
        documentRoots: [...data.documentRoots].sort(),
        configPath: data.configPath,
        configPaths: [...data.configPaths].sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  _normalizeCandidate: normalizeCandidate,
  _extractFromNginx: extractFromNginx,
  _extractNginxDocumentRoot: extractNginxDocumentRoot,
  _extractFromApache: extractFromApache,
  _extractApacheDocumentRoot: extractApacheDocumentRoot,
  _extractFromCaddy: extractFromCaddy,
  _extractCaddyDocumentRoot: extractCaddyDocumentRoot,
};
