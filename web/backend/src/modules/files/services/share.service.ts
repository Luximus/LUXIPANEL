// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Temporary share links (#17) — served by the CLIENT server's nginx/PHP.
 *
 * Isolation-faithful design (no panel-host store, no public route on the panel):
 *   • The shared file is COPIED into `<docroot>/../_lxpshare_data/<token>/blob`
 *     (a sibling of the public root, NOT web-accessible).
 *   • A small PHP gatekeeper `<docroot>/_lxpshare.php` validates the token,
 *     enforces expiry / password / max-downloads, logs the client IP, and
 *     streams the blob. The public link is `https://<clientdomain>/_lxpshare.php?t=<token>`.
 *   • A panel-side sidecar (`files/shares.json`) lets the operator list/revoke.
 *
 * Security: token is random base64url and validated `[A-Za-z0-9_-]+` everywhere;
 * the blob lives outside the docroot so it's only reachable through the gate.
 */

import path from "node:path";
import bcrypt from "bcryptjs";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import { randomBase64url } from "../../../shared/utils/crypto.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { safePath } from "./filesystem.service.js";
import { exposureService } from "./exposure.service.js";
import { detectWebserverGroup } from "./webserver-group.js";
import { filesConfigService } from "./files-config.service.js";

const log = createModuleLogger("share");

const TOKEN_RE = /^[A-Za-z0-9_-]+$/;
const MAX_EXPIRY_MIN = 60 * 24 * 30; // 30 days

export interface ShareRecord {
  id: string; // token
  path: string;
  filename: string;
  root: string;
  domain: string;
  url: string;
  hasPassword: boolean;
  maxDownloads: number; // 0 = unlimited
  expiresAt: string;
  revoked?: boolean;
  createdBy?: string;
  downloadCount?: number;
  createdAt?: string;
}

const store = makeKvStore<ShareRecord>({ module: "files", collection: "shares" });

function dataBaseFor(root: string): string {
  // Sibling of the public root, not web-served.
  return path.posix.join(path.posix.dirname(root.replace(/\/+$/, "")), "_lxpshare_data");
}

