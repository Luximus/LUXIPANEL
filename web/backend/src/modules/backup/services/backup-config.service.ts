// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Effective backup policy, stored on the connected server. */
import path from "node:path";
import { z } from "zod";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { remoteConfig } from "../../../shared/remote-config/index.js";
import { ConflictError, ValidationError } from "../../../shared/errors/index.js";

export const DEFAULT_BACKUP_DIR = "/var/backups/luxipanel";
const MODULE = "backup-config";
const configSchema = z.object({
  localDir: z.string(),
  defaultRetainCount: z.number().int().min(1).max(365),
});
export type BackupConfig = z.infer<typeof configSchema>;
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  localDir: DEFAULT_BACKUP_DIR,
  defaultRetainCount: 7,
};

/** Directory mutations and backup jobs share this in-process guard. */
const busyTargets = new Map<string, number>();
const changingTargets = new Set<string>();

export function beginBackupActivity(executor: Executor): () => void {
  const id = executor.target.id;
  if (changingTargets.has(id)) throw new ConflictError("La carpeta de backups está cambiando; inténtalo de nuevo al terminar.");
  busyTargets.set(id, (busyTargets.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (busyTargets.get(id) ?? 1) - 1;
    if (remaining > 0) busyTargets.set(id, remaining);
    else busyTargets.delete(id);
  };
}

export function beginDirectoryChange(executor: Executor): () => void {
  const id = executor.target.id;
  if (changingTargets.has(id) || (busyTargets.get(id) ?? 0) > 0) {
    throw new ConflictError("Hay un backup en curso para este servidor. Espera a que termine.");
  }
  changingTargets.add(id);
  return () => { changingTargets.delete(id); };
}

export function validateBackupDir(value: string): string {
  const input = value.trim();
  if (!input.startsWith("/") || input.includes("\0") || /[\r\n]/.test(input)) {
    throw new ValidationError("El directorio de backups debe ser una ruta absoluta válida.");
  }
  const normalized = path.posix.normalize(input).replace(/\/$/, "");
  if (normalized !== input || normalized === "/" || normalized.length > 240) {
    throw new ValidationError("Selecciona una carpeta absoluta sin segmentos especiales ni barra final.");
  }
  const forbidden = ["/etc", "/proc", "/sys", "/dev", "/run", "/tmp", "/root", "/home", "/var/www", "/var/vmail", "/boot", "/usr", "/bin", "/sbin", "/lib", "/lib64"];
  if (forbidden.some((base) => normalized === base || normalized.startsWith(`${base}/`))) {
    throw new ValidationError("Selecciona una carpeta de datos fuera de los directorios del sistema.");
  }
  return normalized;
}

export async function readBackupConfig(executor: Executor): Promise<BackupConfig> {
  const raw = await remoteConfig.read(executor, MODULE, DEFAULT_BACKUP_CONFIG);
  const parsed = configSchema.parse(raw);
  return { ...parsed, localDir: validateBackupDir(parsed.localDir) };
}

export async function writeBackupConfig(executor: Executor, value: BackupConfig): Promise<BackupConfig> {
  const parsed = configSchema.parse({ ...value, localDir: validateBackupDir(value.localDir) });
  await remoteConfig.write(executor, MODULE, parsed);
  return parsed;
}

/** Create the destination, then reject symlinked paths and permission errors. */
export async function prepareBackupDir(executor: Executor, dir: string): Promise<void> {
  const mkdir = await executor.exec(quoteCmd("sudo", ["-n", "mkdir", "-p", "--", dir]));
  if (mkdir.exitCode !== 0) throw new ValidationError(`No se pudo crear el directorio: ${mkdir.stderr.trim()}`);
  const resolved = await executor.exec(quoteCmd("sudo", ["-n", "realpath", "-e", "--", dir]));
  if (resolved.exitCode !== 0 || resolved.stdout.trim() !== dir) {
    throw new ValidationError("La carpeta seleccionada contiene un enlace simbólico o no se puede verificar.");
  }
  const check = await executor.exec(quoteCmd("sudo", ["-n", "test", "-d", dir]));
  if (check.exitCode !== 0) throw new ValidationError("La ruta seleccionada no es una carpeta accesible.");
}
