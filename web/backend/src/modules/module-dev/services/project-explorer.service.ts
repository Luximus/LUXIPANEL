/** Read-only browser for this panel's source checkout. */
import { open, readdir, lstat, realpath } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MAX_PREVIEW_BYTES = 200_000;
const MAX_INDEX_ENTRIES = 30_000;
const MAX_SEARCH_RESULTS = 80;
const INDEX_TTL_MS = 20_000;
const visibleDotNames = new Set([".github", ".gitignore", ".editorconfig", ".dockerignore"]);
const excludedNames = new Set([
  ".git", ".agents", ".codex", ".aws", ".ssh", ".cache", ".astro", ".next", ".venv",
  "node_modules", "dist", "build", "coverage", "vendor", "__pycache__", ".turbo", ".pnpm-store",
]);
const blockedExtensions = new Set([".pem", ".key", ".p12", ".pfx", ".sqlite", ".sqlite3", ".db", ".bak"]);

export interface ProjectEntry { name: string; path: string; kind: "directory" | "file" }
export interface ProjectListing { path: string; entries: ProjectEntry[]; truncated: boolean }
export interface ProjectFile { path: string; name: string; size: number; content: string | null; truncated: boolean; language: string; binary: boolean }

function visible(name: string): boolean {
  if (!name || excludedNames.has(name) || name.startsWith("dist-") || name.startsWith("dist_")) return false;
  if (name.startsWith(".") && !visibleDotNames.has(name)) return false;
  if (/^\.env(?:\.|$)/i.test(name) || blockedExtensions.has(extname(name).toLowerCase())) return false;
  if (/^(?:id_rsa|id_ed25519|known_hosts|authorized_keys)$/i.test(name)) return false;
  return true;
}

function segmentsOf(path: string): string[] {
  if (typeof path !== "string" || path.length > 768 || path.includes("\\") || path.includes("\0") || path.startsWith("/")) {
    throw new ValidationError("Ruta de proyecto inválida");
  }
  if (!path) return [];
  const segments = path.split("/");
  if (segments.some((part) => !part || part === "." || part === ".." || !visible(part))) {
    throw new ValidationError("Ruta de proyecto no disponible");
  }
  return segments;
}

function entryPath(parent: string, name: string): string { return parent ? `${parent}/${name}` : name; }
function languageFor(name: string): string {
  const ext = extname(name).toLowerCase();
  const languages: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript React", ".js": "JavaScript", ".jsx": "JavaScript React",
    ".astro": "Astro", ".py": "Python", ".md": "Markdown", ".json": "JSON", ".yaml": "YAML",
    ".yml": "YAML", ".css": "CSS", ".scss": "SCSS", ".html": "HTML", ".sql": "SQL",
    ".sh": "Shell", ".mjs": "JavaScript", ".vue": "Vue", ".svelte": "Svelte", ".toml": "TOML",
  };
  return languages[ext] ?? (name === "Dockerfile" ? "Dockerfile" : "Texto");
}

export function createProjectExplorer(root: string) {
  let indexedAt = 0;
  let index: ProjectEntry[] = [];
  let indexing: Promise<ProjectEntry[]> | null = null;

  async function safeStat(path: string) {
    const segments = segmentsOf(path);
    let absolute = root;
    let stat = await lstat(root);
    for (const segment of segments) {
      if (!stat.isDirectory()) throw new NotFoundError("Ruta");
      absolute = resolve(absolute, segment);
      try { stat = await lstat(absolute); } catch { throw new NotFoundError("Ruta"); }
      if (stat.isSymbolicLink()) throw new ForbiddenError("No se siguen enlaces simbólicos");
    }
    const canonical = await realpath(absolute);
    const canonicalRoot = await realpath(root);
    if (canonical !== canonicalRoot && !canonical.startsWith(canonicalRoot + sep)) {
      throw new ForbiddenError("Ruta fuera del proyecto");
    }
    return { absolute, stat };
  }

  async function list(path = ""): Promise<ProjectListing> {
    const { absolute, stat } = await safeStat(path);
    if (!stat.isDirectory()) throw new ValidationError("La ruta no es una carpeta");
    const children = (await readdir(absolute, { withFileTypes: true }))
      .filter((child) => visible(child.name) && !child.isSymbolicLink() && (child.isDirectory() || child.isFile()))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, "es"));
    return {
      path,
      entries: children.slice(0, 500).map((child) => ({ name: child.name, path: entryPath(path, child.name), kind: child.isDirectory() ? "directory" : "file" })),
      truncated: children.length > 500,
    };
  }

  async function file(path: string): Promise<ProjectFile> {
    if (!path) throw new ValidationError("Selecciona un archivo");
    const { absolute, stat } = await safeStat(path);
    if (!stat.isFile()) throw new ValidationError("La ruta no es un archivo");
    const size = stat.size;
    const handle = await open(absolute, "r");
    const buffer = Buffer.alloc(Math.min(size, MAX_PREVIEW_BYTES));
    let bytesRead = 0;
    try { ({ bytesRead } = await handle.read(buffer, 0, buffer.length, 0)); } finally { await handle.close(); }
    let content: string | null = null;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead), { stream: size > bytesRead });
      if (content.includes("\0")) content = null;
    } catch { content = null; }
    return { path, name: segmentsOf(path).at(-1)!, size, content, truncated: size > buffer.length, language: languageFor(path), binary: content === null };
  }

  async function buildIndex(): Promise<ProjectEntry[]> {
    const entries: ProjectEntry[] = [];
    const pending: Array<{ absolute: string; relative: string }> = [{ absolute: root, relative: "" }];
    while (pending.length && entries.length < MAX_INDEX_ENTRIES) {
      const current = pending.shift()!;
      let children;
      try { children = await readdir(current.absolute, { withFileTypes: true }); } catch { continue; }
      for (const child of children) {
        if (!visible(child.name) || child.isSymbolicLink() || (!child.isDirectory() && !child.isFile())) continue;
        const path = entryPath(current.relative, child.name);
        const kind = child.isDirectory() ? "directory" : "file";
        entries.push({ name: child.name, path, kind });
        if (kind === "directory") pending.push({ absolute: resolve(current.absolute, child.name), relative: path });
        if (entries.length >= MAX_INDEX_ENTRIES) break;
      }
    }
    indexedAt = Date.now();
    index = entries;
    return entries;
  }

  async function search(query: string): Promise<{ query: string; results: ProjectEntry[]; truncated: boolean }> {
    const term = query.trim().toLocaleLowerCase();
    if (term.length < 2 || term.length > 100) throw new ValidationError("Escribe entre 2 y 100 caracteres");
    if (!indexedAt || Date.now() - indexedAt > INDEX_TTL_MS) {
      if (!indexing) indexing = buildIndex().finally(() => { indexing = null; });
      await indexing;
    }
    const matches = index.filter((entry) => entry.path.toLocaleLowerCase().includes(term));
    matches.sort((a, b) => {
      const rank = (item: ProjectEntry) => Number(item.name.toLocaleLowerCase().startsWith(term)) * 4
        + Number(item.name.toLocaleLowerCase().includes(term)) * 2 - item.path.split("/").length * 0.01;
      return rank(b) - rank(a) || a.path.localeCompare(b.path, "es");
    });
    return { query, results: matches.slice(0, MAX_SEARCH_RESULTS), truncated: matches.length > MAX_SEARCH_RESULTS };
  }

  function refresh(): void { indexedAt = 0; index = []; }
  return { list, file, search, refresh };
}

export const projectExplorerService = createProjectExplorer(projectRoot);
