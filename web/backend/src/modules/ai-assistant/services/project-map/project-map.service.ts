// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Project Map.
 *
 * Generates a friendly, NON-technical "map" of a project using a chosen
 * provider from the assistant module. The map is a set of tabs; each tab is a
 * "body part" of the project (the front door, the brain, the memory/data, the
 * muscles/processes, the skin/what the user sees, the outside connections),
 * explained in plain language plus ONE Mermaid flowchart diagram. All tabs
 * together form the complete map of the project.
 *
 * - API-mode providers: we deep-scan the directory (tree + key file contents,
 *   capped, with secrets redacted) and embed that as context.
 * - CLI-mode providers: the CLI runs with the project dir as cwd and explores
 *   the repo itself (truly deep), then returns the JSON.
 *
 * The caller (controller) persists the result under LUXIPANEL_CONFIG_DIR so
 * reopening is instant; only "Regenerate" spends tokens again.
 */

import path from "node:path";
import type { Executor } from "../../../../shared/executor/index.js";
import { ValidationError } from "../../../../shared/errors/index.js";
import { apiModuleMessage } from "../../../../shared/i18n/module-messages.js";
import type { AssistantConfig, AssistantProviderId } from "../../models/assistant-config.types.js";
import { runCliOnceBackground } from "../providers/cli-bridge.provider.js";
import { aiComplete } from "../translation/ai-translator.js";

export interface ProjectMapTab {
  id: string;
  /** Short, friendly title (e.g. "La puerta de entrada"). */
  title: string;
  /** Plain-language explanation, no jargon. */
  plainExplanation: string;
  /** A self-contained Mermaid flowchart definition. */
  mermaid: string;
}

export interface ProjectMap {
  project: { name: string; type: string; summary: string };
  tabs: ProjectMapTab[];
  provider: AssistantProviderId;
  generatedAt: string;
}

// ── Deep scan caps (bounded so huge repos stay affordable) ──────────────────
const MAX_DEPTH = 4;
const MAX_TREE_ENTRIES = 1200;
const MAX_KEY_FILES = 24;
const MAX_FILE_BYTES = 14_000;
const MAX_READ_SIZE = 400_000; // don't even read files bigger than this
const TOTAL_CONTENT_BUDGET = 110_000;

const SKIP_DIRS = new Set([
  "node_modules", ".git", "vendor", "dist", "build", ".next", ".nuxt", ".output",
  "coverage", "tmp", "temp", ".cache", "cache", ".turbo", ".astro", "__pycache__",
  ".venv", "venv", ".idea", ".vscode", "bower_components", "target", ".gradle",
  ".pnpm-store", ".svelte-kit", "out",
]);

const KEY_EXACT = new Set([
  "package.json", "composer.json", "tsconfig.json", "requirements.txt", "pyproject.toml",
  "go.mod", "cargo.toml", "gemfile", "pom.xml", "build.gradle", "dockerfile",
  "docker-compose.yml", "docker-compose.yaml", "makefile", "artisan", "manage.py",
  "next.config.js", "next.config.mjs", "nuxt.config.ts", "vite.config.ts", "vite.config.js",
  "astro.config.mjs", "svelte.config.js", "ecosystem.config.cjs", "ecosystem.config.js",
  "nginx.conf", "wp-config.php", ".env", ".env.example",
]);

function isKeyFile(name: string): boolean {
  const n = name.toLowerCase();
  if (KEY_EXACT.has(n)) return true;
  if (/^readme/.test(n)) return true;
  if (/(^|\.)env(\.|$)/.test(n)) return true;
  return false;
}

/** Common entry-point source files near the root — read for a deeper picture. */
function isEntryFile(name: string, depth: number): boolean {
  if (depth > 2) return false;
  return /^(index|main|app|server|routes?|config|settings|urls|wsgi|asgi)\.(js|ts|mjs|cjs|jsx|tsx|py|php|go|rb)$/i.test(name);
}

interface Candidate { path: string; name: string; depth: number; size: number; key: boolean }

