/**
 * Preview "Modo B" — instalación privada del módulo del dev en SU panel.
 *
 * Flujo: valida el manifest del módulo del proyecto (en el TARGET), vendoriza
 * el árbol target→panel host en `modules/community/installed/<id>/`, escribe el
 * marker `.preview.json` (owner/proyecto) y dispara la recarga del loader vía
 * event bus (regla no-cross-imports: module-dev NO importa modules/community).
 * El loader, al ver el marker, registra las tools pero NO publica el módulo en
 * el catálogo → invisible para todos salvo el dueño (asistente/MCP filtran por
 * owner; el dispatch HTTP de prueba vive en este módulo, owner-gated).
 *
 * ⚠️ ESTADO REAL DEL RUNTIME (leer antes de tocar): el runtime aislado para
 * ejecutar el código del preview NO EXISTE todavía. La única frontera aceptable
 * para código de un dev declarado ADVERSARIO contra un proceso que comparte
 * heap con material mTLS, LUXIPANEL_KEY y executores SSH de OTROS tenants es
 * OUT-OF-PROCESS (proceso/contenedor separado, seccomp/landlock, sin red, sin
 * secretos heredados). Un isolated-vm EN PROCESO NO es una frontera dura frente
 * a un 0-day de V8/isolated-vm (la propia doc de isolated-vm lo advierte), y un
 * 0-day ahí = RCE a nivel de proceso = robo de secretos cross-tenant. Por eso:
 *
 *   - El loader NUNCA hace `import()` en proceso de un preview (ver
 *     community-loader §SEGURIDAD): los previews quedan vendorizados en disco
 *     pero su código no se ejecuta.
 *   - `dispatchPreviewTool` NO puede ejecutar nada hasta que
 *     `previewSandboxRuntime.isAvailable()` sea verdadero (runtime
 *     out-of-process integrado y auto-verificado). Hoy devuelve isAvailable()
 *     = false → fail-closed.
 *   - `MODULE_DEV_PREVIEW_ENABLED` (default FALSE) es un opt-in del operador
 *     SOBRE el flujo de vendorizado, no una autorización para ejecutar código
 *     no aislado. Con el flag encendido pero SIN runtime aislado, instalar un
 *     preview deja archivos en disco y nada más (las tools no corren).
 *
 * Gate compensatorio v1 (defensa-en-profundidad, no la frontera): validación
 * estricta del manifest + caps de tamaño (env MODULE_DEV_PREVIEW_*) + solo el
 * propio dev puede instalar/invocar + rutas admin-only.
 */

import path from "node:path";
import { posix } from "node:path";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { quoteCmd } from "../../../shared/executor/quote.js";
import type { Executor } from "../../../shared/executor/types.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/index.js";
import { env } from "../../../config/env.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import {
  communityPreviewRegistry,
  getCommunityInstalledDir,
  PREVIEW_MARKER_FILE,
  type PreviewMeta,
} from "../../../shared/community-preview/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { previewSandboxRuntime } from "../../../shared/preview-sandbox/runtime.js";
import { validateManifest } from "./manifest-validator.service.js";
import {
  readModuleManifest,
  requireLink,
  requireTargetExecutor,
  resolveModuleDir,
} from "./test-runner.service.js";
import type { PreviewInstallResult } from "../models/index.js";
import { MODULE_ID_RE } from "../../../shared/marketplace-link/index.js";

const log = createModuleLogger("module-dev:preview");

// MODULE_ID_RE is the single source of truth in shared/marketplace-link.
const TOOL_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/** Directorios excluidos del vendorizado (cualquier segmento del path). */
export const EXCLUDED_SEGMENTS = ["node_modules", ".git", "dist", ".cache"] as const;

/** Cap duro por archivo (bytes): 2 MB. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface PreviewFileEntry {
  rel: string;
  size: number;
}

// ── Piezas puras (testeables sin executor/fs) ───────────────────────────────

/** true si el path relativo cae en un directorio excluido. */
export function isExcludedRel(rel: string): boolean {
  return rel.split("/").some((seg) => (EXCLUDED_SEGMENTS as readonly string[]).includes(seg));
}

/** Path-guard anti-traversal: cada rel debe quedarse DENTRO del destino. */
export function assertSafeRel(rel: string): void {
  if (
    !rel ||
    rel.startsWith("/") ||
    rel.includes("\\") ||
    rel.includes("\0") ||
    rel.split("/").some((seg) => seg === ".." || seg === "")
  ) {
    throw new ValidationError(`Ruta de archivo insegura en el módulo: "${rel}"`);
  }
}

/**
 * Filtra exclusiones, aplica el path-guard y verifica los caps de tamaño.
 * Lanza ValidationError tipado ante cualquier exceso (fail-closed).
 */
