/**
 * module-dev — AI agent capability.
 *
 * Tools del ciclo de vida del marketplace para el asistente (y, vía el MCP
 * loopback, para los CLI del dev en el target). TODO nombre va prefijado
 * `module-dev.` — el registry lanza si no, y eso es crash-loop del backend
 * (memoria luxipanel-agent-tool-name-prefix).
 *
 * Las actions llevan permission "module-dev.manage" (admin bypass implícito
 * del dispatch); dangerous=true en las que cambian estado publicado o
 * instalan código (submit/unpublish/republish/preview_install).
 *
 * Handlers: corren dentro del scope ALS del request del chat → executor del
 * target implícito (fail-closed) y usuario via getContextUser().
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { EXEC_TIMEOUT_CAP_MS } from "../../shared/constants.js";
import { getContextUser } from "../../shared/executor/index.js";
import { errMessage } from "../../shared/utils/err-message.js";
import type { SessionUser } from "../../shared/types/index.js";
import { marketplaceLinkRepository, MODULE_ID_RE } from "../../shared/marketplace-link/index.js";
import { validateManifest } from "./services/manifest-validator.service.js";
import { lpProxyService } from "./services/lp-proxy.service.js";
import { previewService } from "./services/preview.service.js";
import {
  readAssistantProject,
  readModuleManifest,
  requireLink,
  resolveModuleDir,
  testRunnerService,
} from "./services/test-runner.service.js";

const MANAGE_PERMISSION = "module-dev.manage";
// MODULE_ID_RE: single source of truth in shared/marketplace-link (imported).

function str(input: unknown, key: string): string {
  return String((input as Record<string, unknown>)?.[key] ?? "").trim();
}

function fail(err: unknown): { ok: false; output: string } {
  return { ok: false, output: errMessage(err) };
}

/** Usuario del request (dueño de previews). Sin usuario → error accionable. */
function requireUser(): SessionUser {
  const user = getContextUser();
  if (!user) {
    throw new Error(
      "No hay usuario en el contexto de esta ejecución — las operaciones de preview requieren la sesión del dev.",
    );
  }
  return user;
}

