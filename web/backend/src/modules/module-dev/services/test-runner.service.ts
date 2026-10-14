import { diagnosticsStore } from "../../../shared/diagnostics/store.js";
import { moduleDiagnosticContext } from "../../../shared/diagnostics/module-events.js";
/**
 * Runner de tests + checks estáticos del módulo del marketplace vinculado a un
 * proyecto del asistente. TODO corre en el SERVIDOR TARGET conectado vía
 * `getContextExecutor()` (fail-closed): el código del proyecto vive allí, y en
 * managed ese target es el servidor del propio dev — el código de terceros
 * nunca toca el VPS de otro cliente (el executor per-request ya aísla por
 * servidor). La definición de un sandbox multi-tenant dedicado queda PENDIENTE
 * (MODULE-DEV-AI-FLOW.md §3.7).
 *
 * Límites del runner: timeout efectivo min(timeoutMs, MODULE_DEV_TEST_TIMEOUT_MS,
 * 600s) aplicado EN EL TARGET con `timeout(1)` (coreutils) + ceiling local de
 * cortesía; salida capada a MODULE_DEV_TEST_MAX_OUTPUT_KB; CI=1 no interactivo.
 * El comando se construye con quoteArg/quoteCmd (trampa shell-quoting conocida:
 * jamás JSON.stringify).
 */

import { posix } from "node:path";
import { requireExecutor } from "../../../shared/executor/require-executor.js";
import { quoteArg, quoteCmd } from "../../../shared/executor/quote.js";
import type { Executor, ExecResult } from "../../../shared/executor/types.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { EXEC_TIMEOUT_CAP_MS } from "../../../shared/constants.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import { env } from "../../../config/env.js";
import {
  marketplaceLinkRepository,
  type MarketplaceLink,
} from "../../../shared/marketplace-link/index.js";
import { validateManifest } from "./manifest-validator.service.js";
import type { ChecksRunResult, TestRunResult } from "../models/index.js";

const log = createModuleLogger("module-dev:test-runner");

// ── Acceso al proyecto en el target (compartido con preview.service) ────────

/** Executor del target conectado, fail-closed (nunca localExecutor). */
export function requireTargetExecutor(): Executor {
  return requireExecutor();
}

/** Vínculo proyecto↔módulo del marketplace, o 404 tipado con la pista del alta. */
export async function requireLink(executor: Executor, projectId: string): Promise<MarketplaceLink> {
  const link = await marketplaceLinkRepository.getByProjectId(executor, String(projectId));
  if (!link) {
    throw new NotFoundError(
      "Vínculo proyecto↔módulo del marketplace (créalo desde el asistente con /mod vincular)",
    );
  }
  return link;
}

/**
 * Directorio del módulo dentro del proyecto: `<projectPath>/modules/<moduleId>`
 * si allí existe module.manifest.json; si no, el propio projectPath.
 */
export async function resolveModuleDir(executor: Executor, link: MarketplaceLink): Promise<string> {
  const candidate = posix.join(link.projectPath, "modules", link.moduleId);
  try {
    await executor.stat(posix.join(candidate, "module.manifest.json"));
    return candidate;
  } catch {
    return link.projectPath;
  }
}

/** Lee y parsea module.manifest.json del target (sin lanzar). */
export async function readModuleManifest(
  executor: Executor,
  moduleDir: string,
): Promise<{ found: boolean; manifest?: unknown; error?: string }> {
  let raw: string;
  try {
    raw = String(await executor.readFile(posix.join(moduleDir, "module.manifest.json"), "utf-8"));
  } catch {
    return { found: false };
  }
  try {
    return { found: true, manifest: JSON.parse(raw) };
  } catch (err) {
    return { found: true, error: `JSON inválido: ${(err as Error).message}` };
  }
}