export function selectPreviewFiles(
  entries: PreviewFileEntry[],
  caps: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number },
): { files: PreviewFileEntry[]; totalBytes: number } {
  const files: PreviewFileEntry[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    if (isExcludedRel(entry.rel)) continue;
    if (entry.rel === PREVIEW_MARKER_FILE) continue; // el marker lo escribe el panel
    assertSafeRel(entry.rel);
    if (entry.size > caps.maxFileBytes) {
      throw new ValidationError(
        `El archivo "${entry.rel}" pesa ${entry.size} bytes (cap por archivo: ${caps.maxFileBytes})`,
      );
    }
    files.push(entry);
    totalBytes += entry.size;
  }
  if (files.length > caps.maxFiles) {
    throw new ValidationError(
      `El módulo tiene ${files.length} archivos (cap: ${caps.maxFiles}). Excluye artefactos o reduce el árbol.`,
    );
  }
  if (totalBytes > caps.maxTotalBytes) {
    throw new ValidationError(
      `El módulo pesa ${totalBytes} bytes (cap total: ${caps.maxTotalBytes}).`,
    );
  }
  return { files, totalBytes };
}

// ── Listado del árbol en el target ──────────────────────────────────────────

async function listModuleFiles(executor: Executor, moduleDir: string): Promise<PreviewFileEntry[]> {
  // GNU find (targets Linux): poda los dirs excluidos y emite "SIZE PATH".
  const argv = [
    moduleDir,
    "(", "-name", "node_modules", "-o", "-name", ".git", "-o", "-name", "dist", "-o", "-name", ".cache", ")",
    "-prune", "-o", "-type", "f", "-printf", "%s %p\\n",
  ];
  const result = await executor.exec(quoteCmd("find", argv), { timeoutMs: 30_000 });
  if (result.exitCode !== 0) {
    throw new ValidationError(
      `No se pudo listar el módulo en el servidor: ${result.stderr.slice(0, 300) || `exit ${result.exitCode}`}`,
    );
  }
  const prefix = moduleDir.endsWith("/") ? moduleDir : `${moduleDir}/`;
  const entries: PreviewFileEntry[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^(\d+) (.+)$/);
    if (!match) continue;
    const abs = match[2]!;
    if (!abs.startsWith(prefix)) continue;
    entries.push({ rel: abs.slice(prefix.length), size: Number(match[1]) });
  }
  return entries;
}

function assertModuleId(moduleId: string): string {
  const id = String(moduleId);
  if (!MODULE_ID_RE.test(id)) {
    throw new ValidationError(`Id de módulo inválido: "${id}"`);
  }
  return id;
}

// ── Servicio ────────────────────────────────────────────────────────────────

