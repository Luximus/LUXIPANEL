// Files page — paths submodule (code-move from index-script1.ts; no behavior change).
import { t } from "./i18n";
import { S } from "./state";


  export function normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }

  export function getSearchQuery(): string {
    return S.searchQuery;
  }

  export function getBaseName(filePath: string): string {
    const normalized = filePath.replace(/\/+$/g, "");
    if (!normalized) return "";
    const parts = normalized.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  }

  export function getParentPath(filePath: string): string {
    const normalized = filePath.replace(/\/+$/g, "");
    if (!normalized || normalized === "/") return "/";
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) return "/";
    return `/${parts.slice(0, -1).join("/")}`;
  }

  export function joinPath(base: string, name: string): string {
    const cleanBase = base === "/" ? "" : base.replace(/\/+$/g, "");
    return `${cleanBase}/${name}`.replace(/\/+/g, "/");
  }

  export function isArchiveFile(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".tar.bz2") || lower.endsWith(".tar");
  }

  export function stripArchiveExtension(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith(".tar.gz") || lower.endsWith(".tar.bz2")) return name.slice(0, -7);
    if (lower.endsWith(".tgz")) return name.slice(0, -4);
    if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".tar")) return name.slice(0, name.lastIndexOf("."));
    return name;
  }

  export function normalizeZipName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return t("placeholders.zipName", "archivo.zip");
    return trimmed.toLowerCase().endsWith(".zip") ? trimmed : `${trimmed}.zip`;
  }

  export function defaultZipName(paths: string[]): string {
    if (paths.length === 1) {
      const base = getBaseName(paths[0] ?? "");
      return `${stripArchiveExtension(base || t("labels.fileCap", "Archivo").toLocaleLowerCase(document.documentElement.lang || undefined))}.zip`;
    }
    const folder = getBaseName(S.currentPath);
    return folder ? `${folder}.zip` : t("placeholders.zipName", "archivo.zip");
  }

  export function setDialogValue(id: string, value: string) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value;
  }

  export function escapeAttr(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  export function fmtSize(bytes: number): string {
    if (!bytes) return "—";
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  /** Escape a string for safe interpolation inside a double-quoted HTML attr. */
  export function escAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  export function fmtDate(ts: string | number): string {
    if (!ts) return "—";
    return new Date(ts).toLocaleString(document.documentElement.lang || undefined, { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  /** Human label for the entry type column. */
  export function typeLabel(e: any): string {
    if (e?.type === "symlink") return t("type.symlink", "Enlace");
    if (e?.isDir || e?.type === "dir") return t("labels.folderCap", "Carpeta");
    const name = typeof e?.name === "string" ? e.name : "";
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
    return ext ? `.${ext}` : t("labels.fileCap", "Archivo");
  }

  /** Convert an octal mode string ("0755", "755", "0100644") to symbolic
   *  rwx notation (only the last 3 digits / permission bits). */
  export function modeToSymbolic(mode: string): string {
    if (!mode) return "";
    const digits = String(mode).replace(/[^0-7]/g, "");
    if (digits.length < 3) return "";
    const perm = digits.slice(-3);
    const map = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    let out = "";
    for (const ch of perm) {
      const n = Number(ch);
      out += map[n] ?? "---";
    }
    return out;
  }

  export function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
