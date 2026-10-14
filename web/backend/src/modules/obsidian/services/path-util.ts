/**
 * Pure path helpers for the Obsidian module.
 *
 * Everything the module touches on the client server lives INSIDE a vault
 * directory, so every relative path coming from a request or an agent tool is
 * funnelled through `resolveRel` before it reaches the Executor. The guard is
 * deliberately strict: any `..` segment is rejected outright (no "resolve and
 * hope" — normalization is only a second belt after the explicit checks).
 */

import { posix } from "node:path";
import { ValidationError } from "../../../shared/errors/index.js";
import { isPathUnder } from "../../../shared/utils/path-containment.js";
import { dirOf, isAbsoluteUnixPath } from "../../../shared/utils/posix-path.js";

/** Note file extensions the module is allowed to read/write/delete. */
const NOTE_EXTENSIONS = [".md", ".canvas", ".txt"] as const;

/** Absolute Unix path: starts with `/`, no NUL bytes. */
export { isAbsoluteUnixPath };

/** Strip trailing slashes from a vault path (root `/` is preserved). */
export function normalizedVaultPath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

/** True when the relative path ends in one of the allowed note extensions. */
export function hasAllowedNoteExtension(rel: string): boolean {
  const lower = String(rel).toLowerCase();
  return NOTE_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length);
}

/** Throws ValidationError unless the path carries an allowed note extension. */
export function assertNoteExtension(rel: string): void {
  if (!hasAllowedNoteExtension(rel)) {
    throw new ValidationError(
      `Extensión no permitida — solo ${NOTE_EXTENSIONS.join(", ")}`,
    );
  }
}

/**
 * Resolve a vault-relative path to an absolute path on the target,
 * guaranteeing the result stays inside the vault. Rejects:
 *
 *   - empty paths
 *   - NUL bytes
 *   - absolute paths (leading `/`)
 *   - any `..` segment ("a/../b" included — no traversal, period)
 *   - anything that, after normalization, escapes the vault prefix
 */
export function resolveRel(vaultPath: string, rel: string): string {
  if (!isAbsoluteUnixPath(vaultPath)) {
    throw new ValidationError("Vault path must be an absolute Unix path");
  }
  if (typeof rel !== "string" || rel.length === 0) {
    throw new ValidationError("Se requiere una ruta relativa al vault");
  }
  if (rel.includes("\0")) {
    throw new ValidationError("Ruta inválida (NUL)");
  }
  if (rel.startsWith("/")) {
    throw new ValidationError("La ruta debe ser relativa al vault, no absoluta");
  }

  const segments = rel.split("/").filter((s) => s !== "" && s !== ".");
  if (segments.length === 0) {
    throw new ValidationError("Ruta relativa vacía");
  }
  if (segments.some((s) => s === "..")) {
    throw new ValidationError("Ruta inválida: '..' no está permitido");
  }

  const base = normalizedVaultPath(vaultPath);
  const abs = posix.normalize(posix.join(base, segments.join("/")));
  if (!isPathUnder(base, abs)) {
    throw new ValidationError("La ruta escapa del vault");
  }
  return abs;
}

/** Vault-relative form of an absolute path produced by `resolveRel`. */
export function relFromAbs(vaultPath: string, abs: string): string {
  const base = vaultPath.replace(/\/+$/, "") || "/";
  if (abs === base) return "";
  return abs.startsWith(`${base}/`) ? abs.slice(base.length + 1) : abs;
}

/** Parent directory of an absolute path ("/a/b/c.md" → "/a/b"). */
export const parentDir = dirOf;
