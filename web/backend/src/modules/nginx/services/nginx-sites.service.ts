import { hostingSiteExecutor, ownedHostingSites, withGuidedHostingSite, requireGuidedHostingWrite, validateHostingSiteForm, assertHostingSiteOwned } from "./hosting-site-control.js";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX sites service — manage server blocks in
 * `/etc/nginx/sites-available` (+ `sites-enabled` symlinks) on the
 * connected target through the executor.
 *
 * Safety contract for every write:
 *   1. back up the existing file to `<file>.lxp.bak`
 *   2. write the new content
 *   3. `nginx -t`
 *   4. on failure → restore the backup, DO NOT reload, surface stderr
 *   5. on success → `systemctl reload nginx`
 *
 * The panel's sudo wrapper auto-injects credentials; `exec` does not throw
 * on a non-zero exit, so every call inspects `exitCode` explicitly.
 *
 * Sudo injection: every command runs through `sh -lc '<body>'`, which hides
 * the `sudo` token from the executor-boundary interceptor. We therefore
 * inject the credential into the body up-front via `injectSudoIntoShellScript`
 * (stored sidecar → live login passphrase). Writes never pipe content into
 * sudo's stdin (that collides with `sudo -S`); they stage the file over SFTP
 * and `sudo cp` it into place — see {@link writeSudo}.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { createHash, randomUUID } from "node:crypto";
import { quoteArg } from "../../../shared/executor/index.js";
import { ValidationError, NotFoundError, ConflictError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  sh,
  readMaybeSudo,
  writeSudo,
  reloadNginx,
  testNginxConfig,
  writeWithNginxValidation,
} from "./nginx-sudo-io.js";
import { serverNamesFromContent } from "../../../shared/nginx/server-name.js";
import { NGINX_LOG_DIR, NGINX_SNIPPETS_DIR, SITES_AVAILABLE, SITES_ENABLED } from "../nginx-constants.js";
import type { NginxSiteSummary, SiteForm, ProxyConfig } from "../models/nginx.model.js";

const log = createModuleLogger("nginx-sites");

/** @see shared/nginx/server-name.ts — the one `server_name` parser. */
const siteNamesFromContent = serverNamesFromContent;

// ── vhost fragment renderers (B-20) ─────────────────────────────────────────
// `generateConfig`, `generateProxyConfig` and `applySslToSite` each carried
// their own copy of the `server {}` head, the HTTP→HTTPS guard, the WebSocket
// upgrade headers and the five `proxy_set_header` lines. Rendering them once
// keeps the three generators byte-identical where they are meant to be.

/** `server {` + the two `listen 80` lines + `server_name`. No trailing NL. */
function renderServerOpen(serverName: string): string {
  return `server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};`;
}

/** {@link renderServerOpen} plus the per-domain access/error logs. */
function renderServerHeader(serverName: string, domain: string): string {
  return `${renderServerOpen(serverName)}

    access_log ${NGINX_LOG_DIR}/${domain}.access.log;
    error_log  ${NGINX_LOG_DIR}/${domain}.error.log;`;
}

/** The `if ($scheme = http)` redirect, or "" when not forcing HTTPS. */
function renderHttpsRedirect(force: boolean | undefined): string {
  return force
    ? `
    if ($scheme = http) { return 301 https://$host$request_uri; }`
    : "";
}

/** The three WebSocket upgrade headers, or "" when websockets are off. */
function renderWebsocketUpgrade(enabled: boolean | undefined): string {
  return enabled
    ? `
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";`
    : "";
}

/** `location / { proxy_pass … }` with the five canonical forwarded headers. */
function renderProxyLocation(target: string, websocket: boolean | undefined): string {
  return `
    location / {
        proxy_pass ${target};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;${renderWebsocketUpgrade(websocket)}
    }`;
}

/** Validated free-form directives appended inside the server block, or "". */
function renderExtraDirectives(extra: string | undefined): string {
  const trimmed = extra?.trim();
  if (!trimmed) return "";
  assertSafeNginxField(trimmed, "extraDirectives");
  return `\n    ${trimmed}`;
}

