// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Web exposure scanner (#3 + #16).
 *
 * Cross-references the nginx vhosts (document roots + server names) with a scan
 * for sensitive files inside those public roots, so the user sees which files
 * are reachable from the internet and how risky each one is. Also offers a
 * SSRF-safe "probe" (fetch the file's public URL from the panel host, but only
 * for the client's own configured domains) and a `.htaccess` block action.
 *
 * Everything filesystem-side runs through the request `Executor`.
 */

import path from "node:path";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { nginxSitesService } from "../../nginx/services/index.js";
import { safePath } from "./filesystem.service.js";
import { snapshotService } from "./snapshot.service.js";
import { invalidateDir, invalidateFile, invalidateStat } from "../../../shared/files-cache/index.js";

export type ExposureRisk = "high" | "medium";

export interface PublicRoot {
  root: string;
  domain: string;
  ssl: boolean;
}

export interface ExposureFinding {
  path: string;
  name: string;
  root: string;
  domain: string;
  url: string;
  risk: ExposureRisk;
  reason: string;
}

export interface ExposureScanResult {
  findings: ExposureFinding[];
  rootsScanned: PublicRoot[];
  truncated: boolean;
}

export interface ExposureProbeResult {
  url: string;
  status: number;
  accessible: boolean;
  error?: string;
}

const SCAN_DEPTH = 6;
const MAX_FINDINGS = 500;
const FIND_TIMEOUT_MS = 25_000;
const EXPOSURE_PROBE_TIMEOUT_MS = 6_000;

// Sensitive file rules. `match` runs against the lowercased basename.
const RULES: Array<{ match: (n: string) => boolean; risk: ExposureRisk; reason: string }> = [
  { match: (n) => n === ".env" || n.startsWith(".env."), risk: "high", reason: "Variables de entorno y secretos" },
  { match: (n) => n === "id_rsa" || n === "id_dsa" || n.endsWith(".pem") || n.endsWith(".key") || n.endsWith(".ppk"), risk: "high", reason: "Clave privada" },
  { match: (n) => n.endsWith(".sql") || n.endsWith(".sql.gz") || n.endsWith(".dump"), risk: "high", reason: "Volcado de base de datos" },
  { match: (n) => n === ".htpasswd", risk: "high", reason: "Credenciales de acceso (htpasswd)" },
  { match: (n) => n.endsWith(".bak") || n.endsWith(".old") || n.endsWith(".orig") || n.endsWith(".save") || n.endsWith("~"), risk: "high", reason: "Copia de respaldo de un archivo (posible código/credenciales)" },
  { match: (n) => n.endsWith(".zip") || n.endsWith(".tar") || n.endsWith(".tar.gz") || n.endsWith(".tgz") || n.endsWith(".rar") || n.endsWith(".7z"), risk: "medium", reason: "Posible backup descargable" },
  { match: (n) => n === "config.php" || n === "configuration.php" || n === "settings.php" || n === "wp-config.php.bak", risk: "high", reason: "Configuración con posibles credenciales" },
  { match: (n) => n === "composer.json" || n === "composer.lock" || n === "package.json" || n === "package-lock.json" || n === "yarn.lock", risk: "medium", reason: "Revela dependencias y versiones (huella para atacantes)" },
];

// The -iname globs handed to find (broad; precise risk is decided by RULES).
const FIND_GLOBS = [
  ".env", ".env.*", "*.bak", "*.old", "*.orig", "*.save", "*~",
  "*.sql", "*.sql.gz", "*.dump", "*.zip", "*.tar.gz", "*.tgz", "*.tar", "*.rar", "*.7z",
  "id_rsa", "id_dsa", "*.pem", "*.key", "*.ppk", ".htpasswd",
  "config.php", "configuration.php", "settings.php", "wp-config.php.bak",
  "composer.json", "composer.lock", "package.json", "package-lock.json", "yarn.lock",
];

function classify(name: string): { risk: ExposureRisk; reason: string } | null {
  const lower = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.match(lower)) return { risk: rule.risk, reason: rule.reason };
  }
  return null;
}

function looksFqdn(domain: string): boolean {
  if (!domain || domain === "_" || domain === "localhost") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) return false; // bare IP
  if (domain.startsWith("127.") || domain.startsWith("0.")) return false;
  return domain.includes(".");
}

function urlFor(root: PublicRoot, filePath: string): string {
  const rel = filePath.startsWith(root.root) ? filePath.slice(root.root.length).replace(/^\/+/, "") : path.posix.basename(filePath);
  return `${root.ssl ? "https" : "http"}://${root.domain}/${rel}`;
}

