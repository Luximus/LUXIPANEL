// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, vi } from "vitest";
import { backupEngine, buildTargetBackupScript, TARGET_BACKUP_DIR, FULL_SERVER_PATHS } from "./backup-engine.service.js";
import type { Executor } from "../../../shared/executor/index.js";

vi.mock("../../../shared/system/sudo-runtime.js", () => ({
  injectSudoIntoShellScript: async (_executor: Executor, script: string) => `${script}\n# injected-sudo-secret`,
}));

const PATHS = { vmailBase: "/var/vmail", panelConfigDir: "/etc/luxipanel" };
const ARCHIVE = `${TARGET_BACKUP_DIR}/test_2026-06-02.tar.gz`;

describe("buildTargetBackupScript", () => {
  it("always stages, produces a gzip archive and cleans up", () => {
    const s = buildTargetBackupScript(ARCHIVE, {}, PATHS);
    expect(s).toContain("mktemp -d /tmp/luxipanel-backup.XXXXXXXX");
    expect(s).toContain(`sudo -n tar -czf '${ARCHIVE}'`);
    expect(s).toContain(`sudo -n chown "$(id -un):$(id -gn)" '${ARCHIVE}'`);
    expect(s).toContain(`sudo -n chmod 600 '${ARCHIVE}'`);
    expect(s).toContain('sudo -n rm -rf "$stage"');
    expect(s).toContain("LUXBACKUP_SIZE=");
  });

  it("never copies sources into a staging dir (tars them in place)", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      { includeMail: true, includePanelConfig: true, includePaths: ["/srv/app"] },
      PATHS,
    );
    expect(s).not.toContain("cp -a");
  });

  it("includes both DB engines only when databases are requested", () => {
    const off = buildTargetBackupScript(ARCHIVE, {}, PATHS);
    expect(off).not.toContain("mysqldump");
    expect(off).not.toContain("pg_dumpall");

    const on = buildTargetBackupScript(ARCHIVE, { includeDatabases: true }, PATHS);
    expect(on).toContain("command -v mysqldump");
    expect(on).toContain("sudo -n mysqldump --single-transaction");
    expect(on).toContain("command -v pg_dumpall");
    expect(on).toContain("sudo -n -u postgres pg_dumpall");
    expect(on).toContain("has_db=1");
  });

  it("adds the mail store + Postfix/Dovecot as in-place relative members", () => {
    const s = buildTargetBackupScript(ARCHIVE, { includeMail: true }, PATHS);
    expect(s).toContain(`test -e '/var/vmail' && rel="$rel var/vmail"`);
    expect(s).toContain(`test -e '/etc/postfix' && rel="$rel etc/postfix"`);
    expect(s).toContain(`test -e '/etc/dovecot' && rel="$rel etc/dovecot"`);
    expect(s).toContain("-C / $rel");
  });

  it("adds the panel config dir as an in-place relative member", () => {
    const s = buildTargetBackupScript(ARCHIVE, { includePanelConfig: true }, PATHS);
    expect(s).toContain(`test -e '/etc/luxipanel' && rel="$rel etc/luxipanel"`);
  });

  it("snapshots only shell-safe absolute extra paths", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      { includePaths: ["/srv/app", "relative/skip", "/bad path/with space"] },
      PATHS,
    );
    expect(s).toContain(`test -e '/srv/app' && rel="$rel srv/app"`);
    expect(s).not.toContain("relative/skip");
    expect(s).not.toContain("with space");
  });

  it("dumps only the named databases per engine when selections are given", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      {
        includeDatabases: true,
        databaseSelections: [
          { engine: "mysql", name: "shop" },
          { engine: "mysql", name: "blog" },
          { engine: "postgresql", name: "analytics" },
        ],
      },
      PATHS,
    );
    // MySQL selected DBs go into a single --databases dump…
    expect(s).toContain("sudo -n mysqldump --single-transaction --routines --triggers --events --databases 'shop' 'blog'");
    expect(s).not.toContain("--all-databases");
    // …PostgreSQL is dumped per-database.
    expect(s).toContain("sudo -n -u postgres pg_dump 'analytics' > \"$stage/databases/pg-analytics.sql\"");
    expect(s).not.toContain("pg_dumpall");
  });

  it("rejects unsafe database names from the dump command", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      { includeDatabases: true, databaseSelections: [{ engine: "mysql", name: "evil; rm -rf /" }] },
      PATHS,
    );
    expect(s).not.toContain("rm -rf /");
    // No safe selection remains → falls back to dumping all schemas.
    expect(s).toContain("--all-databases");
  });

  it("full server forces DBs + mail + config on and adds curated paths", () => {
    const s = buildTargetBackupScript(ARCHIVE, { fullServer: true }, PATHS);
    expect(s).toContain("sudo -n mysqldump");
    expect(s).toContain("sudo -n -u postgres pg_dumpall");
    expect(s).toContain(`test -e '/var/vmail' && rel="$rel var/vmail"`);
    expect(s).toContain(`test -e '/etc/luxipanel' && rel="$rel etc/luxipanel"`);
    for (const p of FULL_SERVER_PATHS) {
      const rel = p.replace(/^\/+/, "");
      expect(s).toContain(`test -e '${p}' && rel="$rel ${rel}"`);
    }
  });

  it("excludes regenerable dirs (node_modules/.git/…) from the file tar", () => {
    const s = buildTargetBackupScript(ARCHIVE, { includePaths: ["/var/www"] }, PATHS);
    expect(s).toContain("--exclude='*/node_modules'");
    expect(s).toContain("--exclude='*/.git'");
    expect(s).toContain("--exclude='*/.pnpm-store'");
    // Excludes precede the `-C / $rel` files they apply to.
    expect(s).toMatch(/tar -czf '[^']+' --exclude=.*-C \/ \$rel/);
  });

  it("appends a best-effort cloud upload when a remote storage is given", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      { includeDatabases: true },
      PATHS,
      { provider: "r2", bucket: "my-bucket", endpoint: "https://acc.r2.cloudflarestorage.com", prefix: "backups", accessKeyId: "AKIA123", secretAccessKey: "s3cr3t/Key+" },
    );
    expect(s).toContain("command -v aws");
    // Credentials go into a 0600 temp file via a quoted heredoc (off argv/env).
    expect(s).toContain("<<'LUXAWSCREDS'");
    expect(s).toContain("aws_access_key_id=AKIA123");
    expect(s).toContain("aws_secret_access_key=s3cr3t/Key+");
    expect(s).toContain("aws s3 cp '" + ARCHIVE + "' 's3://my-bucket/backups/" + ARCHIVE.split("/").pop());
    expect(s).toContain("--endpoint-url 'https://acc.r2.cloudflarestorage.com'");
    expect(s).toContain("LUXBACKUP_REMOTE=s3://my-bucket/backups/");
    // R2 checksum workaround + visible failure reporting.
    expect(s).toContain("AWS_REQUEST_CHECKSUM_CALCULATION=when_required");
    expect(s).toContain("LUXBACKUP_REMOTE_ERR=");
    expect(s).toContain("aws CLI no esta instalado");
  });

  it("omits the cloud upload entirely when no remote storage is given", () => {
    const s = buildTargetBackupScript(ARCHIVE, { includeDatabases: true }, PATHS);
    expect(s).not.toContain("aws s3 cp");
    expect(s).not.toContain("LUXAWSCREDS");
  });

  it("keeps every privileged step at a sudo-injectable command position", () => {
    const s = buildTargetBackupScript(
      ARCHIVE,
      { includeDatabases: true, includeMail: true, includePanelConfig: true, includePaths: ["/srv/x"] },
      PATHS,
    );
    const sudoRe = /sudo(?:\s+-n)?\s+/g;
    let m: RegExpExecArray | null;
    while ((m = sudoRe.exec(s))) {
      // Strip trailing spaces/tabs only (NOT newlines) so a start-of-line sudo
      // is recognised by its preceding "\n".
      const pre = s.slice(0, m.index).replace(/[ \t]+$/, "");
      const ok = pre === "" || pre.endsWith("\n") || pre.endsWith(";") || pre.endsWith("&&") || pre.endsWith("||");
      expect(ok, `sudo not at command position near: ${s.slice(Math.max(0, m.index - 15), m.index + 8)}`).toBe(true);
    }
  });
});