/**
 * Lectura DATA-LEVEL del sidecar de proyectos del asistente
 * (`${LUXIPANEL_CONFIG_DIR}/assistant/projects.json`) SOLO para la tool
 * `module-dev.link_project`. No importa código de ai-assistant (regla
 * no-cross-imports del repo): es el mismo contrato de datos per-target que ya
 * desnormaliza marketplace-link. Lookup SIEMPRE con String(id) (trampa kv).
 */
export async function readAssistantProject(
  executor: Executor,
  projectId: string,
): Promise<{ id: string; path: string; provider: string } | null> {
  const store = dataStore<{ path?: string; provider?: string }>(executor, "assistant", "projects", {
    idStrategy: "uuid",
  });
  const doc = await store.get(String(projectId));
  if (!doc || typeof doc.path !== "string" || !doc.path.trim()) return null;
  return {
    id: String(doc.id),
    path: doc.path.trim(),
    provider: typeof doc.provider === "string" && doc.provider ? doc.provider : "claude",
  };
}

// ── Piezas puras del runner (testeables sin executor) ───────────────────────

/** Comando base de tests: scripts.test → npm; si no, el runner nativo de Node. */
export function buildTestCommand(hasTestScript: boolean): string {
  return hasTestScript ? "npm test --silent" : "node --test";
}

/** Capa una salida a `maxBytes` con un marcador de truncado. */
export function capOutput(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const sliced = Buffer.from(text, "utf8").subarray(0, maxBytes).toString("utf8");
  return `${sliced}\n…[salida truncada a ${Math.round(maxBytes / 1024)}KB]`;
}