/** Minimal absolute-path guard (mirrors files/safePath intent without a cross-module import). */
function safeDir(p: string): string {
  const norm = path.posix.normalize(p || "/");
  if (!norm.startsWith("/")) throw new ValidationError("La ruta del proyecto debe ser absoluta.");
  return norm.replace(/\/+$/, "") || "/";
}

async function walk(
  executor: Executor,
  base: string,
  dir: string,
  depth: number,
  acc: { lines: string[]; files: Candidate[]; count: number },
  reusedDirs: Set<string>,
): Promise<void> {
  if (acc.count >= MAX_TREE_ENTRIES || depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await executor.readdir(dir);
  } catch {
    return;
  }
  // Directories first, then files; alphabetical within each.
  entries.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  const indent = "  ".repeat(depth);
  for (const e of entries) {
    if (acc.count >= MAX_TREE_ENTRIES) break;
    // Skip noisy hidden entries but keep .env* (useful, redacted) and a few dotfiles.
    if (e.name.startsWith(".") && !/(^\.env)|(^\.(github|gitlab|docker))/i.test(e.name) && e.name !== ".") {
      if (e.isDir && !/^\.(github|gitlab|docker)/i.test(e.name)) continue;
    }
    const child = path.posix.join(dir, e.name);
    acc.lines.push(`${indent}${e.name}${e.isDir ? "/" : ""}`);
    acc.count++;
    if (e.isDir) {
      // A subfolder that already has its own cached map: don't re-scan it — its
      // summary is fed in separately (reuse), so we just mark it and move on.
      if (reusedDirs.has(child)) {
        acc.lines.push(`${indent}  …(mapa propio reutilizado)`);
        continue;
      }
      if (SKIP_DIRS.has(e.name)) {
        acc.lines.push(`${indent}  …(omitido)`);
        continue;
      }
      await walk(executor, base, child, depth + 1, acc, reusedDirs);
    } else {
      acc.files.push({ path: child, name: e.name, depth, size: e.size ?? 0, key: isKeyFile(e.name) });
    }
  }
}

function redactSecrets(name: string, content: string): string {
  // .env-like files: keep the keys, hide the values entirely.
  if (/(^|\.)env(\.|$)/i.test(name)) {
    return content.replace(/^(\s*(?:export\s+)?[A-Za-z0-9_]+\s*=).*$/gm, "$1 «oculto»");
  }
  // Generic: mask obvious secret assignments in code/config.
  return content.replace(
    /("?(?:password|passwd|secret|token|api[_-]?key|apikey|private[_-]?key|access[_-]?key|client[_-]?secret|authorization|bearer)"?\s*[:=]\s*)("[^"]*"|'[^']*'|`[^`]*`|[^\s,;}]+)/gi,
    "$1«oculto»",
  );
}

async function gatherDeep(
  executor: Executor,
  dir: string,
  reusedDirs: Set<string>,
): Promise<{ tree: string; blocks: string }> {
  const acc = { lines: [] as string[], files: [] as Candidate[], count: 0 };
  await walk(executor, dir, dir, 0, acc, reusedDirs);

  // Pick files to read: key files first, then shallow entry-point sources.
  const keyFiles = acc.files.filter((f) => f.key);
  const entryFiles = acc.files.filter((f) => !f.key && isEntryFile(f.name, f.depth));
  const chosen = [...keyFiles, ...entryFiles].slice(0, MAX_KEY_FILES);

  const blocks: string[] = [];
  let budget = TOTAL_CONTENT_BUDGET;
  for (const f of chosen) {
    if (budget <= 0) break;
    if (f.size > MAX_READ_SIZE) continue;
    let raw: string;
    try {
      const data = await executor.readFile(f.path, "utf-8");
      raw = typeof data === "string" ? data : data.toString("utf-8");
    } catch {
      continue;
    }
    let text = raw.slice(0, MAX_FILE_BYTES);
    text = redactSecrets(f.name, text);
    if (text.length > budget) text = text.slice(0, budget);
    budget -= text.length;
    const rel = path.posix.relative(dir, f.path) || f.name;
    blocks.push(`=== ${rel} ===\n${text.trim()}`);
  }

  return { tree: acc.lines.join("\n").slice(0, 24_000), blocks: blocks.join("\n\n") };
}

