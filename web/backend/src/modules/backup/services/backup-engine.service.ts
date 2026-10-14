// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Backup engine — PostgreSQL dump + file tar.gz snapshot.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { mailConfig } from "../../../config/mail.js";
import { panelConfigDir } from "../../../config/paths.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { injectSudoIntoShellScript } from "../../../shared/system/sudo-runtime.js";

const log = createModuleLogger("backup-engine");

/** Where finished archives live on the CONNECTED TARGET (matches the dir the
 *  backups controller lists/deletes from). */
export const TARGET_BACKUP_DIR = "/var/backups/luxipanel";

/** Curated filesystem paths included when "full server" is selected (besides
 *  databases + mail, which are toggled on too). Kept conservative on purpose:
 *  config, user data and web roots — NOT a raw `/` image. */
export const FULL_SERVER_PATHS = ["/etc", "/home", "/var/www", "/root"];

/** Directory names excluded from the file `tar` everywhere they appear: bulky
 *  and regenerable (deps, build output, caches) or VCS history. Excluding them
 *  keeps archives small and avoids the symlink farms (pnpm `node_modules`) that
 *  break extraction on filesystems without symlink support (e.g. Windows). */
export const BACKUP_EXCLUDES = ["node_modules", ".git", "dist", ".cache", ".pnpm-store"];

export interface BackupResult {
  archivePath: string;
  sizeBytes: number;
  /** Cloud destination URI when the archive was offloaded to S3/R2. */
  remoteUri?: string;
  /** Human-readable reason when a requested cloud offload did not happen. */
  remoteError?: string;
}

/** A single database picked for backup, tagged by its engine. */
export interface DatabaseSelection {
  engine: "mysql" | "postgresql";
  name: string;
}

/** Selectable backup sources, all collected on the connected target. */
export interface TargetBackupSources {
  /** Include a `databases/` member. With no {@link databaseSelections} this
   *  dumps every schema (`mysqldump --all-databases` + `pg_dumpall`); with
   *  selections it dumps only the named databases per engine. */
  includeDatabases?: boolean;
  /** Restrict the DB dump to these specific databases (per engine). Ignored
   *  when empty → all databases are dumped. */
  databaseSelections?: DatabaseSelection[];
  /** vmail store + `/etc/postfix` + `/etc/dovecot`. */
  includeMail?: boolean;
  /** `${LUXIPANEL_CONFIG_DIR}` sidecars (default `/etc/luxipanel`). */
  includePanelConfig?: boolean;
  /** Extra absolute filesystem paths to snapshot. */
  includePaths?: string[];
  /** Curated full-server snapshot: forces databases + mail + panel config on
   *  and adds {@link FULL_SERVER_PATHS}. */
  fullServer?: boolean;
}

/** A resolved cloud destination to push the finished archive to (from the
 *  target itself, via its `aws` CLI). */
