/**
 * files-types — tipos y helpers PUROS del módulo Archivos (sin React ni RN).
 * Extraídos de FilesScreen para reutilizarlos desde los subcomponentes
 * (diálogos, herramientas) sin duplicarlos. Complementa `files-list-logic`.
 */

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

export type Entry = { name: string; path: string; type: "file" | "dir"; isDir: boolean; size: number; mode?: string; owner?: string; mtime?: string };

// ── Git / Snapshots (accesos defensivos: el backend puede omitir campos) ─────
export type GitFile = { path: string; x?: string; y?: string; staged?: boolean; untracked?: boolean };
export type GitStatus = { isRepo?: boolean; root?: string | null; branch?: string | null; head?: string | null; ahead?: number; behind?: number; files?: GitFile[]; branches?: string[] };
export type GitStatusKey = "new" | "added" | "deleted" | "renamed" | "modified";
export type Snapshot = { id: string; path?: string; op?: string; kind?: string; sizeBytes?: number; capturedAt?: string; createdAt?: string; note?: string };

/** Clave de estado estable (independiente del idioma) de un archivo modificado. */
export function gitStatusKey(f: GitFile): GitStatusKey {
  if (f.untracked) return "new";
  if (f.x === "A") return "added";
  if (f.x === "D" || f.y === "D") return "deleted";
  if (f.x === "R") return "renamed";
  return "modified";
}

// ── Operaciones avanzadas / privacidad / compartir (tipos defensivos) ────────
export type Recommend = { mode?: string; recommended?: string; level?: string; reasons?: string[]; isDir?: boolean };
export type PrivacyEnforcement = { enforced?: boolean; reason?: string | null; publicUrl?: string | null };
export type PrivacyStatus = { protected?: boolean; realm?: string | null; users?: string[]; enforcement?: PrivacyEnforcement | null; note?: string };
export type ShareRoot = { root: string; domain: string; ssl?: boolean };
export type ShareItem = { id: string; path?: string; filename?: string; root?: string; domain?: string; url?: string; hasPassword?: boolean; maxDownloads?: number; expiresAt?: string; revoked?: boolean; downloadCount?: number };
export type OpKind = "copy" | "chmod" | "chown" | "compress" | "extract";

// ── Herramientas: escáneres + operaciones masivas (tipos defensivos) ─────────
export type ScanRisk = "high" | "medium";
export type MalwareFinding = { path: string; name?: string; line?: number; risk?: ScanRisk; reason?: string; snippet?: string };
export type MalwareScan = { findings?: MalwareFinding[]; truncated?: boolean };
export type QuarantineEntry = { id: string; name?: string; originalPath?: string; quarantinedAt?: string; reason?: string };
export type CleanupItem = { path: string; name?: string; kind?: "dir" | "file"; sizeBytes?: number; classification?: "safe" | "review" | "keep"; reason?: string; category?: string };
export type CleanupScan = { items?: CleanupItem[]; reclaimableBytes?: number; truncated?: boolean };
export type ReplaceLine = { line: number; before: string; after: string };
export type FileReplacements = { path: string; name?: string; replacements?: ReplaceLine[] };
export type ReplacePreviewData = { files?: FileReplacements[]; totalReplacements?: number; truncated?: boolean };
export type ReplaceApplyData = { filesChanged?: number; totalReplacements?: number; truncated?: boolean };
export type PublishCandidate = { site: string; domain: string; ssl?: boolean; kind?: string };
export type ExposureFinding = { path: string; name?: string; root?: string; domain?: string; url?: string; risk?: ScanRisk; reason?: string };
export type ExposureScan = { findings?: ExposureFinding[]; rootsScanned?: Array<{ root: string; domain: string; ssl?: boolean }>; truncated?: boolean };
// ── Optimización de imágenes (#22) ───────────────────────────────────────────
export type ImageCapabilities = { magick?: boolean; magickCmd?: string; cwebp?: boolean; jpegoptim?: boolean; optipng?: boolean };
export type LargeImage = { path: string; name?: string; sizeBytes?: number; width?: number; height?: number };
export type ImageOp = "webp" | "compress" | "resize" | "responsive";
export type ToolTab = "malware" | "cleanup" | "replace" | "chmod" | "publish" | "exposure" | "images";
export type ToolTabProps = { panelId: string; token: string; dir: string; onToast: (m: string, e?: boolean) => void; onChanged: () => void };

const ARCHIVE_RE = /\.(zip|tar|tgz|tbz2?|tar\.gz|tar\.bz2|gz|bz2|xz|7z|rar)$/i;
export function isArchiveName(name: string): boolean {
  return ARCHIVE_RE.test(name);
}
export function stripArchiveExt(p: string): string {
  return p.replace(/\.(tar\.gz|tar\.bz2|tgz|tbz2?|zip|tar)$/i, "");
}
export function extForFormat(fmt: string): string {
  return fmt === "zip" ? ".zip" : fmt === "tar.bz2" ? ".tar.bz2" : ".tar.gz";
}

export function fmtBytes(b: number): string {
  if (!b || b < 1024) return `${Math.round(b || 0)} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = b / 1024,
    i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}
export function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") ? dir + name : `${dir}/${name}`;
}
export function parentOf(p: string): string {
  const clean = p.replace(/\/+$/, "");
  const idx = clean.lastIndexOf("/");
  return idx <= 0 ? "/" : clean.slice(0, idx);
}