// ── Reuse of already-generated subfolder maps ───────────────────────────────
export interface ChildMapInput { path: string; map: ProjectMap }

const MAX_CHILD_MAPS = 15;
const CHILD_BLOCK_BUDGET = 18_000;

/** Pick the shallowest subfolder maps and condense them into prompt context. */
function selectChildMaps(dir: string, children: ChildMapInput[]): ChildMapInput[] {
  const depthOf = (p: string) => path.posix.relative(dir, p).split("/").length;
  return [...children].sort((a, b) => depthOf(a.path) - depthOf(b.path)).slice(0, MAX_CHILD_MAPS);
}

function buildChildBlock(dir: string, children: ChildMapInput[]): string {
  if (children.length === 0) return "";
  const parts: string[] = [];
  let budget = CHILD_BLOCK_BUDGET;
  for (const c of children) {
    if (budget <= 0) break;
    const rel = path.posix.relative(dir, c.path) || c.path;
    const m = c.map;
    const tabLines = m.tabs
      .map((t) => `  - ${t.title}: ${t.plainExplanation}`)
      .join("\n");
    const block = `### Subcarpeta «${rel}» — ${m.project.type || "proyecto"}\nResumen: ${m.project.summary}\nPartes ya mapeadas:\n${tabLines}`;
    const trimmed = block.slice(0, budget);
    budget -= trimmed.length;
    parts.push(trimmed);
  }
  return parts.join("\n\n");
}

// ── Prompt building ─────────────────────────────────────────────────────────
const MAP_SCHEMA =
  `{"project":{"name":string,"type":string,"summary":string},` +
  `"tabs":[{"id":string,"title":string,"plainExplanation":string,"mermaid":string}]}`;

function systemPrompt(language: string): string {
  return [
    "Eres un guía que le explica un proyecto de software a una persona NO técnica (el dueño del servidor).",
    "Tu tarea: producir un MAPA DETALLADO del proyecto dividido en pestañas. Cada pestaña es como una PARTE DEL CUERPO del proyecto:",
    "por ejemplo «la puerta de entrada» (cómo llega la gente), «el cerebro» (la lógica principal), «la memoria» (dónde se guardan los datos),",
    "«los músculos» (procesos/tareas que trabajan), «la piel/la cara» (lo que ve el usuario) y «las conexiones al exterior» (servicios externos).",
    "Adapta las partes al proyecto real; todas juntas forman el mapa completo y minucioso.",
    "",
    "Para CADA pestaña incluye:",
    "- title: un título corto y amigable en el idioma indicado.",
    "- plainExplanation: 4 a 7 frases en lenguaje MUY sencillo, con analogías cotidianas, SIN jerga técnica. Sé DETALLADO: menciona los componentes reales (carpetas, servicios, piezas) que viste, qué hace cada uno y cómo se relacionan, pero explicado en palabras simples.",
    "- mermaid: UN diagrama Mermaid (flowchart) RICO que ilustre esa parte con sus piezas reales y cómo fluye la información entre ellas.",
    "",
    "Haz el mapa DETALLADO: prefiere más piezas concretas y bien explicadas antes que diagramas vacíos o genéricos. Cada diagrama debe reflejar componentes reales del proyecto, no cajas abstractas.",
    "",
    "REGLAS ESTRICTAS del diagrama Mermaid (deben ser válidos o se rompe la vista):",
    "- Empieza SIEMPRE con 'flowchart TD' o 'flowchart LR'.",
    "- IDs de nodo simples y únicos (A, B, C, P1, P2…). Usa entre 6 y 14 nodos por diagrama (suficientes para detallar la parte, sin saturar).",
    "- Etiqueta las flechas cuando ayude: 'A -->|envía datos| B'.",
    "- Texto de nodo entre corchetes [ ] y en el idioma indicado, corto. NO uses comillas dobles, paréntesis, ni los caracteres < > & ; \\ | { } dentro del texto del nodo.",
    "- NO uses 'click', NI subgraphs, NI estilos css externos. Como mucho líneas 'style X fill:#hex,color:#fff'.",
    "",
    "Si te facilito MAPAS DE SUBCARPETAS ya generados, REUTILÍZALOS: intégralos como partes del mapa global (puedes dedicarles una pestaña que los resuma y conéctalos con el resto) en vez de volver a analizar esas subcarpetas desde cero.",
    "",
    "SALIDA: responde EXCLUSIVAMENTE con un objeto JSON válido (sin ``` y sin texto antes o después) con esta forma exacta:",
    MAP_SCHEMA,
    `Entre 5 y 8 pestañas. 'type' = tipo de proyecto detectado (Laravel, Next.js, WordPress, Node, Django…). Escribe el contenido visible (títulos, explicaciones, resumen y etiquetas del diagrama) en ${language}, con palabras sencillas.`,
  ].join("\n");
}