export const moduleDevAgentCapability: AgentCapability = {
  moduleId: "module-dev",
  version: 1,
  tools: [
    {
      name: "module-dev.validate_manifest",
      title: "Validar manifest",
      description:
        "Validate a module.manifest.json draft against the marketplace contract. Pass `manifest` (object) directly, or `projectId` to read it from the linked module directory on the connected server. Returns errors and warnings with JSON paths.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          manifest: { type: "object", description: "Manifest draft to validate" },
          projectId: { type: "string", description: "Assistant project id (reads the manifest from the target)" },
        },
      },
      handler: async (input) => {
        try {
          const raw = (input as Record<string, unknown>) ?? {};
          if (raw.manifest && typeof raw.manifest === "object") {
            return { ok: true, output: validateManifest(raw.manifest) };
          }
          const projectId = str(input, "projectId");
          if (!projectId) {
            return { ok: false, output: "Pasa 'manifest' (objeto) o 'projectId' (proyecto vinculado)." };
          }
          const executor = requireExecutor();
          const link = await requireLink(executor, projectId);
          const moduleDir = await resolveModuleDir(executor, link);
          const read = await readModuleManifest(executor, moduleDir);
          if (!read.found) return { ok: false, output: `No existe module.manifest.json en ${moduleDir}` };
          if (read.error) return { ok: false, output: `module.manifest.json inválido: ${read.error}` };
          return { ok: true, output: validateManifest(read.manifest) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.run_checks",
      title: "Checks estáticos del módulo",
      description:
        "Run the static checks of the marketplace module linked to an assistant project: manifest validation, backend entry existence and actionable notes. Executes nothing.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "Assistant project id" } },
        required: ["projectId"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await testRunnerService.runChecks(str(input, "projectId")) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.run_tests",
      title: "Ejecutar tests del módulo",
      description:
        "Run the linked module's test suite ON THE CONNECTED SERVER (npm test when scripts.test exists, otherwise `node --test`), with CI=1, a hard timeout and capped output. Returns exit code, stdout/stderr and timing.",
      kind: "action",
      dangerous: false,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Assistant project id" },
          timeoutMs: { type: "number", description: `Optional timeout in ms (capped at ${EXEC_TIMEOUT_CAP_MS})` },
        },
        required: ["projectId"],
      },
      handler: async (input) => {
        try {
          const timeoutRaw = Number((input as Record<string, unknown>)?.timeoutMs);
          const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : undefined;
          return {
            ok: true,
            output: await testRunnerService.runTests(str(input, "projectId"), timeoutMs),
          };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.list_modules",
      title: "Mis módulos del marketplace",
      description:
        "List the developer's marketplace modules with their review status (enviado/revision/correccion/suspendido/inactivo/publico). Served from cache with stale=true when the license server is unreachable.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        try {
          const result = await lpProxyService.listModules();
          return {
            ok: true,
            output: { modules: result.data, stale: result.stale, fetchedAt: result.fetchedAt },
          };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.module_status",
      title: "Estado de un módulo",
      description:
        "Get one marketplace module's current state: summary plus its review timeline (versions + review events).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { moduleId: { type: "string", description: "Module id (slug)" } },
        required: ["moduleId"],
      },
      handler: async (input) => {
        try {
          const moduleId = str(input, "moduleId");
          if (!MODULE_ID_RE.test(moduleId)) return { ok: false, output: `Id de módulo inválido: "${moduleId}"` };
          const [list, reviews] = await Promise.all([
            lpProxyService.listModules().catch(() => null),
            lpProxyService.getReviews(moduleId),
          ]);
          const summary = list?.data.find((m) => m.code === moduleId) ?? null;
          return {
            ok: true,
            output: { summary, reviews: reviews.data, stale: reviews.stale, fetchedAt: reviews.fetchedAt },
          };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.submit_module",
      title: "Enviar módulo a revisión",
      description:
        "Submit a marketplace module for review (reviewStatus 'enviado'). Requires the project↔module marketplace link to exist on this server (created via /mod vincular) and the PR URL against the canonical repo.",
      kind: "action",
      dangerous: true,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: {
          moduleId: { type: "string", description: "Module id (slug)" },
          prUrl: { type: "string", description: "Pull request URL against Luxisoft/LUXIPANEL (modules branch)" },
          scope: { type: "string", description: 'Optional scope: "local" or "global"' },
        },
        required: ["moduleId", "prUrl"],
      },
      handler: async (input) => {
        try {
          const scope = str(input, "scope");
          return {
            ok: true,
            output: await lpProxyService.submit({
              moduleId: str(input, "moduleId"),
              prUrl: str(input, "prUrl"),
              ...(scope ? { scope } : {}),
            }),
          };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.resubmit_module",
      title: "Reenviar módulo corregido",
      description:
        "Resubmit a module after corrections (same gate as submit: the marketplace link must exist). Creates a new review round with the given PR URL.",
      kind: "action",
      dangerous: false,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: {
          moduleId: { type: "string", description: "Module id (slug)" },
          prUrl: { type: "string", description: "Corrected pull request URL" },
        },
        required: ["moduleId", "prUrl"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await lpProxyService.resubmit(str(input, "moduleId"), str(input, "prUrl")) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.unpublish_module",
      title: "Despublicar módulo",
      description:
        "Unpublish one of the developer's PUBLISHED modules (publico → inactivo). Panels unload it on their next sync. Reversible with module-dev.republish_module.",
      kind: "action",
      dangerous: true,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: { moduleId: { type: "string", description: "Module id (slug)" } },
        required: ["moduleId"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await lpProxyService.unpublish(str(input, "moduleId")) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.republish_module",
      title: "Reactivar módulo",
      description:
        "Republish a module the developer unpublished (inactivo → publico). Only allowed when it was approved before; admin suspensions cannot be lifted by the developer.",
      kind: "action",
      dangerous: true,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: { moduleId: { type: "string", description: "Module id (slug)" } },
        required: ["moduleId"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await lpProxyService.republish(str(input, "moduleId")) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.preview_install",
      title: "Instalar preview (Modo B)",
      description:
        "Install the linked module as a PRIVATE preview in this panel: validates the manifest, vendors the module tree (size caps apply) and hot-loads its tools. Visible and invocable only by the installing developer.",
      kind: "action",
      dangerous: true,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: { projectId: { type: "string", description: "Assistant project id" } },
        required: ["projectId"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await previewService.install(str(input, "projectId"), requireUser()) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.preview_uninstall",
      title: "Desinstalar preview",
      description:
        "Uninstall a private preview module installed by the current developer. Approved (non-preview) modules are never touched.",
      kind: "action",
      dangerous: false,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: { moduleId: { type: "string", description: "Preview module id (slug)" } },
        required: ["moduleId"],
      },
      handler: async (input) => {
        try {
          return { ok: true, output: await previewService.uninstall(str(input, "moduleId"), requireUser()) };
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "module-dev.link_project",
      title: "Vincular proyecto ↔ módulo",
      description:
        "Create/refresh the association between an assistant project and a marketplace module slug on this server. Required gate before submit/resubmit (the marketplace onboarding is AI-driven).",
      kind: "action",
      dangerous: false,
      permission: MANAGE_PERMISSION,
      inputSchema: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "Assistant project id" },
          moduleId: { type: "string", description: "Module id (slug ^[a-z][a-z0-9-]{2,38}$)" },
        },
        required: ["projectId", "moduleId"],
      },
      handler: async (input) => {
        try {
          const projectId = str(input, "projectId");
          const moduleId = str(input, "moduleId");
          if (!MODULE_ID_RE.test(moduleId)) {
            return { ok: false, output: `Id de módulo inválido: "${moduleId}" (^[a-z][a-z0-9-]{2,38}$)` };
          }
          const executor = requireExecutor();
          const project = await readAssistantProject(executor, projectId);
          if (!project) {
            return { ok: false, output: `Proyecto del asistente "${projectId}" no encontrado o sin path en este servidor.` };
          }
          const provider = (["claude", "codex", "gemini"].includes(project.provider)
            ? project.provider
            : "claude") as "claude" | "codex" | "gemini";
          const link = await marketplaceLinkRepository.upsert(executor, {
            projectId: project.id,
            moduleId,
            projectPath: project.path,
            provider,
          });
          return { ok: true, output: link };
        } catch (err) {
          return fail(err);
        }
      },
    },
  ],
  suggestedPrompts: [
    "Muéstrame el estado de mis módulos del marketplace",
    "Corre los checks y los tests del módulo de este proyecto",
    "Instala el módulo de este proyecto como preview y prueba sus tools",
  ],
};