export interface RemoteStorage {
  provider: "s3" | "r2";
  bucket: string;
  endpoint?: string;
  region?: string;
  prefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Build the shell script that assembles a `.tar.gz` ENTIRELY on the connected
 * target, before sudo-password injection. Pure + exported so it can be
 * unit-tested without an executor.
 *
 * Performance: file sources (mail store, config dirs, extra paths) are streamed
 * straight into `tar` IN PLACE — never copied to a staging dir first — so a
 * large `/var/vmail` is read once, not duplicated to disk before compression.
 * Only the DB dumps are staged (they have to be produced as files). Archive
 * members are stored relative to `/` (e.g. `var/vmail`, `etc/postfix`) so a
 * restore lands back at the original paths; DB dumps live under `databases/`.
 *
 * Every privileged step sits at a command position (start of line or after
 * `&&` / `;` / newline) so {@link injectSudoIntoShellScript} can rewrite the
 * `sudo -n` token to feed the stored credential. Optional sources are
 * best-effort (`… || true`) so a missing engine/path never aborts the archive.
 */
export function buildTargetBackupScript(
  archivePath: string,
  sources: TargetBackupSources,
  paths: { vmailBase: string; panelConfigDir: string },
  remoteStorage?: RemoteStorage | null,
): string {
  // "Full server" forces the standard sources on and adds curated paths.
  const includeDatabases = sources.includeDatabases || sources.fullServer;
  const includeMail = sources.includeMail || sources.fullServer;
  const includePanelConfig = sources.includePanelConfig || sources.fullServer;

  // Paths tarred in place. Restricted to a shell-safe charset (no spaces /
  // metacharacters) so they can be word-split into the `tar` argument list.
  const SAFE = /^\/[A-Za-z0-9._/-]+$/;
  const inPlace: string[] = [];
  if (includeMail) inPlace.push(paths.vmailBase, "/etc/postfix", "/etc/dovecot");
  if (includePanelConfig) inPlace.push(paths.panelConfigDir);
  if (sources.fullServer) inPlace.push(...FULL_SERVER_PATHS);
  inPlace.push(...(sources.includePaths ?? []));
  // De-dup while preserving order (full-server may overlap mail/config paths).
  const realPaths = [...new Set(inPlace)].filter((p) => SAFE.test(p));

  // Database names safe to interpolate into a shell command (skip anything odd).
  const DB_NAME_SAFE = /^[A-Za-z0-9_][A-Za-z0-9_$-]*$/;
  const selections = (sources.databaseSelections ?? []).filter((s) => DB_NAME_SAFE.test(s.name));
  const mysqlNames = selections.filter((s) => s.engine === "mysql").map((s) => s.name);
  const pgNames = selections.filter((s) => s.engine === "postgresql").map((s) => s.name);
  const hasSelection = mysqlNames.length > 0 || pgNames.length > 0;

  const q = quoteArg(archivePath);
  // `--exclude` must precede the files it applies to; wildcard matches slashes
  // in GNU tar so `*/node_modules` skips that dir (and subtree) at any depth.
  const excludeFlags = BACKUP_EXCLUDES.map((n) => `--exclude='*/${n}'`).join(" ");
  const lines: string[] = [
    "set -u",
    'stage="$(mktemp -d /tmp/luxipanel-backup.XXXXXXXX)"',
    "has_db=0",
    'rel=""',
  ];

  if (includeDatabases) {
    lines.push('mkdir -p "$stage/databases"');
    if (hasSelection) {
      // Dump only the named databases per engine.
      if (mysqlNames.length > 0) {
        const names = mysqlNames.map((n) => quoteArg(n)).join(" ");
        lines.push(
          `command -v mysqldump >/dev/null 2>&1 && sudo -n mysqldump --single-transaction --routines --triggers --events --databases ${names} > "$stage/databases/mysql.sql" 2>/dev/null || true`,
        );
      }
      for (const name of pgNames) {
        // Per-database dump; file name sanitised to the safe charset.
        const safeFile = name.replace(/[^A-Za-z0-9_-]/g, "_");
        lines.push(
          `command -v pg_dump >/dev/null 2>&1 && sudo -n -u postgres pg_dump ${quoteArg(name)} > "$stage/databases/pg-${safeFile}.sql" 2>/dev/null || true`,
        );
      }
    } else {
      // MySQL / MariaDB — root via unix_socket (sudo), all schemas in one dump.
      lines.push(
        'command -v mysqldump >/dev/null 2>&1 && sudo -n mysqldump --single-transaction --routines --triggers --events --all-databases > "$stage/databases/all-mysql.sql" 2>/dev/null || true',
      );
      // PostgreSQL — peer auth as the postgres role (sudo -u postgres).
      lines.push(
        'command -v pg_dumpall >/dev/null 2>&1 && sudo -n -u postgres pg_dumpall > "$stage/databases/all-postgresql.sql" 2>/dev/null || true',
      );
    }
    // Keep the databases/ member only if some dump actually produced output.
    lines.push('if find "$stage/databases" -type f -size +0c 2>/dev/null | grep -q .; then has_db=1; else rm -rf "$stage/databases"; fi');
  }

  // Accumulate existing in-place paths as relative-to-/ tar members.
  for (const p of realPaths) {
    const relMember = p.replace(/^\/+/, "");
    lines.push(`test -e ${quoteArg(p)} && rel="$rel ${relMember}" || true`);
  }

  lines.push(`sudo -n mkdir -p ${quoteArg(path.posix.dirname(archivePath))}`);
  // gzip archive; sudo so tar can read root-owned mail/config/DB dumps. `-C`
  // switches the base dir between the staged dumps and the in-place paths.
  lines.push('if [ "$has_db" = 1 ] && [ -n "$rel" ]; then');
  lines.push(`  sudo -n tar -czf ${q} ${excludeFlags} -C "$stage" databases -C / $rel`);
  lines.push('elif [ "$has_db" = 1 ]; then');
  lines.push(`  sudo -n tar -czf ${q} -C "$stage" databases`);
  lines.push('elif [ -n "$rel" ]; then');
  lines.push(`  sudo -n tar -czf ${q} ${excludeFlags} -C / $rel`);
  lines.push("else");
  // Nothing selected/found — still emit a valid (near-empty) gzip so the job
  // completes rather than tar erroring on an empty archive.
  lines.push('  : > "$stage/EMPTY"');
  lines.push(`  sudo -n tar -czf ${q} -C "$stage" EMPTY`);
  lines.push("fi");
  // Archives may hold DB dumps / secrets — keep them owner-only (0600). Owned
  // by the connecting SSH user so the panel can stream it back over SFTP for
  // download (the operator already has full sudo, so this grants nothing new);
  // root can still read it.
  lines.push(`sudo -n chown "$(id -un):$(id -gn)" ${q}`);
  lines.push(`sudo -n chmod 600 ${q}`);
  // Size only needs directory traversal (755), no sudo, no file read.
  lines.push(`__sz="$(stat -c %s ${q} 2>/dev/null || echo 0)"`);
  lines.push('sudo -n rm -rf "$stage"');
  lines.push('echo "LUXBACKUP_SIZE=$__sz"');

  // Optional cloud offload from the target via its own `aws` CLI. Credentials
  // are written to a 0600 temp file (NOT passed on argv / env, so they don't
  // leak via `ps`); the secret lives inside this script body, which is shipped
  // through a private temporary script on the target, not as an argv payload.
  if (remoteStorage && /^[A-Za-z0-9_./:+=-]+$/.test(remoteStorage.accessKeyId) && !/[\n\r]/.test(remoteStorage.secretAccessKey)) {
    const filename = archivePath.split("/").pop() ?? "backup.tar.gz";
    const prefix = (remoteStorage.prefix ?? "").replace(/^\/+|\/+$/g, "");
    const key = (prefix ? `${prefix}/${filename}` : filename).replace(/^\/+/, "");
    const s3Uri = `s3://${remoteStorage.bucket}/${key}`;
    const endpointFlag = remoteStorage.endpoint ? `--endpoint-url ${quoteArg(remoteStorage.endpoint)}` : "";
    const region = remoteStorage.region || "auto";
    lines.push('if command -v aws >/dev/null 2>&1; then');
    lines.push('  __cred="$(mktemp /tmp/luxipanel-aws.XXXXXXXX)"');
    lines.push('  __awserr="$(mktemp /tmp/luxipanel-awserr.XXXXXXXX)"');
    lines.push('  chmod 600 "$__cred"');
    // Quoted heredoc → no expansion; key/secret are literal text (off argv/env).
    lines.push("  cat > \"$__cred\" <<'LUXAWSCREDS'");
    lines.push(`[default]`);
    lines.push(`aws_access_key_id=${remoteStorage.accessKeyId}`);
    lines.push(`aws_secret_access_key=${remoteStorage.secretAccessKey}`);
    lines.push(`LUXAWSCREDS`);
    // The two CHECKSUM env vars disable aws CLI v2's default integrity headers
    // that Cloudflare R2 rejects ("not implemented"); harmless for real S3.
    lines.push(
      `  if AWS_SHARED_CREDENTIALS_FILE="$__cred" AWS_DEFAULT_REGION=${quoteArg(region)} AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required aws s3 cp ${q} ${quoteArg(s3Uri)} ${endpointFlag} >/dev/null 2>"$__awserr"; then`,
    );
    lines.push(`    echo "LUXBACKUP_REMOTE=${s3Uri}"`);
    lines.push(`    sudo -n rm -f ${q}`); // archive is in the cloud now; drop the local copy
    lines.push('  else');
    lines.push('    echo "LUXBACKUP_REMOTE_ERR=$(head -c 600 "$__awserr" | base64 -w0)"');
    lines.push('  fi');
    lines.push('  rm -f "$__cred" "$__awserr"');
    lines.push('else');
    lines.push("  echo \"LUXBACKUP_REMOTE_ERR=$(printf %s 'aws CLI no esta instalado en el servidor cliente; instala awscli (apt install awscli) para subir a S3/R2' | base64 -w0)\"");
    lines.push('fi');
  }

  return lines.join("\n");
}

export const backupEngine = {
  /**
   * Create a full backup archive.
   * @param label         Human-readable label (used in filename).
   * @param includePaths  Extra filesystem paths to include.
   * @param includeDb     Whether to dump PostgreSQL.
   * @returns Path to the resulting .tar.gz file.
   */
  async create(
    label: string,
    includePaths: string[] = [],
    includeDb = true,
  ): Promise<BackupResult> {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "luxipanel-backup-"));
    const archivePath = path.join(os.tmpdir(), `${safeName}_${ts}.tar.gz`);