function userPromptApi(projectName: string, tree: string, blocks: string, childBlock: string): string {
  const lines = [
    `Nombre de la carpeta del proyecto: ${projectName}`,
    "",
    "ESTRUCTURA DE ARCHIVOS (recortada):",
    tree || "(vacía)",
    "",
    "CONTENIDO DE ARCHIVOS CLAVE (recortado; los secretos aparecen como «oculto»):",
    blocks || "(sin archivos legibles)",
  ];
  if (childBlock) {
    lines.push(
      "",
      "MAPAS DE SUBCARPETAS YA GENERADOS (reutiliza esta información; estas subcarpetas no se re-escanearon a fondo):",
      childBlock,
    );
  }
  lines.push("", "Genera ahora el mapa DETALLADO del proyecto en el JSON pedido.");
  return lines.join("\n");
}

function userPromptCli(projectName: string, childBlock: string): string {
  const lines = [
    `Estás dentro del directorio del proyecto «${projectName}» (tu directorio de trabajo actual).`,
    "Explora los archivos que necesites para entenderlo a fondo (manifiestos como package.json/composer.json, configuración, código de entrada, rutas, módulos).",
    "NO modifiques ningún archivo, NO crees archivos y NO ejecutes comandos con efectos: solo lee para entender.",
    "Ignora carpetas pesadas como node_modules, vendor, .git, dist, build.",
  ];
  if (childBlock) {
    lines.push(
      "",
      "Estas subcarpetas YA tienen su propio mapa; REUTILIZA esta información y NO vuelvas a analizarlas a fondo:",
      childBlock,
    );
  }
  lines.push("", "Luego genera el mapa DETALLADO del proyecto en el JSON pedido.");
  return lines.join("\n");
}

// ── Parsing / sanitizing the model output ───────────────────────────────────
function extractJson(s: string): string {
  let t = s.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function sanitizeMermaid(s: string): string {
  let m = (s || "").trim();
  m = m.replace(/^```(?:mermaid)?/i, "").replace(/```$/, "").trim();
  // Guarantee a flowchart header so the renderer doesn't choke on prose.
  if (!/^(flowchart|graph)\s/i.test(m)) return "";
  return m.slice(0, 6000);
}

function parseMap(raw: string, providerId: AssistantProviderId, locale: unknown): ProjectMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new ValidationError("La IA no devolvió un mapa válido (no es JSON). Prueba con otro proveedor.");
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const projectObj = (obj["project"] ?? {}) as Record<string, unknown>;
  const tabsRaw = Array.isArray(obj["tabs"]) ? (obj["tabs"] as unknown[]) : [];

  const tabs: ProjectMapTab[] = tabsRaw
    .map((raw, i) => {
      const t = (raw ?? {}) as Record<string, unknown>;
      return {
        id: String(t["id"] ?? `tab-${i + 1}`).slice(0, 64),
        title: String(t["title"] ?? apiModuleMessage(locale, "assistantMapPart").replace("{count}", () => String(i + 1))).slice(0, 120),
        plainExplanation: String(t["plainExplanation"] ?? "").slice(0, 4000),
        mermaid: sanitizeMermaid(String(t["mermaid"] ?? "")),
      };
    })
    .filter((t) => t.mermaid && t.title);

  if (tabs.length === 0) {
    throw new ValidationError("La IA no devolvió pestañas con diagramas válidos. Prueba a regenerar o con otro proveedor.");
  }

  return {
    project: {
      name: String(projectObj["name"] ?? "").slice(0, 160),
      type: String(projectObj["type"] ?? "").slice(0, 80),
      summary: String(projectObj["summary"] ?? "").slice(0, 2000),
    },
    tabs,
    provider: providerId,
    generatedAt: new Date().toISOString(),
  };
}