/**
 * Read many files in ONE shell `cat` loop and split the output back into a
 * per-file map. Eliminates the N round-trip cost of looping `readMaybeSudo`
 * across every site in sites-available. Uses sentinel-delimited blocks so we
 * can tolerate missing files (their block is just absent → empty string,
 * matching the prior `readMaybeSudo(...) ?? ""` behaviour).
 *
 * The shell body is argv-built via `quoteArg`, not interpolated — site file
 * names from `ls` are filtered to safe chars already, but quoting defends
 * against anything that slipped through the filter.
 */
async function readAllFiles(executor: Executor, files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (files.length === 0) return out;
  const SEP = "\n---LXP-FILE:";
  // body: for f in <quoted list>; do printf '\n---LXP-FILE:<f>---\n' "$f"; cat -- "$f" 2>/dev/null || true; done
  const body = `for f in "$@"; do printf '${SEP}%s---\\n' "$f"; cat -- "$f" 2>/dev/null || true; done`;
  const argv = ["sh", "-c", body, "_", ...files];
  let stdout = "";
  try {
    const res = await sh(executor, `sudo -n ${argv.map((a) => quoteArg(a)).join(" ")}`);
    stdout = res.stdout || "";
  } catch {
    // Bail to empty map on shell error (caller falls back to per-file read
    // when keys are missing — same observable effect as before).
    return out;
  }
  // Split back into per-file blocks. The first chunk (before any separator)
  // is dropped — it should be empty since the loop starts with `printf`.
  const parts = stdout.split(SEP);
  for (const part of parts.slice(1)) {
    const endIdx = part.indexOf("---\n");
    if (endIdx === -1) continue;
    const file = part.slice(0, endIdx);
    const body = part.slice(endIdx + 4);
    out.set(file, body);
  }
  return out;
}