/** Timeout efectivo: min(timeoutMs ?? MODULE_DEV_TEST_TIMEOUT_MS, 600s). */
export function effectiveTimeoutMs(requested?: number): number {
  const base = requested && requested > 0 ? requested : env.MODULE_DEV_TEST_TIMEOUT_MS;
  return Math.min(base, EXEC_TIMEOUT_CAP_MS);
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function detectTestScript(executor: Executor, moduleDir: string): Promise<boolean> {
  try {
    const raw = String(await executor.readFile(posix.join(moduleDir, "package.json"), "utf-8"));
    const pkg = JSON.parse(raw) as { scripts?: Record<string, unknown> };
    return typeof pkg?.scripts?.test === "string" && (pkg.scripts.test as string).trim().length > 0;
  } catch {
    return false;
  }
}

export const testRunnerService = {
  /**
   * Ejecuta la suite de tests del módulo vinculado al proyecto en el TARGET.
   * Nunca lanza por fallo de la suite: el resultado (exit code, salida capada,
   * timedOut) se devuelve para que la UI/IA lo consuma.
   */
  async runTests(projectId: string, timeoutMs?: number): Promise<TestRunResult> {
    const executor = requireTargetExecutor();
    const link = await requireLink(executor, projectId);
    const moduleDir = await resolveModuleDir(executor, link);

    const hasTestScript = await detectTestScript(executor, moduleDir);
    const command = buildTestCommand(hasTestScript);
    const capMs = effectiveTimeoutMs(timeoutMs);
    const seconds = Math.max(1, Math.ceil(capMs / 1000));
    const maxBytes = env.MODULE_DEV_TEST_MAX_OUTPUT_KB * 1024;

    // `timeout(1)` mata EN EL TARGET (exit 124; -k remata con SIGKILL). El
    // ceiling local de cortesía solo cubre un transporte SSH colgado.
    const inner = `cd ${quoteArg(moduleDir)} && CI=1 timeout -k 5 ${seconds} ${command}`;
    const cmd = quoteCmd("sh", ["-lc", inner]);

    const startedAt = Date.now();
    let result: ExecResult;
    try {
      const localCeiling = new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error("LOCAL_TEST_TIMEOUT")),
          capMs + 30_000,
        );
        // No retener el proceso vivo por el timer.
        (t as { unref?: () => void }).unref?.();
      });
      result = await Promise.race([executor.exec(cmd, { timeoutMs: capMs + 30_000 }), localCeiling]);
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const message = errMessage(err);
      const timedOut = message === "LOCAL_TEST_TIMEOUT" || durationMs >= capMs;
      log.warn({ projectId, moduleDir, err: message }, "test run transport failure");
      return {
        command,
        exitCode: null,
        passed: false,
        timedOut,
        durationMs,
        stdout: "",
        stderr: capOutput(timedOut ? `Tiempo agotado (${capMs} ms): ${message}` : message, maxBytes),
      };
    }

    const durationMs = Date.now() - startedAt;
    if (result.exitCode !== 0 || /\bwarn(?:ing)?\b/i.test(result.stderr || "")) {
      const manifest = (await readModuleManifest(executor, moduleDir)).manifest as { version?: string } | undefined;
      moduleDiagnosticContext.run({ kind: "module", id: link.moduleId, version: manifest?.version || "draft", projectId, origin: "tests" }, () => diagnosticsStore.capture({ severity: result.exitCode === 0 ? "warn" : "error", source: "tests", module: link.moduleId, message: result.exitCode === 0 ? "Module test warning" : "Module tests failed", details: { exitCode: result.exitCode, output: capOutput(result.stdout + "\n" + result.stderr, maxBytes) } }));
    }
    // 124 = matado por `timeout`; 137 = SIGKILL del -k (solo cuenta como
    // timeout si de verdad agotó la ventana).
    const timedOut = result.exitCode === 124 || (result.exitCode === 137 && durationMs >= capMs);
    return {
      command,
      exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
      passed: result.exitCode === 0,
      timedOut,
      durationMs,
      stdout: capOutput(result.stdout ?? "", maxBytes),
      stderr: capOutput(result.stderr ?? "", maxBytes),
    };
  },

  /**
   * Checks estáticos del módulo del proyecto (NO ejecuta nada): valida el
   * manifest con el validador puro, comprueba que el entry backend exista y
   * devuelve notas accionables para la conversación con la IA.
   */
  async runChecks(projectId: string): Promise<ChecksRunResult> {
    const executor = requireTargetExecutor();
    const link = await requireLink(executor, projectId);
    const moduleDir = await resolveModuleDir(executor, link);
    const notes: string[] = [`Directorio del módulo: ${moduleDir}`];

    const read = await readModuleManifest(executor, moduleDir);
    if (!read.found) {
      notes.push("No se encontró module.manifest.json — genera el scaffold desde el asistente.");
      return {
        moduleId: link.moduleId,
        manifestFound: false,
        validation: {
          valid: false,
          errors: [{ path: "", message: "module.manifest.json no encontrado" }],
          warnings: [],
        },
        entryExists: false,
        notes,
      };
    }
    if (read.error) {
      notes.push("El manifest existe pero no es JSON válido.");
      return {
        moduleId: link.moduleId,
        manifestFound: true,
        validation: { valid: false, errors: [{ path: "", message: read.error }], warnings: [] },
        entryExists: false,
        notes,
      };
    }

    const validation = validateManifest(read.manifest);
    const manifest = read.manifest as Record<string, unknown>;

    if (manifest.id !== link.moduleId) {
      validation.errors.push({
        path: "id",
        message: `no coincide con el módulo vinculado ("${link.moduleId}")`,
      });
      validation.valid = false;
      notes.push(`El id del manifest ("${String(manifest.id)}") debe ser "${link.moduleId}".`);
    }

    const entryRel =
      typeof (manifest.entry as Record<string, unknown> | undefined)?.backend === "string"
        ? ((manifest.entry as Record<string, unknown>).backend as string)
        : "backend/index.js";
    let entryExists = false;
    try {
      await executor.stat(posix.join(moduleDir, entryRel));
      entryExists = true;
    } catch {
      notes.push(`El entry backend "${entryRel}" no existe todavía.`);
    }

    if (validation.warnings.length > 0) {
      notes.push(`${validation.warnings.length} warning(s) del manifest — revisa antes de enviar.`);
    }

    return { moduleId: link.moduleId, manifestFound: true, validation, entryExists, notes };
  },
};
