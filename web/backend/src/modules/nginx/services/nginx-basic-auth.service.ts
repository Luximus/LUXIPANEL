// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * nginx per-directory HTTP Basic auth — the nginx-native enforcement behind the
 * files module's "Directory Privacy" feature.
 *
 * nginx ignores `.htaccess`, so password-protecting a folder requires injecting
 * `auth_basic` / `auth_basic_user_file` directives into the nginx site that
 * serves that folder, then reloading. This service:
 *   1. finds the enabled site whose document root is an ancestor of the folder,
 *   2. computes the URL location for the folder (relative to the root),
 *   3. injects a marked `location ^~ <url>/ { … }` block into every serving
 *      `server { }` block of that site (the ones that carry the `root`),
 *   4. for PHP sites, nests the site's own `\.php$` handler inside the protected
 *      location so PHP keeps executing (and source is never served as text),
 *   5. persists via `nginxSitesService.writeSite`, which runs `nginx -t` and
 *      rolls back on any syntax error before reloading.
 *
 * The marked block is removed on disable. The `.htpasswd` file itself is written
 * by the files module (apr1 hashes, nginx-compatible) and referenced here.
 */

import { type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { isConcreteHost } from "../../../shared/nginx/server-name.js";
import { nginxSitesService } from "./nginx-sites.service.js";
import type { NginxSiteSummary } from "../models/nginx.model.js";

const log = createModuleLogger("nginx-basic-auth");

export interface DirAuthResult {
  /** Whether the protection is currently active in nginx. */
  enforced: boolean;
  /** The nginx site (file name) that serves the folder, if any. */
  site: string | null;
  /** The URL location that was protected (e.g. "/private/"), if any. */
  url: string | null;
  /** Full browser URL (scheme://domain/location) when a concrete host exists. */
  publicUrl: string | null;
  /** How the protection is wired: under a site's docroot, or published via alias. */
  mode?: "docroot" | "publish";
  /** Machine-readable reason when not enforced ("no-site" | "no-server-block"). */
  reason?: string;
}

/** A single nginx domain the folder could be published under. */
export interface PublishCandidate {
  /** The nginx site (file) that declares this domain. */
  site: string;
  /** The concrete, fetchable domain (a `server_name` value). */
  domain: string;
  ssl: boolean;
  kind: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filesystem paths (`dir`, `htpasswd`) are interpolated RAW into nginx
 * directives (`alias …;`, `auth_basic_user_file …;`). Without escaping, a
 * directory named `foo; } location / { root /; autoindex on; #` produces a
 * VALID vhost that exposes the whole filesystem over HTTP (audit §5). Restrict
 * these tokens to a conservative path charset — anything with `;{}`,
 * whitespace, quotes or newlines is rejected before it can reach the config.
 */
const NGINX_PATH_RE = /^[A-Za-z0-9._/~-]+$/;
function assertNginxPathToken(value: string, kind: string): void {
  if (!NGINX_PATH_RE.test(value)) {
    throw new Error(`Ruta nginx inválida (${kind}): solo se permiten letras, números y . _ ~ - /`);
  }
}

function trimSlashEnd(p: string): string {
  return p.replace(/\/+$/, "");
}

/** A concrete, fetchable hostname (not "_", localhost, a bare IP, or wildcard). */
const looksFqdn = isConcreteHost;

/** Build the public browser URL for a protected location, or null if no host. */
function publicUrlFor(site: { domains?: string[]; ssl?: boolean }, loc: string): string | null {
  const domains = Array.isArray(site.domains) ? site.domains : [];
  const host = domains.find(looksFqdn);
  if (!host) return null;
  return `${site.ssl ? "https" : "http"}://${host}${loc}`;
}

/** Build the public browser URL for an explicit host. */
function publicUrlForHost(host: string, ssl: boolean, loc: string): string {
  return `${ssl ? "https" : "http"}://${host}${loc}`;
}

/** URL location for `dir` relative to the site `root` (always trailing-slashed). */
function locationFor(root: string, dir: string): string {
  const r = trimSlashEnd(root);
  if (dir === r) return "/";
  const rel = dir.slice(r.length); // begins with "/"
  return rel.endsWith("/") ? rel : `${rel}/`;
}

interface Block {
  bodyStart: number; // index just after the opening "{"
  close: number; // index of the matching "}"
}

/** Find top-level `<keyword> { … }` blocks with correct brace matching. */
function findBlocks(text: string, keyword: string): Block[] {
  const blocks: Block[] = [];
  const re = new RegExp(`(^|\\s)${keyword}\\s*\\{`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const braceIdx = text.indexOf("{", m.index);
    if (braceIdx === -1) break;
    let depth = 0;
    let i = braceIdx;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({ bodyStart: braceIdx + 1, close: i });
    re.lastIndex = i;
  }
  return blocks;
}

/** Inner body of the first `location … \.php …` block within a server body. */
function findPhpLocationBody(serverBody: string): string | null {
  const re = /location\s+([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serverBody))) {
    const header = m[1] ?? "";
    const braceIdx = serverBody.indexOf("{", m.index);
    let depth = 0;
    let i = braceIdx;
    for (; i < serverBody.length; i++) {
      if (serverBody[i] === "{") depth++;
      else if (serverBody[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    re.lastIndex = i;
    if (/\.php/.test(header)) {
      return serverBody.slice(braceIdx + 1, i).trim();
    }
  }
  return null;
}

function startMarker(loc: string): string {
  return `# >>> LUXIPANEL dir-privacy ${loc}`;
}
function endMarker(loc: string): string {
  return `# <<< LUXIPANEL dir-privacy ${loc}`;
}

// ── "Publish" markers — used when a folder is NOT under any site's docroot and
// is instead exposed under a chosen site via an `alias` location. Keyed by the
// folder path so status/unpublish can find the block across every site. ──
function startPublishMarker(dir: string): string {
  return `# >>> LUXIPANEL dir-publish ${trimSlashEnd(dir)}`;
}
function endPublishMarker(dir: string): string {
  return `# <<< LUXIPANEL dir-publish ${trimSlashEnd(dir)}`;
}

/** Remove a previously-injected publish block for `dir` (idempotent). */
function stripPublishBlock(text: string, dir: string): string {
  const esc = escapeRegex(trimSlashEnd(dir));
  const re = new RegExp(
    `\\n?[ \\t]*# >>> LUXIPANEL dir-publish ${esc}[\\s\\S]*?# <<< LUXIPANEL dir-publish ${esc}[ \\t]*`,
    "g",
  );
  return text.replace(re, "");
}

/** A safe public URL location: leading+trailing slash, no traversal. */
function normalizeUrlPath(input: string | undefined, dir: string): string {
  let p = (input ?? "").trim();
  if (!p) p = `/${dir.replace(/\/+$/, "").split("/").pop() || "files"}/`;
  if (!p.startsWith("/")) p = `/${p}`;
  if (!p.endsWith("/")) p = `${p}/`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.includes("..") || !/^\/[A-Za-z0-9._~/-]*\/$/.test(p)) {
    throw new Error("Ruta pública inválida (usa letras, números y . _ ~ - /)");
  }
  return p;
}

/** Build an `alias`-based static block exposing `dir` at `loc` under a site. */
function buildPublishBlock(dir: string, loc: string, realm: string, htpasswd: string, host: string): string {
  assertNginxPathToken(trimSlashEnd(dir), "directorio");
  assertNginxPathToken(htpasswd, "htpasswd");
  const safeRealm = realm.replace(/["\r\n]/g, "");
  const safeHost = host.replace(/[^A-Za-z0-9.-]/g, "");
  const lines: string[] = [];
  lines.push(`    ${startPublishMarker(dir)}`);
  if (safeHost) lines.push(`    # LUXIPANEL publish-host ${safeHost}`);
  lines.push(`    location ^~ ${loc} {`);
  lines.push(`        alias ${trimSlashEnd(dir)}/;`);
  lines.push(`        auth_basic "${safeRealm}";`);
  lines.push(`        auth_basic_user_file ${htpasswd};`);
  lines.push(`        autoindex on;`);
  // Never serve the credential/control files, even to authenticated users.
  lines.push(`        location ~ /\\.ht { deny all; }`);
  lines.push(`    }`);
  lines.push(`    ${endPublishMarker(dir)}`);
  return lines.join("\n");
}

/** Server blocks that actually serve content (proxy/root/location), excluding
 * pure ACME/redirect blocks. Prefers the TLS (443) blocks when present. */
function servingServerBlocks(raw: string): Block[] {
  const all = findBlocks(raw, "server");
  const serves = (b: Block) => {
    const body = raw.slice(b.bodyStart, b.close);
    if (/proxy_pass\s+/i.test(body)) return true;
    if (/^\s*root\s+\//im.test(body)) return true;
    if (/^\s*include\s+/im.test(body)) return true; // body served via a snippet include
    return /location\s+\/\s*\{/.test(body); // a catch-all location
  };
  const candidates = all.filter(serves);
  const ssl = candidates.filter((b) => /listen\s+(\[::\]:)?443\b|ssl_certificate\s+/i.test(raw.slice(b.bodyStart, b.close)));
  return ssl.length ? ssl : candidates;
}

/** Remove a previously-injected block for `loc` (idempotent). */
function stripBlock(text: string, loc: string): string {
  const esc = escapeRegex(loc);
  const re = new RegExp(
    `\\n?[ \\t]*# >>> LUXIPANEL dir-privacy ${esc}[\\s\\S]*?# <<< LUXIPANEL dir-privacy ${esc}[ \\t]*`,
    "g",
  );
  return text.replace(re, "");
}

function buildBlock(loc: string, realm: string, htpasswd: string, phpBody: string | null): string {
  assertNginxPathToken(htpasswd, "htpasswd");
  const safeRealm = realm.replace(/["\r\n]/g, "");
  const lines: string[] = [];
  lines.push(`    ${startMarker(loc)}`);
  lines.push(`    location ^~ ${loc} {`);
  lines.push(`        auth_basic "${safeRealm}";`);
  lines.push(`        auth_basic_user_file ${htpasswd};`);
  if (phpBody) {
    // Keep PHP executing inside the protected path (and require auth there too).
    lines.push(`        location ~ \\.php$ {`);
    lines.push(`            auth_basic "${safeRealm}";`);
    lines.push(`            auth_basic_user_file ${htpasswd};`);
    for (const raw of phpBody.split("\n")) {
      const t = raw.trim();
      if (t) lines.push(`            ${t}`);
    }
    lines.push(`        }`);
  }
  lines.push(`    }`);
  lines.push(`    ${endMarker(loc)}`);
  return lines.join("\n");
}

async function matchSite(executor: Executor, dir: string) {
  // `listSitesWithContent` returns the per-site raw body in the same pass, so
  // a downstream `readRaw` call doesn't pay a second SSH round-trip per
  // matched site. We discard `content` here — callers that need it should
  // call `listSitesWithContent` directly.
  const sites = await nginxSitesService.listSites(executor);
  return matchSiteFromList(sites, dir);
}

/** Pure filter version of matchSite — caller already has the sites. */
function matchSiteFromList<T extends { enabled: boolean; root: string | null; proxyPass: string | null }>(sites: T[], dir: string): T | null {
  const candidates = sites
    .filter((s) => s.enabled && s.root && !s.proxyPass)
    .filter((s) => {
      const r = trimSlashEnd(s.root!);
      return dir === r || dir.startsWith(`${r}/`);
    })
    .sort((a, b) => (b.root!.length - a.root!.length));
  return candidates[0] ?? null;
}

/** Server blocks that actually carry this site's `root` (the serving blocks). */
function rootServerBlocks(raw: string, root: string): Block[] {
  const rootRe = new RegExp(`root\\s+${escapeRegex(trimSlashEnd(root))}\\/?\\s*;`);
  return findBlocks(raw, "server").filter((b) => rootRe.test(raw.slice(b.bodyStart, b.close)));
}

export const nginxBasicAuthService = {
  /** Enable (or refresh) Basic auth for `dir`, pointing at `htpasswd`. */
  async enableForDir(
    executor: Executor,
    dir: string,
    realm: string,
    htpasswd: string,
  ): Promise<DirAuthResult> {
    const site = await matchSite(executor, dir);
    if (!site || !site.root) return { enforced: false, site: null, url: null, publicUrl: null, reason: "no-site" };
    const loc = locationFor(site.root, dir);

    let raw = stripBlock(await nginxSitesService.readRaw(executor, site.name), loc);
    const blocks = rootServerBlocks(raw, site.root);
    if (blocks.length === 0) {
      return { enforced: false, site: site.name, url: loc, publicUrl: publicUrlFor(site, loc), reason: "no-server-block" };
    }

    // Insert into each serving block, last → first so earlier offsets stay valid.
    for (const b of blocks.sort((a, c) => c.close - a.close)) {
      const phpBody = findPhpLocationBody(raw.slice(b.bodyStart, b.close));
      const block = buildBlock(loc, realm, htpasswd, phpBody);
      raw = `${raw.slice(0, b.close)}${block}\n${raw.slice(b.close)}`;
    }

    // writeSite validates with `nginx -t`, rolls back on error, then reloads.
    await nginxSitesService.writeSite(executor, site.name, raw);
    log.info({ site: site.name, url: loc, target: executor.target.id }, "dir auth_basic enabled");
    return { enforced: true, site: site.name, url: loc, publicUrl: publicUrlFor(site, loc) };
  },

  /** Remove Basic auth for `dir` from its nginx site. */
  async disableForDir(executor: Executor, dir: string): Promise<DirAuthResult> {
    const site = await matchSite(executor, dir);
    if (!site || !site.root) return { enforced: false, site: null, url: null, publicUrl: null, reason: "no-site" };
    const loc = locationFor(site.root, dir);
    const raw = await nginxSitesService.readRaw(executor, site.name);
    if (!raw.includes(startMarker(loc))) {
      return { enforced: false, site: site.name, url: loc, publicUrl: publicUrlFor(site, loc) };
    }
    await nginxSitesService.writeSite(executor, site.name, stripBlock(raw, loc));
    log.info({ site: site.name, url: loc, target: executor.target.id }, "dir auth_basic disabled");
    return { enforced: false, site: site.name, url: loc, publicUrl: publicUrlFor(site, loc) };
  },

  /** Whether `dir` currently has an injected Basic-auth block in its site. */
  async statusForDir(executor: Executor, dir: string): Promise<DirAuthResult> {
    // Fetch every site + its content ONCE; reuse for both the docroot match
    // (step 1) and the publish-marker scan (step 2) — saves the extra
    // `listSites` + `readRaw` pair the prior implementation paid.
    const allSites = await nginxSitesService.listSitesWithContent(executor);
    const site = matchSiteFromList(allSites, dir);
    if (site && site.root) {
      const loc = locationFor(site.root, dir);
      if (site.content.includes(startMarker(loc))) {
        return { enforced: true, mode: "docroot", site: site.name, url: loc, publicUrl: publicUrlFor(site, loc) };
      }
    }
    // 2) Folder published under a chosen site via an `alias` block.
    const pub = findPublishFromList(allSites, dir);
    if (pub) {
      // Prefer the domain recorded in the block; fall back to the site's first FQDN.
      const host = pub.host ?? (pub.site.domains ?? []).find(looksFqdn) ?? null;
      return {
        enforced: true,
        mode: "publish",
        site: pub.site.name,
        url: pub.urlPath,
        publicUrl: host ? publicUrlForHost(host, Boolean(pub.site.ssl), pub.urlPath) : null,
      };
    }
    // 3) Not enforced. Surface the docroot URL (if any) or "no-site".
    if (site && site.root) {
      const loc = locationFor(site.root, dir);
      return { enforced: false, site: site.name, url: loc, publicUrl: publicUrlFor(site, loc) };
    }
    return { enforced: false, site: null, url: null, publicUrl: null, reason: "no-site" };
  },

  /** Every enabled nginx domain (server_name) the folder can be published under. */
  async listPublishCandidates(executor: Executor): Promise<PublishCandidate[]> {
    const sites = await nginxSitesService.listSites(executor);
    const out: PublishCandidate[] = [];
    const seen = new Set<string>();
    for (const s of sites) {
      if (!s.enabled) continue;
      for (const domain of (s.domains ?? []).filter(looksFqdn)) {
        if (seen.has(domain)) continue; // one entry per distinct domain
        seen.add(domain);
        out.push({ site: s.name, domain, ssl: Boolean(s.ssl), kind: s.kind });
      }
    }
    return out.sort((a, b) => a.domain.localeCompare(b.domain));
  },

  /**
   * Expose `dir` under `siteName` at `urlPath` via an `alias` location (for
   * folders that are NOT under any site's document root). Injects into the
   * site's serving server block(s) and validates/reloads via `writeSite`.
   */
  async publishDir(
    executor: Executor,
    opts: { dir: string; siteName: string; host?: string; urlPath?: string; realm: string; htpasswd: string },
  ): Promise<DirAuthResult> {
    const sites = await nginxSitesService.listSites(executor);
    const site = sites.find((s) => s.name === opts.siteName && s.enabled);
    if (!site) throw new Error(`El sitio nginx "${opts.siteName}" no existe o está deshabilitado`);
    const usable = (site.domains ?? []).filter(looksFqdn);
    if (usable.length === 0) {
      throw new Error(`El sitio "${opts.siteName}" no tiene un dominio público utilizable`);
    }
    // The chosen domain must belong to the site (default: its first FQDN).
    const host = opts.host && usable.includes(opts.host) ? opts.host : usable[0]!;
    if (opts.host && !usable.includes(opts.host)) {
      throw new Error(`El dominio "${opts.host}" no pertenece al sitio "${opts.siteName}"`);
    }
    const loc = normalizeUrlPath(opts.urlPath, opts.dir);

    let raw = stripPublishBlock(await nginxSitesService.readRaw(executor, site.name), opts.dir);
    const blocks = servingServerBlocks(raw);
    if (blocks.length === 0) {
      return { enforced: false, site: site.name, url: loc, publicUrl: publicUrlForHost(host, Boolean(site.ssl), loc), reason: "no-server-block" };
    }
    const block = buildPublishBlock(opts.dir, loc, opts.realm, opts.htpasswd, host);
    // Insert into each serving block, last → first so earlier offsets stay valid.
    for (const b of blocks.sort((a, c) => c.close - a.close)) {
      raw = `${raw.slice(0, b.close)}${block}\n${raw.slice(b.close)}`;
    }
    await nginxSitesService.writeSite(executor, site.name, raw);
    log.info({ site: site.name, host, url: loc, dir: opts.dir, target: executor.target.id }, "dir published via alias");
    return { enforced: true, mode: "publish", site: site.name, url: loc, publicUrl: publicUrlForHost(host, Boolean(site.ssl), loc) };
  },

  /** Remove any publish block for `dir` from whichever site carries it. */
  async unpublishDir(executor: Executor, dir: string): Promise<void> {
    const found = await findPublish(executor, dir);
    if (!found) return;
    const raw = await nginxSitesService.readRaw(executor, found.site.name);
    if (!raw.includes(startPublishMarker(dir))) return;
    await nginxSitesService.writeSite(executor, found.site.name, stripPublishBlock(raw, dir));
    log.info({ site: found.site.name, dir, target: executor.target.id }, "dir unpublished");
  },
};

/** Locate the enabled site (and URL path) that currently publishes `dir`. */
async function findPublish(
  executor: Executor,
  dir: string,
): Promise<{ site: { name: string; domains?: string[]; ssl?: boolean }; urlPath: string; host: string | null } | null> {
  // Reuse the content already fetched by listSitesWithContent — one SSH pass
  // for the whole enabled-site set instead of one extra `readRaw` per site.
  const sites = await nginxSitesService.listSitesWithContent(executor);
  return findPublishFromList(sites, dir);
}

/** Pure scan over an already-fetched (site, content) list. */
function findPublishFromList(
  sites: Array<NginxSiteSummary & { content: string }>,
  dir: string,
): { site: NginxSiteSummary; urlPath: string; host: string | null } | null {
  const marker = startPublishMarker(dir);
  for (const s of sites) {
    if (!s.enabled) continue;
    const raw = s.content;
    const idx = raw.indexOf(marker);
    if (idx === -1) continue;
    const after = raw.slice(idx);
    const m = after.match(/location\s+\^~\s+(\S+)\s*\{/);
    const urlPath = m?.[1] ?? "/";
    const hostM = after.match(/# LUXIPANEL publish-host (\S+)/);
    return { site: s, urlPath, host: hostM?.[1] ?? null };
  }
  return null;
}