describe("backup destination overlap", () => {
  it("rejects a destination inside a selected source before starting an archive", async () => {
    await expect(backupEngine.createOnTarget("daily", { includePaths: ["/srv"] }, {} as Executor, null, "/srv/backups"))
      .rejects.toThrow("dentro de una ruta que se va a respaldar");
  });
});

describe("target backup secret transport", () => {
  it("writes a private script and keeps secrets out of process arguments", async () => {
    const executor = {
      target: { id: "remote-1" },
      writeFile: vi.fn(async () => undefined),
      exec: vi.fn(async () => ({ exitCode: 0, stdout: "LUXBACKUP_SIZE=123", stderr: "" })),
      unlink: vi.fn(async () => undefined),
    } as unknown as Executor;
    const result = await backupEngine.createOnTarget(
      "test",
      { includePanelConfig: true },
      executor,
      { provider: "r2", bucket: "test", accessKeyId: "KEY", secretAccessKey: "cloud-secret" },
    );
    expect(result.sizeBytes).toBe(123);
    const [scriptPath, script, options] = vi.mocked(executor.writeFile).mock.calls[0]!;
    expect(scriptPath).toMatch(/^\/tmp\/\.luxipanel-backup-[a-f0-9-]+\.sh$/);
    expect(options).toMatchObject({ mode: 0o600 });
    expect(script).toContain("cloud-secret");
    expect(script).toContain("injected-sudo-secret");
    const command = vi.mocked(executor.exec).mock.calls[0]?.[0];
    expect(command).toBe(`sh '${scriptPath}'`);
    expect(command).not.toContain("cloud-secret");
    expect(command).not.toContain("injected-sudo-secret");
    expect(executor.unlink).toHaveBeenCalledWith(scriptPath);
  });
});
