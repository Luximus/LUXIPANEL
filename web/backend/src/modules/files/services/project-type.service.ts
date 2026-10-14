// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Project-type detector + logical map (Fase 0.3, #4).
 *
 * Looks at a directory's top-level entries (one readdir) plus the contents of
 * package.json / composer.json (when present) to classify the stack and return
 * a human-friendly map — public root, config, routes, views, logs, deps,
 * backups, temp — instead of raw folders. Feeds the smart project map (#4) and
 * the per-stack cleanup classifier (#11).
 *
 * Cheap by design: one `readdir` + at most two small file reads, everything
 * through the request executor. Section existence is approximated from the
 * top-level listing (first path segment), so nested paths cost no round-trips.
 */

import path from "node:path";
import type { Executor } from "../../../shared/executor/index.js";
import { safePath } from "./filesystem.service.js";

export type ProjectType =
  | "laravel"
  | "wordpress"
  | "nextjs"
  | "nuxt"
  | "vue"
  | "react"
  | "node"
  | "django"
  | "python"
  | "php"
  | "static"
  | "unknown";

export interface ProjectSection {
  key: string;
  label: string;
  /** Absolute path on the client server. */
  path: string;
  /** True when the section's top-level segment exists in the listing. */
  exists: boolean;
  /** Holds secrets / config — flagged for the future exposed-files scan (#3). */
  sensitive?: boolean;
  /** True when the section points at a file (open in editor) vs a directory. */
  isFile?: boolean;
}

export interface ProjectInfo {
  type: ProjectType;
  label: string;
  confidence: "high" | "medium" | "low";
  /** Web-exposed root (relative role), absolute path. */
  publicRoot?: string;
  /** Marker files/dirs that drove the classification. */
  markers: string[];
  sections: ProjectSection[];
}

const TYPE_LABELS: Record<ProjectType, string> = {
  laravel: "Laravel",
  wordpress: "WordPress",
  nextjs: "Next.js",
  nuxt: "Nuxt",
  vue: "Vue",
  react: "React",
  node: "Node.js",
  django: "Django",
  python: "Python",
  php: "PHP clásico",
  static: "Sitio estático",
  unknown: "Desconocido",
};

interface Listing {
  names: Set<string>;
  pkg: Record<string, unknown> | null;
  composer: Record<string, unknown> | null;
}

function depSet(pkg: Record<string, unknown> | null): Set<string> {
  const out = new Set<string>();
  if (!pkg) return out;
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field];
    if (deps && typeof deps === "object") {
      for (const k of Object.keys(deps as Record<string, unknown>)) out.add(k);
    }
  }
  return out;
}