/** The PHP gatekeeper (written into the public docroot). */
function gatekeeperPhp(): string {
  return [
    "<?php",
    "// LUXIPANEL share gatekeeper — do not edit.",
    "header('X-Content-Type-Options: nosniff');",
    "$t = isset($_GET['t']) ? (string)$_GET['t'] : '';",
    "if ($t === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $t)) { http_response_code(404); exit('Not found'); }",
    "$base = dirname(__DIR__) . '/_lxpshare_data/' . $t;",
    "$metaPath = $base . '/meta.json';",
    "$blobPath = $base . '/blob';",
    "if (!is_file($metaPath) || !is_file($blobPath)) { http_response_code(404); exit('Enlace no válido o expirado'); }",
    "$meta = json_decode(@file_get_contents($metaPath), true);",
    "if (!is_array($meta)) { http_response_code(404); exit('Enlace no válido'); }",
    "if (!empty($meta['revoked'])) { http_response_code(410); exit('Enlace revocado'); }",
    "if (!empty($meta['expiresAt']) && time() > (int)$meta['expiresAt']) { http_response_code(410); exit('Enlace expirado'); }",
    "if (!empty($meta['maxDownloads']) && (int)$meta['count'] >= (int)$meta['maxDownloads']) { http_response_code(410); exit('Límite de descargas alcanzado'); }",
    "if (!empty($meta['passwordHash'])) {",
    "  $p = isset($_GET['p']) ? (string)$_GET['p'] : (isset($_POST['p']) ? (string)$_POST['p'] : '');",
    "  $hash = (string)$meta['passwordHash'];",
    "  $valid = str_starts_with($hash, '$2') ? password_verify($p, $hash) : hash_equals($hash, hash('sha256', $p));",
    "  if (!$valid) {",
    "    http_response_code(401);",
    "    echo '<!doctype html><meta charset=utf-8><title>Protegido</title>';",
    "    echo '<form method=post style=\"font-family:sans-serif;max-width:320px;margin:3rem auto\">';",
    "    echo '<p>Este archivo está protegido con contraseña.</p>';",
    "    echo '<input type=password name=p placeholder=Contraseña style=\"width:100%;padding:.5rem\"> ';",
    "    echo '<button style=\"padding:.5rem 1rem;margin-top:.5rem\">Descargar</button></form>';",
    "    exit;",
    "  }",
    "}",
    "// Record the download (count + IP) with a lock.",
    "$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';",
    "$ip = trim(explode(',', $ip)[0]);",
    "$fp = fopen($metaPath, 'r+');",
    "if (!$fp || !flock($fp, LOCK_EX)) { http_response_code(503); exit('Enlace no disponible'); }",
    "$cur = json_decode(stream_get_contents($fp), true);",
    "if (!is_array($cur)) { flock($fp, LOCK_UN); fclose($fp); http_response_code(404); exit('Enlace no válido'); }",
    "if (!empty($cur['revoked']) || (!empty($cur['expiresAt']) && time() > (int)$cur['expiresAt']) ||",
    "    (!empty($cur['maxDownloads']) && (int)($cur['count'] ?? 0) >= (int)$cur['maxDownloads'])) {",
    "  flock($fp, LOCK_UN); fclose($fp); http_response_code(410); exit('Enlace expirado o agotado');",
    "}",
    "$cur['count'] = (int)($cur['count'] ?? 0) + 1;",
    "$cur['downloads'][] = ['ip' => $ip, 'at' => date('c')];",
    "if (count($cur['downloads']) > 200) { $cur['downloads'] = array_slice($cur['downloads'], -200); }",
    "ftruncate($fp, 0); rewind($fp); fwrite($fp, json_encode($cur)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);",
    "$name = isset($meta['filename']) ? preg_replace('/[\\\"\\r\\n]/', '', (string)$meta['filename']) : 'download';",
    "header('Content-Type: application/octet-stream');",
    "header('Content-Disposition: attachment; filename=\"' . $name . '\"');",
    "header('Content-Length: ' . filesize($blobPath));",
    "readfile($blobPath);",
    "",
  ].join("\n");
}