// Strict input validation for fields that get interpolated raw into the
// generated nginx config. Rejects newlines, `;{}`, and other characters that
// could pivot an nginx directive into an unintended shape (e.g. server block
// injection or fastcgi_param smuggling).
const NGINX_DISALLOWED = /[\r\n;{}"`$<>|&]/;
function assertSafeNginxField(value: string, label: string): string {
  if (!value || NGINX_DISALLOWED.test(value) || value.includes("\0")) {
    throw new ValidationError(`${label} contiene caracteres no permitidos`);
  }
  return value;
}

// Validate a path-like value (root, fastcgi socket, upstream server) — no
// whitespace, no newlines, no shell/curlies.
const NGINX_PATH_DISALLOWED = /[\s\r\n;{}"`$<>|&\\]/;
function assertSafeNginxPath(value: string, label: string): string {
  if (!value || NGINX_PATH_DISALLOWED.test(value)) {
    throw new ValidationError(`${label} contiene caracteres no permitidos`);
  }
  return value;
}

// Validate an upstream `server` field — host[:port], no scheme, no scheme-less
// URL tricks. Allow letters, digits, dot, dash, underscore, colon, percent (for
// IPv6 zone IDs / port).
const UPSTREAM_SERVER_RE = /^[A-Za-z0-9._%:-]+$/;
function assertSafeUpstreamServer(value: string): string {
  if (!UPSTREAM_SERVER_RE.test(value) || value.length > 256) {
    throw new ValidationError(`upstream server inválido: ${value.slice(0, 64)}`);
  }
  return value;
}

// Validate an http(s) URL — http(s):// followed by host[:port][/path...].
// Shared by redirect and proxy_pass validation (identical rules); only the
// error label differs.
const SAFE_HTTP_URL_RE = /^https?:\/\/[A-Za-z0-9._~%-]+(?::\d+)?(?:[/?#][^\s;{}\\]`"<>|&]*)?$/;
function assertSafeHttpUrl(value: string, label: string): string {
  if (!SAFE_HTTP_URL_RE.test(value)) {
    throw new ValidationError(`${label} no es una URL http(s) válida`);
  }
  return value;
}

function assertSafeRedirectUrl(value: string): string {
  return assertSafeHttpUrl(value, "redirectTo");
}

// Same rules as redirect but the upstream is allowed to include path components.
function assertSafeProxyUrl(value: string): string {
  return assertSafeHttpUrl(value, "proxyPass");
}

// Validate a `server_name` token — domain charset + wildcard. No whitespace,
// no path-style hostnames.
const SERVER_NAME_TOKEN_RE = /^(\*\.)?[A-Za-z0-9_]([A-Za-z0-9-_.]*[A-Za-z0-9_])?$/;
function assertSafeServerNameToken(token: string): string {
  if (!SERVER_NAME_TOKEN_RE.test(token)) {
    throw new ValidationError(`server_name inválido: ${token.slice(0, 64)}`);
  }
  return token;
}

function validateServerNameList(domain: string, aliases: string[]): string {
  const tokens = [domain, ...aliases].map((s) => String(s ?? "").trim()).filter(Boolean);
  if (tokens.length === 0) {
    throw new ValidationError(`server_name vacío`);
  }
  for (const t of tokens) assertSafeServerNameToken(t);
  return tokens.join(" ");
}

function detectKind(content: string): NginxSiteSummary["kind"] {
  if (/proxy_pass\s+/i.test(content)) return "proxy";
  if (/fastcgi_pass\s+/i.test(content)) return "php";
  if (/^\s*root\s+/im.test(content)) return "static";
  if (/^\s*return\s+30[12]\s/im.test(content)) return "redirect";
  return "unknown";
}

/**
 * Backup / editor-leftover files that live next to real configs in
 * sites-available but are NOT sites (they pollute the list with duplicate
 * domains). Includes our own `.lxp.bak`, dated `.bak-…`/`.bak.…` copies, and
 * the usual editor/package leftovers. Real configs like `*.conf` are kept.
 */
function isBackupSiteFile(name: string): boolean {
  if (name.startsWith(".")) return true;
  if (name.endsWith("~")) return true;
  // .bak, .lxp.bak, .bak-2026-…, .conf.bak.2026…, .save, .orig, .swp, .old, .tmp, .dpkg-*, .rpmsave
  return /\.(bak|save|orig|swp|swo|old|tmp|rpmsave|rpmnew|dpkg-(old|dist|new))([.-][^/]*)?$/i.test(name);
}

export const nginxSitesService = {
  /** List every server block under sites-available with its enabled state. */
  async listSites(executor: Executor): Promise<NginxSiteSummary[]> {
    return (await this.listSitesWithContent(executor)).map(({ content: _content, ...rest }) => rest);
  },

  /**
   * Same as {@link listSites} but ALSO returns the raw file content for each
   * site in the same pass — so callers that re-parse the file (e.g.
   * {@link listUpstreams}, {@link findPublish}, status checks) don't pay a
   * second per-file SSH read. Old call sites that don't need the content
   * still go through {@link listSites}.
   */
  async listSitesWithContent(
    executor: Executor,
  ): Promise<Array<NginxSiteSummary & { content: string }>> {
    const ls = await sh(executor, `sudo -n ls -1 -- ${quoteArg(SITES_AVAILABLE)} 2>/dev/null || ls -1 -- ${quoteArg(SITES_AVAILABLE)} 2>/dev/null`);
    const names = ls.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n) => !isBackupSiteFile(n));

    const enabledLs = await sh(executor, `sudo -n ls -1 -- ${quoteArg(SITES_ENABLED)} 2>/dev/null || ls -1 -- ${quoteArg(SITES_ENABLED)} 2>/dev/null`);
    const enabledSet = new Set(enabledLs.stdout.split("\n").map((s) => s.trim()).filter(Boolean));

    // Batch read: collapse N file reads (one per site, sequential in the old
    // implementation) into ONE shell loop. Separator `\n---LXP-FILE:<name>---\n`
    // lets us split the result back into per-file blocks without a separate
    // stat call. Bail-out: missing files surface as empty content (matches the
    // old `readMaybeSudo(... ) ?? ""` behavior).
    const files = names.map((n) => `${SITES_AVAILABLE}/${n}`);
    const fileMap = await readAllFiles(executor, files);

    const sites: Array<NginxSiteSummary & { content: string }> = [];
    for (const name of names) {
      const file = `${SITES_AVAILABLE}/${name}`;
      const content = fileMap.get(file) ?? "";
      const rootMatch = content.match(/^\s*root\s+([^;]+);/im);
      const proxyMatch = content.match(/proxy_pass\s+([^;]+);/i);
      sites.push({
        name,
        file,
        enabled: enabledSet.has(name),
        domains: siteNamesFromContent(content),
        root: rootMatch?.[1]?.trim() ?? null,
        proxyPass: proxyMatch?.[1]?.trim() ?? null,
        ssl: /listen\s+(\[::\]:)?443\b|ssl_certificate\s+/i.test(content),
        kind: detectKind(content),
        content,
      });
    }
    return sites.sort((a, b) => a.name.localeCompare(b.name));
  },

  async readRaw(executor: Executor, name: string): Promise<string> {
    const content = await readMaybeSudo(executor, `${SITES_AVAILABLE}/${name}`);
    if (content === null) throw new NotFoundError(`Sitio ${name}`);
    return content;
  },

  /** Validate the running config; returns combined `nginx -t` output. */
  async testConfig(executor: Executor): Promise<{ ok: boolean; output: string }> {
    return testNginxConfig(executor);
  },

  async reload(executor: Executor): Promise<void> {
    const res = await reloadNginx(executor);
    if (!res.ok) {
      throw new ValidationError(`La configuración es válida, pero NGINX no se recargó: ${res.output}`);
    }
  },

  /**
   * Write a site config under the safety contract (backup → write →
   * `nginx -t` → restore-on-fail → reload-on-success), implemented once in
   * `nginx-sudo-io#writeWithNginxValidation`.
   */
  async writeSite(executor: Executor, name: string, content: string, opts: { reload?: boolean; expectedRevision?: string } = {}): Promise<void> {
    const file = `${SITES_AVAILABLE}/${name}`;
    if (opts.expectedRevision) {
      const current = await this.readRaw(executor, name);
      const actual = createHash("sha256").update(current).digest("hex");
      if (actual !== opts.expectedRevision) throw new ConflictError("El sitio cambió desde que abriste el editor. Recarga antes de guardar.");
    }
    await writeWithNginxValidation(executor, [{ path: file, content }], {
      reload: opts.reload,
      restoreFailedMessage: (testOutput, restoreOutput) =>
        `Configuración nginx inválida y ADEMÁS falló la restauración del backup del sitio "${name}" — revisa el servidor:\n${testOutput}\n${restoreOutput}`,
    });
    log.info({ name, target: executor.target.id }, "nginx site written");
  },

  async setEnabled(executor: Executor, name: string, enabled: boolean): Promise<void> {
    const avail = `${SITES_AVAILABLE}/${name}`;
    const link = `${SITES_ENABLED}/${name}`;
    if ((await readMaybeSudo(executor, avail)) === null) throw new NotFoundError(`Sitio ${name}`);

    const wasEnabled = (await sh(executor, `sudo -n test -L ${quoteArg(link)}`)).exitCode === 0;
    if (wasEnabled === enabled) return;
    const change = enabled
      ? await sh(executor, `sudo -n ln -sfn -- ${quoteArg(avail)} ${quoteArg(link)}`)
      : await sh(executor, `sudo -n rm -f -- ${quoteArg(link)}`);
    if (change.exitCode !== 0) throw new ValidationError(`No se pudo ${enabled ? "activar" : "desactivar"} el sitio ${name}: ${change.stderr || change.stdout}`);
    const restore = async () => {
      const cmd = wasEnabled
        ? `sudo -n ln -sfn -- ${quoteArg(avail)} ${quoteArg(link)}`
        : `sudo -n rm -f -- ${quoteArg(link)}`;
      const result = await sh(executor, cmd);
      if (result.exitCode !== 0) throw new ValidationError(`No se pudo restaurar el estado del sitio ${name}: ${result.stderr || result.stdout}`);
    };
    const test = await this.testConfig(executor);
    if (!test.ok) {
      await restore();
      throw new ValidationError(`nginx -t falló, se revirtió el cambio:\n${test.output}`);
    }
    try { await this.reload(executor); }
    catch (error) { await restore(); throw error; }
  },

  async deleteSite(executor: Executor, name: string): Promise<void> {
    const avail = `${SITES_AVAILABLE}/${name}`;
    if ((await readMaybeSudo(executor, avail)) === null) throw new NotFoundError(`Sitio ${name}`);
    const link = `${SITES_ENABLED}/${name}`;
    const backup = `${avail}.lxp.bak-${randomUUID()}`;
    const wasEnabled = (await sh(executor, `sudo -n test -L ${quoteArg(link)}`)).exitCode === 0;
    const stage = await sh(executor, `sudo -n mv -- ${quoteArg(avail)} ${quoteArg(backup)}`);
    if (stage.exitCode !== 0) throw new ValidationError(`No se pudo preparar el borrado de ${name}: ${stage.stderr || stage.stdout}`);
    try {
      if (wasEnabled) {
        const unlink = await sh(executor, `sudo -n rm -f -- ${quoteArg(link)}`);
        if (unlink.exitCode !== 0) throw new ValidationError(`No se pudo desactivar ${name}: ${unlink.stderr || unlink.stdout}`);
      }
      const test = await this.testConfig(executor);
      if (!test.ok) throw new ValidationError(`nginx -t falló tras eliminar ${name}: ${test.output}`);
      await this.reload(executor);
    } catch (error) {
      const restore = await sh(executor, `sudo -n mv -- ${quoteArg(backup)} ${quoteArg(avail)}`);
      if (restore.exitCode !== 0) throw new ValidationError(`No se pudo restaurar ${name}: ${restore.stderr || restore.stdout}`);
      if (wasEnabled) {
        const relink = await sh(executor, `sudo -n ln -sfn -- ${quoteArg(avail)} ${quoteArg(link)}`);
        if (relink.exitCode !== 0) throw new ValidationError(`No se pudo reactivar ${name}: ${relink.stderr || relink.stdout}`);
      }
      throw error;
    }
    const cleanup = await sh(executor, `sudo -n rm -f -- ${quoteArg(backup)}`);
    if (cleanup.exitCode !== 0) log.warn({ name, backup }, "NGINX backup cleanup failed after delete");
    log.info({ name, target: executor.target.id }, "nginx site deleted");
  },

  async createSiteRaw(executor: Executor, name: string, content: string, enabled: boolean): Promise<void> {
    const existing = await readMaybeSudo(executor, `${SITES_AVAILABLE}/${name}`);
    if (existing !== null) {
      // Idempotent: if the stored content already matches, treat as success so
      // a retry after a timeout doesn't surface a 409 for a completed operation.
      if (existing.trim() === content.trim()) return;
      throw new ConflictError(`El sitio ${name} ya existe`);
    }
    await this.writeSite(executor, name, content, { reload: false });
    if (enabled) await this.setEnabled(executor, name, true);
    else await this.reload(executor);
  },

  async createSiteForm(executor: Executor, form: SiteForm, enabled: boolean): Promise<string> {
    const name = form.domain;
    const existing = await readMaybeSudo(executor, `${SITES_AVAILABLE}/${name}`);
    if (existing !== null) {
      const content = this.generateConfig(form);
      // Idempotent: same config already on disk → treat as success.
      if (existing.trim() === content.trim()) return name;
      throw new ConflictError(`El sitio ${name} ya existe`);
    }
    const content = this.generateConfig(form);
    await this.writeSite(executor, name, content, { reload: false });
    if (enabled) await this.setEnabled(executor, name, true);
    else await this.reload(executor);
    return name;
  },

  async updateSiteForm(executor: Executor, name: string, form: SiteForm, expectedRevision?: string): Promise<void> {
    const current = await readMaybeSudo(executor, `${SITES_AVAILABLE}/${name}`);
    if (current === null) {
      throw new NotFoundError(`Sitio ${name}`);
    }
    if (!this.parseManagedForm(current)) {
      throw new ConflictError("El sitio contiene directivas que el formulario no representa. Ábrelo en el editor avanzado para conservarlas.");
    }
    await this.writeSite(executor, name, this.generateConfig(form), { expectedRevision });
  },

  /** Build a server block from the guided form. */
  generateConfig(form: SiteForm): string {
    // Validate every field that gets interpolated raw into the generated
    // nginx config. nginx itself gates this with `nginx -t`, but we reject
    // obvious payload shape up front so a malformed config never reaches the
    // disk write step.
    const serverName = validateServerNameList(form.domain, form.aliases);
    const domain = assertSafeServerNameToken(form.domain);

    if (form.redirectTo) {
      const redirectUrl = assertSafeRedirectUrl(form.redirectTo);
      return `# Generado por LUXIPANEL — redirección
${renderServerOpen(serverName)}
    return 301 ${redirectUrl}$request_uri;
}
`;
    }

    let body: string;
    if (form.kind === "proxy") {
      const proxyPass = form.proxyPass ? assertSafeProxyUrl(form.proxyPass) : "http://127.0.0.1:3000";
      body = renderProxyLocation(proxyPass, form.websocket);
    } else if (form.kind === "php") {
      const root = form.root ? assertSafeNginxPath(form.root, "root") : `/var/www/${domain}`;
      const phpSocket = form.phpSocket ? assertSafeNginxPath(form.phpSocket, "phpSocket") : "unix:/run/php/php-fpm.sock";
      body = `
    root ${root};
    index index.php index.html;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass ${phpSocket};
    }`;
    } else {
      const root = form.root ? assertSafeNginxPath(form.root, "root") : `/var/www/${domain}`;
      body = `
    root ${root};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }`;
    }

    const httpsRedirect = renderHttpsRedirect(form.forceHttps);
    const extra = renderExtraDirectives(form.extraDirectives);

    return `# Generado por LUXIPANEL — editable en modo avanzado
${renderServerHeader(serverName, domain)}${httpsRedirect}
${body}${extra}
}
`;
  },

  /** Only round-trip a form if every byte belongs to the known generator. */
  parseManagedForm(content: string): SiteForm | null {
    if (!content.startsWith("# Generado por LUXIPANEL — editable en modo avanzado\n")) return null;
    const names = /^\s*server_name\s+([^;]+);/m.exec(content)?.[1]?.trim().split(/\s+/) ?? [];
    const [domain, ...aliases] = names;
    // HTTPS redirection also contains a `return 301` directive. Determine the
    // managed site kind from its serving location, not the redirect guard.
    const kind = /\bproxy_pass\s+/i.test(content) ? "proxy"
      : /\bfastcgi_pass\s+/i.test(content) ? "php"
      : /^\s*root\s+/m.test(content) ? "static" : "unknown";
    if (!domain || (kind !== "static" && kind !== "php" && kind !== "proxy")) return null;
    const form: SiteForm = {
      kind,
      domain,
      aliases,
      root: /^\s*root\s+([^;]+);/m.exec(content)?.[1]?.trim(),
      phpSocket: /^\s*fastcgi_pass\s+([^;]+);/m.exec(content)?.[1]?.trim(),
      proxyPass: /^\s*proxy_pass\s+([^;]+);/m.exec(content)?.[1]?.trim(),
      websocket: /proxy_set_header\s+Upgrade\s+/i.test(content),
      forceHttps: /if\s*\(\$scheme\s*=\s*http\)/.test(content),
    };
    return this.generateConfig(form).trim() === content.trim() ? form : null;
  },

  /** Build a reverse-proxy server block (optionally with an upstream pool). */
  generateProxyConfig(cfg: ProxyConfig): string {
    const serverName = validateServerNameList(cfg.domain, cfg.aliases);
    const domain = assertSafeServerNameToken(cfg.domain);
    const slug = domain.replace(/[^a-z0-9]/gi, "_");
    let target: string;
    let upstreamBlock = "";

    if (cfg.upstreams.length === 1) {
      const u = cfg.upstreams[0]!;
      if (/^https?:\/\//.test(u.server)) {
        target = assertSafeProxyUrl(u.server);
      } else {
        target = `http://${assertSafeUpstreamServer(u.server)}`;
      }
    } else {
      const lb = cfg.balance === "round_robin" ? "" : `    ${cfg.balance};\n`;
      const servers = cfg.upstreams
        .map((u) => `    server ${assertSafeUpstreamServer(u.server.replace(/^https?:\/\//, ""))}${u.weight ? ` weight=${u.weight}` : ""};`)
        .join("\n");
      upstreamBlock = `upstream ${slug}_pool {\n${lb}${servers}\n}\n\n`;
      target = `http://${slug}_pool`;
    }

    const httpsRedirect = renderHttpsRedirect(cfg.forceHttps);
    const extra = renderExtraDirectives(cfg.extraDirectives);

    return `# Generado por LUXIPANEL — reverse proxy
${upstreamBlock}${renderServerHeader(serverName, domain)}${httpsRedirect}
${renderProxyLocation(target, cfg.websocket)}${extra}
}
`;
  },

  /** List `upstream {}` pools declared across enabled configs. */
  async listUpstreams(executor: Executor): Promise<Array<{ name: string; servers: string[]; file: string }>> {
    // Reuse the content already fetched by listSitesWithContent — one SSH pass
    // total instead of one extra per-file re-read per pool.
    const sites = await this.listSitesWithContent(executor);
    const pools: Array<{ name: string; servers: string[]; file: string }> = [];
    for (const s of sites) {
      for (const m of s.content.matchAll(/upstream\s+([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g)) {
        const servers = [...(m[2] ?? "").matchAll(/server\s+([^;]+);/g)].map((x) => x[1]!.trim());
        pools.push({ name: m[1]!, servers, file: s.file });
      }
    }
    return pools;
  },

  /** Inject TLS directives for an already-issued cert into a site. */
  async applySslToSite(executor: Executor, name: string, certPath: string, keyPath: string): Promise<void> {
    const content = await this.readRaw(executor, name);
    if (/ssl_certificate\s+/i.test(content)) {
      log.info({ name }, "site already has ssl_certificate, skipping injection");
      return;
    }
    const domains = siteNamesFromContent(content).join(" ") || name;
    const tlsBlock = `
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${domains};

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;

    include ${NGINX_SNIPPETS_DIR}/lxp-${name}-body.conf;
}
`;
    // Extract the first server block body so HTTP and HTTPS share it.
    const bodyMatch = content.match(/server\s*\{([\s\S]*?)\n\}/);
    const body = bodyMatch?.[1] ?? "";
    await writeSudo(executor, `${NGINX_SNIPPETS_DIR}/lxp-${name}-body.conf`, body.trim() + "\n").catch(() => undefined);

    const httpRedirect = `# Generado por LUXIPANEL — HTTP→HTTPS
${renderServerOpen(domains)}
    return 301 https://$host$request_uri;
}
`;
    await this.writeSite(executor, name, httpRedirect + tlsBlock);
  },
};

// Bounded hosting recipes use the server identity solely for their own
// generated vhosts. Every read is filtered before it leaves this service.
for (const method of ["listSitesWithContent", "readRaw", "createSiteForm", "updateSiteForm", "writeSite", "setEnabled", "deleteSite"] as const) {
  const original = nginxSitesService[method] as (executor: Executor, ...args: any[]) => Promise<any>;
  (nginxSitesService as unknown as Record<string, (...args: any[]) => Promise<any>>)[method] = async (executor: Executor, ...args: any[]) => {
    const service = hostingSiteExecutor(executor);
    if (method === "listSitesWithContent") return ownedHostingSites(await original.call(nginxSitesService, service, ...args));
    if (method === "writeSite") requireGuidedHostingWrite();
    if (["readRaw", "updateSiteForm", "setEnabled", "deleteSite"].includes(method)) assertHostingSiteOwned(await nginxSitesService.listSites(service), args[0]);
    if (method === "createSiteForm" || method === "updateSiteForm") {
      const index = method === "createSiteForm" ? 0 : 1;
      args[index] = validateHostingSiteForm(args[index]);
      return withGuidedHostingSite(() => original.call(nginxSitesService, service, ...args));
    }
    return original.call(nginxSitesService, service, ...args);
  };
}