export const exposureService = {
  /** Enabled file-serving vhosts (skips reverse proxies) as {root, domain, ssl}. */
  async publicRoots(executor: Executor): Promise<PublicRoot[]> {
    const sites = await nginxSitesService.listSites(executor);
    const seen = new Set<string>();
    const roots: PublicRoot[] = [];
    for (const site of sites) {
      if (!site.enabled || !site.root || site.proxyPass) continue;
      const domain = site.domains.find(looksFqdn) || site.domains[0] || "";
      if (seen.has(site.root)) continue;
      seen.add(site.root);
      roots.push({ root: site.root, domain, ssl: site.ssl });
    }
    return roots;
  },

  /** Scan public roots for sensitive files, classified by risk. */
  async scan(executor: Executor, canReadRoot: (path: string) => boolean = () => true): Promise<ExposureScanResult> {
    const roots = (await this.publicRoots(executor)).filter((root) => canReadRoot(root.root));
    const findings: ExposureFinding[] = [];
    let truncated = false;

    for (const root of roots) {
      if (findings.length >= MAX_FINDINGS) { truncated = true; break; }
      let safe: string;
      try {
        safe = safePath(root.root);
      } catch {
        continue; // root outside allowed bases
      }
      // Build: find <root> -maxdepth N -not -path '*/node_modules/*' -not -path '*/vendor/*'
      //   \( -type f \( -iname a -o -iname b … \) -o -type d -name .git \) | head
      // `-iname a -o -iname b -o … -iname z` (the trailing `-o` is sliced off).
      const nameArgs = FIND_GLOBS.flatMap((glob) => ["-iname", glob, "-o"]).slice(0, -1);
      const args = [
        safe, "-maxdepth", String(SCAN_DEPTH),
        "-not", "-path", "*/node_modules/*", "-not", "-path", "*/vendor/*",
        "(",
          "(", "-type", "f", "(", ...nameArgs, ")", ")",
          "-o", "(", "-type", "d", "-name", ".git", ")",
        ")",
        "-print",
      ];
      const cmd = `${quoteCmd("find", args)} 2>/dev/null | head -n ${MAX_FINDINGS}`;
      let out;
      try {
        out = await executor.exec(cmd, { timeoutMs: FIND_TIMEOUT_MS });
      } catch {
        continue;
      }
      for (const line of out.stdout.split("\n")) {
        const filePath = line.trim();
        if (!filePath) continue;
        if (findings.length >= MAX_FINDINGS) { truncated = true; break; }
        const name = path.posix.basename(filePath);
        const cls = name === ".git"
          ? { risk: "high" as ExposureRisk, reason: "Repositorio Git expuesto (código fuente e historial)" }
          : classify(name);
        if (!cls) continue;
        findings.push({
          path: filePath,
          name,
          root: root.root,
          domain: root.domain,
          url: urlFor(root, filePath),
          risk: cls.risk,
          reason: cls.reason,
        });
      }
    }

    // High-risk first, then by path.
    const rank = (r: ExposureRisk): number => (r === "high" ? 0 : 1);
    findings.sort((a, b) => rank(a.risk) - rank(b.risk) || a.path.localeCompare(b.path));
    return { findings, rootsScanned: roots, truncated };
  },

  /**
   * Probe a file's public URL from the panel host. SSRF-safe: the URL is
   * recomputed server-side from the file's containing public root, and only
   * FQDN client domains are fetched (no arbitrary host).
   */
  async probe(executor: Executor, filePath: string): Promise<ExposureProbeResult> {
    const safe = safePath(filePath);
    const roots = await this.publicRoots(executor);
    // Longest matching root wins (most specific vhost).
    const match = roots
      .filter((r) => safe === r.root || safe.startsWith(r.root.replace(/\/+$/, "") + "/"))
      .sort((a, b) => b.root.length - a.root.length)[0];
    if (!match) throw new Error("El archivo no está dentro de una raíz pública conocida");
    if (!looksFqdn(match.domain)) {
      return { url: urlFor(match, safe), status: 0, accessible: false, error: "Dominio no comprobable (no es un FQDN público)" };
    }
    const url = urlFor(match, safe);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXPOSURE_PROBE_TIMEOUT_MS);
    try {
      const resp = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal });
      return { url, status: resp.status, accessible: resp.status > 0 && resp.status < 400 };
    } catch (err) {
      return { url, status: 0, accessible: false, error: (err as Error).message };
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Block a file via `.htaccess` (Apache). Snapshots the .htaccess first, then
   * appends a `<Files>` deny rule (creating the file if needed). On nginx this
   * is inert — the UI flags that.
   */
  async blockHtaccess(executor: Executor, filePath: string): Promise<{ htaccess: string }> {
    const safe = safePath(filePath);
    const dir = path.posix.dirname(safe);
    const name = path.posix.basename(safe);
    const htaccess = path.posix.join(dir, ".htaccess");

    let current = "";
    try {
      const raw = await executor.readFile(htaccess, "utf-8");
      current = typeof raw === "string" ? raw : raw.toString("utf-8");
    } catch {
      current = "";
    }
    const marker = `# LUXIPANEL: bloqueo de exposición — ${name}`;
    if (current.includes(marker)) return { htaccess };

    const rule = `${current.trimEnd()}\n\n${marker}\n<Files ${JSON.stringify(name)}>\n  Require all denied\n</Files>\n`;
    // Safe-changes: snapshot the .htaccess (or its absence) before writing.
    await snapshotService.capture(executor, htaccess, "edit");
    await executor.writeFile(htaccess, rule, { encoding: "utf-8" });
    void invalidateDir(executor, htaccess);
    void invalidateFile(executor, htaccess);
    void invalidateStat(executor, htaccess);
    return { htaccess };
  },
};