    try {
      // PostgreSQL fue retirado de LUXIPANEL: no hay base de datos que volcar.
      // Se conserva el parámetro por compatibilidad con la API/scheduler.
      if (includeDb) {
        log.warn("includeDatabase solicitado pero PostgreSQL fue retirado — se omite el dump");
      }

      // 2. Collect extra paths
      // Strict charset for includePaths — same allowlist as the managed twin
      // (`buildTargetBackupScript`). Blocks `$(…)` and other shell metachars
      // before any process spawning.
      const SAFE = /^\/[A-Za-z0-9._/-]+$/;
      for (const src of includePaths) {
        if (!SAFE.test(src)) {
          log.warn({ path: src }, "Backup path contains disallowed characters — skipping");
          continue;
        }
        if (!fs.existsSync(src)) {
          log.warn({ path: src }, "Backup path does not exist — skipping");
          continue;
        }
        const dest = path.join(workDir, "files", src.replace(/^\//, ""));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        execFileSync("cp", ["-r", src, dest], { stdio: "pipe" });
      }

      // 3. Create archive
      execFileSync("tar", ["-czf", archivePath, "-C", workDir, "."], { stdio: "pipe" });
      const { size } = fs.statSync(archivePath);

      log.info({ archive: archivePath, sizeBytes: size }, "Backup archive created");
      return { archivePath, sizeBytes: size };
    } finally {
      // Cleanup work dir
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },

  /**
   * Create a backup archive on the CONNECTED TARGET, collecting the selected
   * sources (databases / mail / panel config / extra paths) and storing the
   * `.tar.gz` in {@link TARGET_BACKUP_DIR} on that server — the same directory
   * the backups controller lists, downloads and deletes from. Nothing runs on
   * the panel host; the whole recipe executes through the executor.
   */
  async createOnTarget(
    label: string,
    sources: TargetBackupSources,
    executor: Executor,
    remoteStorage?: RemoteStorage | null,
    localDir: string = TARGET_BACKUP_DIR,
  ): Promise<BackupResult> {
    const selectedPaths = [
      ...(sources.fullServer ? FULL_SERVER_PATHS : sources.includePaths ?? []),
      ...((sources.fullServer || sources.includeMail) ? [mailConfig.vmail.base] : []),
    ];
    if (selectedPaths.some((source) => localDir === source || localDir.startsWith(`${source.replace(/\/$/, "")}/`))) {
      throw new Error("La carpeta de backups está dentro de una ruta que se va a respaldar. Cambia el destino local o las fuentes.");
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = (label || "backup").replace(/[^a-zA-Z0-9_-]/g, "_");
    const archivePath = `${localDir}/${safeName}_${ts}.tar.gz`;

    const script = buildTargetBackupScript(archivePath, sources, {
      vmailBase: mailConfig.vmail.base,
      panelConfigDir: panelConfigDir(),
    }, remoteStorage);
    // The script can contain the cloud key and an injected sudo password. Send
    // it through the executor's file channel with mode 0600; passing a base64
    // copy as a shell argument exposes both secrets via /proc/*/cmdline.
    const injected = await injectSudoIntoShellScript(executor, script);
    const scriptPath = `/tmp/.luxipanel-backup-${randomUUID()}.sh`;
    let out;
    try {
      await executor.writeFile(scriptPath, injected, { encoding: "utf-8", mode: 0o600 });
      out = await executor.exec(`sh ${quoteArg(scriptPath)}`, { timeoutMs: 30 * 60_000 });
    } finally {
      await executor.unlink(scriptPath).catch((err) => {
        log.warn({ err, target: executor.target.id }, "Could not remove temporary backup script");
      });
    }
    if (out.exitCode !== 0) {
      throw new Error(
        `Target backup failed (exit ${out.exitCode}): ${out.stderr?.trim() || out.stdout?.trim() || "unknown error"}`,
      );
    }
    // The on-target script echoes `LUXBACKUP_<KEY>=<value>` lines; pull each out.
    const marker = (key: string, valueRe = "\\S+"): string | undefined =>
      out.stdout.match(new RegExp(`LUXBACKUP_${key}=(${valueRe})`))?.[1];
    const sizeRaw = marker("SIZE", "\\d+");
    const sizeBytes = sizeRaw !== undefined ? Number.parseInt(sizeRaw, 10) : 0;
    const remoteUri = marker("REMOTE");
    const errRaw = marker("REMOTE_ERR");
    let remoteError: string | undefined;
    if (errRaw) {
      try { remoteError = Buffer.from(errRaw, "base64").toString("utf8").trim(); }
      catch { remoteError = "Fallo en la subida (motivo no legible)"; }
    }
    if (remoteStorage && !remoteUri) {
      log.warn({ target: executor.target.id, remoteError }, "Cloud offload requested but archive stayed local");
    }
    log.info({ archive: archivePath, sizeBytes, remoteUri, target: executor.target.id }, "Target backup archive created");
    return { archivePath, sizeBytes, remoteUri, remoteError };
  },

};