async function gather(executor: Executor, dir: string): Promise<Listing> {
  let names = new Set<string>();
  try {
    const entries = await executor.readdir(dir);
    names = new Set(entries.map((e) => e.name));
  } catch {
    /* unreadable dir → empty listing */
  }
  const readJson = async (file: string): Promise<Record<string, unknown> | null> => {
    if (!names.has(file)) return null;
    try {
      const raw = await executor.readFile(path.posix.join(dir, file), "utf-8");
      return JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const [pkg, composer] = await Promise.all([readJson("package.json"), readJson("composer.json")]);
  return { names, pkg, composer };
}

function classify(l: Listing): { type: ProjectType; confidence: ProjectInfo["confidence"]; markers: string[] } {
  const has = (n: string) => l.names.has(n);
  const deps = depSet(l.pkg);
  const composerReq = l.composer && typeof l.composer["require"] === "object"
    ? Object.keys(l.composer["require"] as Record<string, unknown>)
    : [];

  // Laravel: artisan + composer require laravel/framework.
  if (has("artisan") && composerReq.some((d) => d.startsWith("laravel/"))) {
    return { type: "laravel", confidence: "high", markers: ["artisan", "composer.json"] };
  }
  // WordPress.
  if (has("wp-config.php") || has("wp-load.php") || has("wp-includes") || has("wp-content")) {
    return { type: "wordpress", confidence: "high", markers: ["wp-config.php", "wp-content"].filter(has) };
  }
  // Next.js.
  if (deps.has("next") || has("next.config.js") || has("next.config.mjs") || has("next.config.ts")) {
    const markers = deps.has("next") ? ["next (package.json)"] : ["next.config"];
    return { type: "nextjs", confidence: "high", markers };
  }
  // Nuxt.
  if (deps.has("nuxt") || deps.has("nuxt3") || has("nuxt.config.js") || has("nuxt.config.ts")) {
    return { type: "nuxt", confidence: "high", markers: ["nuxt"] };
  }
  // Plain Vue.
  if (deps.has("vue")) {
    return { type: "vue", confidence: "medium", markers: ["vue"] };
  }
  // React (CRA/Vite).
  if (deps.has("react")) {
    return { type: "react", confidence: "medium", markers: ["react"] };
  }
  // Django.
  if (has("manage.py")) {
    return { type: "django", confidence: "high", markers: ["manage.py"] };
  }
  // Generic Python.
  if (has("requirements.txt") || has("pyproject.toml") || has("Pipfile")) {
    return { type: "python", confidence: "medium", markers: ["requirements.txt", "pyproject.toml", "Pipfile"].filter(has) };
  }
  // Generic Node (package.json without a known framework).
  if (l.pkg) {
    return { type: "node", confidence: "medium", markers: ["package.json"] };
  }
  // Classic PHP.
  if (has("index.php") || has("composer.json")) {
    return { type: "php", confidence: "low", markers: ["index.php", "composer.json"].filter(has) };
  }
  // Static site.
  if (has("index.html")) {
    return { type: "static", confidence: "low", markers: ["index.html"] };
  }
  return { type: "unknown", confidence: "low", markers: [] };
}

/** Per-type logical section templates (relative path, role). */
const SECTION_TEMPLATES: Partial<Record<ProjectType, Array<Omit<ProjectSection, "path" | "exists"> & { rel: string; isPublicRoot?: boolean }>>> = {
  laravel: [
    { key: "public", label: "Archivos públicos", rel: "public", isPublicRoot: true },
    { key: "routes", label: "Rutas", rel: "routes" },
    { key: "views", label: "Vistas", rel: "resources/views" },
    { key: "config", label: "Configuración", rel: "config" },
    { key: "env", label: ".env (sensible)", rel: ".env", sensitive: true, isFile: true },
    { key: "logs", label: "Logs", rel: "storage/logs" },
    { key: "temp", label: "Cache/temporales", rel: "storage/framework" },
    { key: "deps", label: "Dependencias", rel: "vendor" },
  ],
  wordpress: [
    { key: "public", label: "Raíz pública", rel: ".", isPublicRoot: true },
    { key: "config", label: "wp-config.php (sensible)", rel: "wp-config.php", sensitive: true, isFile: true },
    { key: "content", label: "Contenido (plugins/temas)", rel: "wp-content" },
    { key: "uploads", label: "Subidas", rel: "wp-content/uploads" },
    { key: "core", label: "Núcleo", rel: "wp-includes" },
  ],
  nextjs: [
    { key: "public", label: "Archivos públicos", rel: "public", isPublicRoot: true },
    { key: "appdir", label: "Rutas (app)", rel: "app" },
    { key: "pages", label: "Rutas (pages)", rel: "pages" },
    { key: "env", label: ".env (sensible)", rel: ".env", sensitive: true, isFile: true },
    { key: "build", label: "Build", rel: ".next" },
    { key: "deps", label: "Dependencias", rel: "node_modules" },
  ],
  nuxt: [
    { key: "public", label: "Públicos", rel: "public", isPublicRoot: true },
    { key: "pages", label: "Páginas", rel: "pages" },
    { key: "components", label: "Componentes", rel: "components" },
    { key: "build", label: "Build", rel: ".output" },
    { key: "deps", label: "Dependencias", rel: "node_modules" },
  ],
  vue: [
    { key: "src", label: "Código fuente", rel: "src" },
    { key: "public", label: "Públicos", rel: "public", isPublicRoot: true },
    { key: "build", label: "Build", rel: "dist" },
    { key: "deps", label: "Dependencias", rel: "node_modules" },
  ],
  react: [
    { key: "src", label: "Código fuente", rel: "src" },
    { key: "public", label: "Públicos", rel: "public", isPublicRoot: true },
    { key: "build", label: "Build", rel: "build" },
    { key: "deps", label: "Dependencias", rel: "node_modules" },
  ],
  node: [
    { key: "src", label: "Código fuente", rel: "src" },
    { key: "env", label: ".env (sensible)", rel: ".env", sensitive: true, isFile: true },
    { key: "deps", label: "Dependencias", rel: "node_modules" },
  ],
  django: [
    { key: "manage", label: "manage.py", rel: "manage.py", isFile: true },
    { key: "static", label: "Estáticos", rel: "static", isPublicRoot: true },
    { key: "media", label: "Media", rel: "media" },
    { key: "deps", label: "Entorno", rel: "venv" },
  ],
  python: [
    { key: "reqs", label: "Dependencias", rel: "requirements.txt", isFile: true },
    { key: "venv", label: "Entorno virtual", rel: "venv" },
  ],
  php: [
    { key: "index", label: "Entrada", rel: "index.php", isPublicRoot: true, isFile: true },
    { key: "deps", label: "Dependencias", rel: "vendor" },
  ],
};

function firstSegment(rel: string): string {
  if (rel === ".") return "";
  return rel.split("/")[0]!;
}

export const projectTypeService = {
  /** Detect the stack of a directory and return its logical map. */
  async detect(executor: Executor, dirPath: string): Promise<ProjectInfo> {
    const dir = safePath(dirPath);
    const listing = await gather(executor, dir);
    const { type, confidence, markers } = classify(listing);

    const tpl = SECTION_TEMPLATES[type] ?? [];
    let publicRoot: string | undefined;
    const sections: ProjectSection[] = tpl.map((t) => {
      const abs = t.rel === "." ? dir : path.posix.join(dir, t.rel);
      const seg = firstSegment(t.rel);
      const exists = seg === "" ? true : listing.names.has(seg);
      if (t.isPublicRoot) publicRoot = abs;
      return { key: t.key, label: t.label, path: abs, exists, sensitive: t.sensitive, isFile: t.isFile };
    });

    return {
      type,
      label: TYPE_LABELS[type],
      confidence,
      publicRoot,
      markers,
      sections,
    };
  },
};