export const previewService = {
  /** Previews instalados (fuente: registry en memoria, poblado por el loader). */
  list(): PreviewMeta[] {
    return communityPreviewRegistry.list();
  },

  /**
   * Instala el módulo del proyecto como preview privado del dev (Modo B):
   * valida manifest, vendoriza target→panel host con caps, escribe marker y
   * dispara la recarga del loader por event bus.
   */
  async install(projectId: string, user: SessionUser): Promise<PreviewInstallResult> {
    // Kill-switch fail-closed: el preview ejecuta código de terceros en el
    // proceso del backend (sin sandbox todavía) — solo con opt-in explícito.
    if (!env.MODULE_DEV_PREVIEW_ENABLED) {
      throw new ForbiddenError(
        "El preview Modo B está deshabilitado en esta instancia (MODULE_DEV_PREVIEW_ENABLED=false): " +
          "ejecuta código sin revisar dentro del proceso del panel y requiere opt-in del operador. " +
          "Usa los checks/tests (/mod probar) y el envío a revisión (/mod enviar).",
      );
    }
    const executor = requireTargetExecutor();
    const link = await requireLink(executor, projectId);
    const moduleId = assertModuleId(link.moduleId);
    const moduleDir = await resolveModuleDir(executor, link);

    // 1. Manifest del target → validación estricta (gate compensatorio v1).
    const read = await readModuleManifest(executor, moduleDir);
    if (!read.found) {
      throw new ValidationError(`No existe module.manifest.json en ${moduleDir}`);
    }
    if (read.error) {
      throw new ValidationError(`module.manifest.json inválido: ${read.error}`);
    }
    const validation = validateManifest(read.manifest);
    if (!validation.valid) {
      throw new ValidationError(
        "El manifest no pasa la validación — corrígelo antes del preview",
        validation.errors.map((e) => ({ field: e.path, message: e.message })),
      );
    }
    const manifest = read.manifest as Record<string, unknown>;
    if (manifest.id !== moduleId) {
      throw new ValidationError(
        `El id del manifest ("${String(manifest.id)}") no coincide con el módulo vinculado ("${moduleId}")`,
      );
    }

    // 2. Mutaciones de preview: scope local forzado + versión efímera si falta.
    manifest.scope = "local";
    if (typeof manifest.version !== "string" || !manifest.version) {
      manifest.version = `0.0.0-preview.${Date.now()}`;
    }

    // 3. Árbol del módulo en el target, con exclusiones y caps.
    const entries = await listModuleFiles(executor, moduleDir);
    const { files, totalBytes } = selectPreviewFiles(entries, {
      maxFiles: env.MODULE_DEV_PREVIEW_MAX_FILES,
      maxFileBytes: MAX_FILE_BYTES,
      maxTotalBytes: env.MODULE_DEV_PREVIEW_MAX_TOTAL_MB * 1024 * 1024,
    });

    // 4. Destino en el panel host. Re-instalar un preview lo refresca; un dir
    //    SIN marker es un módulo aprobado vendorizado → JAMÁS se toca.
    const installedDir = getCommunityInstalledDir();
    const destDir = path.join(installedDir, moduleId);
    if (existsSync(destDir)) {
      if (!existsSync(path.join(destDir, PREVIEW_MARKER_FILE))) {
        throw new ConflictError(
          `Ya existe un módulo instalado (no-preview) con id "${moduleId}" — no se sobreescribe`,
        );
      }
      await fs.rm(destDir, { recursive: true, force: true });
    }
    await fs.mkdir(destDir, { recursive: true });

    // 5. Copia archivo a archivo (cada rel ya pasó el path-guard; el resolve
    //    final re-verifica que nada escape del destino).
    for (const file of files) {
      const dest = path.resolve(destDir, file.rel);
      if (dest !== destDir && !dest.startsWith(destDir + path.sep)) {
        throw new ValidationError(`Ruta fuera del destino del preview: "${file.rel}"`);
      }
      const srcAbs = posix.join(moduleDir, file.rel);
      // Hardening de vendorizado (RUNTIME-DESIGN §6.3, §9): `assertSafeRel` sólo
      // valida la cadena rel, NO el inodo resultante. Un symlink (o cualquier
      // archivo no-regular) en el árbol del módulo podría apuntar fuera del dir
      // del módulo (p.ej. a un secreto del servidor) y quedar vendorizado/leído
      // por el sandbox. `find -type f` ya excluye symlinks del listado, pero el
      // inodo puede ser reemplazado entre el listado y la lectura (TOCTOU). Por
      // eso re-verificamos por destino con un `lstat` REAL (no `executor.stat`,
      // que vía SFTP SIGUE el symlink): `test -L` / `test -f` no siguen el enlace.
      // No cambia el contrato — sólo endurece.
      const check = await executor.exec(
        quoteCmd("sh", [
          "-c",
          // -L symlink → exit 10 ; not a regular file → exit 11 ; else 0
          'if [ -L "$1" ]; then exit 10; elif [ ! -f "$1" ]; then exit 11; fi',
          "sh",
          srcAbs,
        ]),
      );
      if (check.exitCode !== 0) {
        throw new ValidationError(
          `El archivo "${file.rel}" no es un archivo regular ` +
            `(${check.exitCode === 10 ? "es un symlink" : "tipo especial"}); ` +
            "los previews no admiten symlinks ni archivos especiales.",
        );
      }
      const data = await executor.readFile(srcAbs);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, typeof data === "string" ? Buffer.from(data, "utf8") : data);
    }

    // 6. Manifest mutado + marker de preview.
    await fs.writeFile(
      path.join(destDir, "module.manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    const marker = {
      preview: true,
      ownerUserId: String(user.userId),
      ownerUsername: user.username,
      projectId: String(projectId),
      moduleId,
      installedAt: new Date().toISOString(),
      source: "module-dev",
    };
    await fs.writeFile(path.join(destDir, PREVIEW_MARKER_FILE), JSON.stringify(marker, null, 2));

    // 7. Registro de METADATOS del preview (NO ejecución de código). El loader
    //    NUNCA importa previews en proceso (community-loader §SEGURIDAD), así
    //    que el evento de recarga no registraría capacidades; registramos solo
    //    el meta (owner/módulo) para que el dueño lo vea/desinstale y para que
    //    el dispatch llegue al gate fail-closed del runtime aislado. El código
    //    del preview queda INERTE hasta que exista el runtime out-of-process.
    communityPreviewRegistry.register({
      moduleId,
      ownerUserId: String(user.userId),
      ownerUsername: user.username,
      projectId: String(projectId),
      installedAt: marker.installedAt,
    });
    eventBus.emit(Events.COMMUNITY_RELOAD, { moduleId });
    const loaded = previewSandboxRuntime.isAvailable();

    log.info(
      { moduleId, files: files.length, bytes: totalBytes, loaded, runtime: previewSandboxRuntime.describe() },
      "preview vendored (code is inert until the out-of-process sandbox runtime is available)",
    );
    return {
      moduleId,
      files: files.length,
      bytes: totalBytes,
      loaded,
      warnings: validation.warnings.map((w) => (w.path ? `${w.path}: ${w.message}` : w.message)),
    };
  },

  /**
   * Desinstala un preview. Solo el dev que lo instaló (owner) puede hacerlo;
   * un dir installed/<id> SIN `.preview.json` es un módulo aprobado y NUNCA
   * se borra desde aquí.
   */
  async uninstall(moduleId: string, user: SessionUser): Promise<{ removed: boolean }> {
    const id = assertModuleId(moduleId);
    const destDir = path.join(getCommunityInstalledDir(), id);
    const markerPath = path.join(destDir, PREVIEW_MARKER_FILE);
    const dirExists = existsSync(destDir);

    const meta = communityPreviewRegistry.get(id);
    if (!meta && !dirExists) throw new NotFoundError("Preview");
    if (dirExists && !existsSync(markerPath)) {
      throw new ForbiddenError(
        `"${id}" está instalado pero NO es un preview — los módulos aprobados no se eliminan desde module-dev`,
      );
    }

    // Owner del registry o, tras un restart sin recarga, del marker en disco.
    let owner = meta?.ownerUserId ?? "";
    if (!owner && dirExists) {
      try {
        const raw = JSON.parse(await fs.readFile(markerPath, "utf-8")) as { ownerUserId?: unknown };
        owner = String(raw.ownerUserId ?? "");
      } catch {
        owner = "";
      }
    }
    if (!owner || String(user.userId) !== String(owner)) {
      throw new ForbiddenError("Solo el dev que instaló el preview puede desinstalarlo");
    }

    eventBus.emit(Events.COMMUNITY_UNLOAD, { moduleId: id });
    if (dirExists) await fs.rm(destDir, { recursive: true, force: true });
    // Defensa extra por si el listener del loader no corrió.
    communityPreviewRegistry.unregister(id);

    log.info({ moduleId: id }, "preview uninstalled");
    return { removed: dirExists };
  },

  /**
   * Dispatch HTTP de prueba de una tool del preview, owner-gated. La ruta
   * genérica /api/community/* queda bloqueada para previews (requireModule no
   * conoce módulos fuera del catálogo) — este es el ÚNICO camino HTTP.
   * Corre dentro del scope del request → el handler hereda el executor por ALS.
   */
  async dispatchPreviewTool(
    moduleId: string,
    name: string,
    input: unknown,
    user: SessionUser,
  ): Promise<{ ok: boolean; output: unknown }> {
    const id = assertModuleId(moduleId);
    const meta = communityPreviewRegistry.get(id);
    if (!meta) throw new NotFoundError("Preview");
    if (String(user.userId) !== meta.ownerUserId) {
      throw new ForbiddenError("Solo el dev dueño del preview puede invocar sus tools");
    }
    if (!TOOL_NAME_RE.test(String(name))) {
      throw new ValidationError(`Nombre de tool inválido: "${String(name)}"`);
    }
    // FRONTERA DURA (fail-closed): ejecutar la tool del preview = correr código
    // de un dev adversario. Sólo se permite a través del runtime aislado
    // out-of-process auto-verificado. Mientras no exista, NO hay dispatch — y
    // tampoco hay handler in-process registrado (el loader nunca importa
    // previews). No caer NUNCA a `agentCapabilityRegistry.findTool(...).handler`
    // para un preview: sería ejecución en proceso del código no aislado.
    if (!previewSandboxRuntime.isAvailable()) {
      throw new ForbiddenError(
        "El runtime aislado de preview no está disponible en esta instancia " +
          `(${previewSandboxRuntime.describe()}). El código del preview NO se ejecuta en el ` +
          "proceso del panel (frontera dura multi-tenant). Usa los checks/tests (/mod probar) " +
          "para validar el módulo; el dispatch de tools requiere el sandbox out-of-process.",
      );
    }
    // Camino futuro: delegar al runtime aislado, que ejecuta el entry del
    // preview en su propio proceso/contenedor sin secretos heredados y devuelve
    // el resultado copiado por valor. NO se usa el agentCapabilityRegistry
    // in-process para previews.
    return await previewSandboxRuntime.dispatch({
      moduleId: id,
      installedDir: path.join(getCommunityInstalledDir(), id),
      tool: String(name),
      input: input ?? {},
    });
  },
};