export const shareService = {
  /** Public roots the operator can publish a share under (enabled nginx vhosts). */
  async publicRoots(executor: Executor) {
    return exposureService.publicRoots(executor);
  },

  async create(
    executor: Executor,
    opts: { path: string; root: string; expiresInMin: number; password?: string; maxDownloads?: number; createdBy?: string },
  ): Promise<ShareRecord> {
    const config = await filesConfigService.get(executor);
    if (!config.sharingEnabled) throw new Error("Los enlaces compartidos están desactivados en este servidor");
    if (config.sharePasswordRequired && !opts.password) throw new Error("Este servidor exige contraseña para compartir archivos");
    if (opts.expiresInMin > config.shareMaxExpiryMin) throw new Error("La caducidad supera el máximo de este servidor");
    const safe = safePath(opts.path);
    const root = safePath(opts.root);
    const roots = await exposureService.publicRoots(executor);
    const match = roots.find((r) => r.root.replace(/\/+$/, "") === root.replace(/\/+$/, ""));
    if (!match) throw new Error("La carpeta indicada no es una raíz pública de NGINX");

    const token = randomBase64url(18).replace(/[^A-Za-z0-9_-]/g, "");
    const expiresMin = Math.min(Math.max(1, Math.round(opts.expiresInMin)), MAX_EXPIRY_MIN);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresMin * 60;
    const filename = path.posix.basename(safe.replace(/\/+$/, "")) || "download";
    const tokenDir = path.posix.join(dataBaseFor(root), token);

    // Stage the blob + meta outside the docroot (not web-served; the PHP
    // gatekeeper is the only intended reader).
    const blobPath = path.posix.join(tokenDir, "blob");
    const metaPath = path.posix.join(tokenDir, "meta.json");
    await executor.exec(quoteCmd("mkdir", ["-p", tokenDir]));
    await executor.exec(quoteCmd("cp", ["--", safe, blobPath]));
    const meta = {
      filename,
      expiresAt,
      maxDownloads: Math.max(0, Math.round(opts.maxDownloads ?? 0)),
      passwordHash: opts.password ? (await bcrypt.hash(opts.password, 12)).replace(/^\$2b\$/, "$2y$") : "",
      count: 0,
      downloads: [] as Array<{ ip: string; at: string }>,
    };
    // meta.json holds the passwordHash + the per-download IP log → it must
    // NEVER be world-readable. 0660 at creation (atomic, no chmod window):
    // owner (panel SSH user) rw + webserver group rw — the PHP gatekeeper both
    // READS it and REWRITES it (download counter/IP log), so group needs rw,
    // not just r (0640 would silently break the counter).
    await executor.writeFile(metaPath, JSON.stringify(meta), { mode: 0o660 });
    // World-read stays ONLY on what the webserver actually needs to serve:
    // the token dir (traverse) and the blob. Never `-R` (that re-exposed meta).
    try { await executor.exec(quoteCmd("chmod", ["a+rX", tokenDir, blobPath])); } catch { /* best effort */ }
    // Group-own meta.json to the webserver group so PHP can use it without
    // world-read. Best-effort: if it fails the link 404s (visible) instead of
    // leaking the meta (silent).
    const webGroup = await detectWebserverGroup(executor);
    if (webGroup) {
      try {
        await executor.exec(quoteCmd("sudo", ["chgrp", webGroup, metaPath]));
      } catch (err) {
        log.warn({ metaPath, webGroup, err: (err as Error).message }, "Could not chgrp share meta.json to the webserver group; the link will not work until fixed");
      }
    } else {
      log.warn({ metaPath }, "No webserver group detected (www-data/nginx/apache/http); share meta.json stays owner-only and the link will not work");
    }

    // Drop / refresh the gatekeeper in the docroot (idempotent).
    await executor.writeFile(path.posix.join(root, "_lxpshare.php"), gatekeeperPhp());

    const url = `${match.ssl ? "https" : "http"}://${match.domain}/_lxpshare.php?t=${token}`;
    return store(executor).set(token, {
      id: token,
      path: safe,
      filename,
      root,
      domain: match.domain,
      url,
      hasPassword: Boolean(opts.password),
      maxDownloads: meta.maxDownloads,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      revoked: false,
      createdBy: opts.createdBy,
    });
  },

  async list(executor: Executor): Promise<ShareRecord[]> {
    const all = await store(executor).list();
    // Best-effort live download counts from each token's meta.json.
    await Promise.all(all.map(async (s) => {
      if (s.revoked) return;
      try {
        const raw = await executor.readFile(path.posix.join(dataBaseFor(s.root), s.id, "meta.json"), "utf-8");
        const meta = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
        s.downloadCount = Number(meta?.count) || 0;
      } catch { s.downloadCount = s.downloadCount ?? 0; }
    }));
    return all.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  async get(executor: Executor, token: string): Promise<ShareRecord | null> {
    if (!TOKEN_RE.test(token)) return null;
    return store(executor).get(token);
  },

  async revoke(executor: Executor, token: string): Promise<boolean> {
    if (!TOKEN_RE.test(token)) return false;
    const rec = await store(executor).get(token);
    if (!rec) return false;
    // Remove the staged blob/meta so the link stops working immediately.
    const removed = await executor.exec(quoteCmd("rm", ["-rf", path.posix.join(dataBaseFor(rec.root), token)]));
    if (removed.exitCode !== 0) return false;
    await store(executor).set(token, { ...rec, revoked: true });
    return true;
  },
};