export const projectMapService = {
  /**
   * Generate a project map for `dir` using `providerId`. Runs the deep scan for
   * API providers; lets CLI providers explore the repo themselves. This is meant
   * to be called from a background task (NOT directly in an HTTP handler), so
   * the timeouts are generous (well above the nginx gateway limit).
   */
  async generate(
    executor: Executor,
    opts: {
      dir: string;
      providerId: AssistantProviderId;
      config: AssistantConfig;
      locale?: unknown;
      /** Language requested by the user for generated map text. */
      language?: string;
      /** Already-generated maps of subfolders, reused as context. */
      childMaps?: ChildMapInput[];
    },
  ): Promise<ProjectMap> {
    const dir = safeDir(opts.dir);
    const projectName = path.posix.basename(dir) || dir;
    const slot = opts.config.providers[opts.providerId];
    if (!slot) throw new ValidationError(`Proveedor desconocido: ${opts.providerId}`);

    const children = selectChildMaps(dir, opts.childMaps ?? []);
    const reusedDirs = new Set(children.map((c) => safeDir(c.path)));
    const childBlock = buildChildBlock(dir, children);

    const system = systemPrompt(opts.language ?? "Spanish");
    let rawText: string;

    if (slot.mode === "cli") {
      // CLI provider: explores the repo itself with the project dir as cwd.
      // Uses the NON-blocking runner (nohup + poll): a single blocking exec would
      // travel through the LP SSH proxy and hit nginx's ~60s gateway limit (504).
      try {
        rawText = await runCliOnceBackground({
          executor,
          id: opts.providerId,
          binOverride: slot.cli?.binPath,
          model: slot.cli?.model,
          prompt: `${system}\n\n${userPromptCli(projectName, childBlock)}`,
          cwd: dir,
          timeoutMs: 280_000,
        });
      } catch (e) {
        const msg = (e as Error)?.message || String(e);
        throw new ValidationError(`No se pudo generar el mapa (CLI ${opts.providerId}): ${msg.slice(0, 300)}`);
      }
    } else {
      // API provider: embed the deep scan as context (skipping subfolders that
      // already have their own map — they're summarized in childBlock instead).
      const scan = await gatherDeep(executor, dir, reusedDirs);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 280_000);
      try {
        const out = await aiComplete(opts.config, {
          providerId: opts.providerId,
          allowFallback: false, // explicit choice → clear error, no silent swap
          system,
          user: userPromptApi(projectName, scan.tree, scan.blocks, childBlock),
          signal: ac.signal,
        });
        rawText = out.text;
      } catch (e) {
        const msg = (e as Error)?.message || String(e);
        if (ac.signal.aborted) {
          throw new ValidationError("La generación del mapa tardó demasiado. Prueba con otro proveedor.");
        }
        throw new ValidationError(`No se pudo generar el mapa con IA: ${msg.slice(0, 300)}`);
      } finally {
        clearTimeout(timer);
      }
    }

    return parseMap(rawText, opts.providerId, opts.locale);
  },
};
