// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Slash commands — configure the chat agent inline from the chat input.
 *
 * When the user's latest message starts with `/`, the agent dispatcher
 * routes it here instead of sending it to the model/CLI. These commands
 * configure the per-target assistant config (provider, model, mode,
 * enabled) and report status — i.e. they steer the agent the same way a
 * CLI's own slash commands steer it, but uniformly across providers.
 *
 * `/mod` — ciclo de módulos del marketplace (flujo IA-obligatorio,
 * MODULE-DEV-AI-FLOW.md): `vincular` se maneja aquí (escribe el sidecar
 * shared/marketplace-link); los verbos del ciclo NO ejecutan lógica — devuelven
 * un `rewrite` que instruye al modelo a invocar la tool `module-dev.*`
 * correspondiente (en CLI vía el server MCP `luxipanel`), reutilizando
 * streaming/audit/confirmaciones del agente sin importar módulos ajenos.
 *
 * Anything not recognized here, in CLI mode, is forwarded to the CLI
 * verbatim (the CLI may implement its own slash commands).
 */

import type { Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { assistantSkillsService } from "./assistant-skills.service.js";
import {
  PONYTAIL_MODES,
  ponytailModeConfirmation,
  buildPonytailReviewInstruction,
  buildPonytailAuditInstruction,
  buildPonytailDebtInstruction,
} from "./skills/index.js";
import {
  marketplaceLinkRepository,
  MODULE_ID_RE,
  type MarketplaceLink,
} from "../../../shared/marketplace-link/index.js";
import {
  PROVIDER_IDS,
  isAssistantProviderId,
  type AssistantConfig,
} from "../models/assistant-config.types.js";

interface SlashResult {
  /** True when handled here (don't forward to the model/CLI). */
  handled: boolean;
  /** Text to show in the chat as the assistant's reply. */
  text?: string;
  /** Signal the frontend to clear the transcript. */
  clear?: boolean;
  /**
   * NOT handled: el caller sustituye el texto del turno del usuario por este
   * y SIGUE al provider (el modelo invocará la tool `module-dev.*` indicada).
   */
  rewrite?: string;
}

/** Contexto del turno — executor del target + proyecto activo + usuario. */
interface SlashContext {
  executor?: Executor | null;
  projectId?: string;
  user?: SessionUser;
}

function isSlash(message: string): boolean {
  return message.trimStart().startsWith("/");
}

function helpText(cfg: AssistantConfig): string {
  const active = cfg.providers[cfg.activeProvider];
  return [
    "**Comandos disponibles:**",
    "",
    "- `/help` — muestra esta ayuda",
    "- `/status` — proveedor, modo y modelo activos",
    "- `/provider <claude|codex|gemini|deepseek|grok>` — cambia el proveedor activo",
    "- `/mode <api|cli>` — cambia el modo del proveedor activo",
    "- `/model <nombre>` — fija el modelo (ej. `claude-sonnet-5`, `gpt-6-sol`, `gemini-3.8-flash`)",
    "- `/mod <subcomando>` — ciclo de módulos del marketplace (`/mod ayuda`)",
    "- `/ponytail [off|lite|full|ultra]` — modo de código minimalista (Ponytail)",
    "- `/ponytail-review` · `/ponytail-audit` · `/ponytail-debt` — revisión anti sobre-ingeniería",
    "- `/clear` — limpia la conversación",
    "",
    `Activo ahora: **${cfg.activeProvider}** · modo **${active.mode}** · modelo \`${
      active.mode === "api" ? active.api?.model ?? "—" : active.cli?.version ?? "(CLI)"
    }\``,
    "",
    cfg.activeProvider !== "deepseek" && active.mode === "cli"
      ? "_En modo CLI, los comandos del propio CLI (los de su sesión interactiva) no aplican aquí; usa la terminal flotante para esos._"
      : "",
  ].filter(Boolean).join("\n");
}

function statusText(cfg: AssistantConfig): string {
  const a = cfg.providers[cfg.activeProvider];
  return [
    `**Estado del asistente**`,
    `- Habilitado: ${cfg.enabled ? "sí" : "no"}`,
    `- Proveedor activo: \`${cfg.activeProvider}\``,
    `- Modo: \`${a.mode}\``,
    a.mode === "api"
      ? `- Modelo (API): \`${a.api?.model ?? "—"}\` · API key: ${a.api?.apiKey ? "configurada" : "ausente"}`
      : `- CLI: ${a.cli?.installed ? `instalado${a.cli.version ? ` (${a.cli.version})` : ""}` : "no instalado"}`,
  ].join("\n");
}

// ── /mod — ciclo de módulos del marketplace ─────────────────────────────────

function modHelpText(): string {
  return [
    "**`/mod` — módulos del marketplace** (flujo guiado por IA)",
    "",
    "- `/mod vincular <slug>` — vincula este proyecto al módulo `<slug>` del marketplace",
    "- `/mod estado` — estado de revisión y eventos de tus módulos",
    "- `/mod probar` — ejecuta la suite de tests del módulo",
    "- `/mod preview` — instala la preview privada (solo visible para ti)",
    "- `/mod enviar <prUrl>` — envía el módulo a revisión",
    "- `/mod reenviar <prUrl>` — reenvía tras una corrección",
    "- `/mod despublicar` — retira el módulo publicado del marketplace",
    "- `/mod republicar` — reactiva un módulo despublicado",
    "",
    "_El alta y los metadatos (nombre, capabilities, pricing…) se acuerdan en el chat: la IA pregunta, tú decides._",
  ].join("\n");
}

const NEED_PROJECT_TEXT =
  "Este comando necesita un **proyecto del asistente activo** (abre el chat dentro de un proyecto). " +
  "El ciclo de módulos del marketplace se trabaja siempre desde su proyecto.";

function needLinkText(): string {
  return (
    "Este proyecto no está vinculado a ningún módulo del marketplace. " +
    "Vincúlalo primero con `/mod vincular <slug>` (ej. `/mod vincular acme-cache-warmer`)."
  );
}

/** Lee el vínculo del proyecto activo (null si no hay proyecto o falla la lectura). */
async function loadLink(ctx: SlashContext): Promise<MarketplaceLink | null> {
  if (!ctx.projectId) return null;
  try {
    return await marketplaceLinkRepository.getByProjectId(ctx.executor, ctx.projectId);
  } catch {
    return null;
  }
}

/** `/mod vincular <slug>` — único subcomando que ejecuta lógica local (escribe el sidecar). */
async function handleModVincular(slug: string, ctx: SlashContext): Promise<SlashResult> {
  if (!ctx.projectId) return { handled: true, text: NEED_PROJECT_TEXT };
  if (!slug) {
    return { handled: true, text: "Uso: `/mod vincular <slug>` (ej. `/mod vincular acme-cache-warmer`)." };
  }
  if (!MODULE_ID_RE.test(slug)) {
    return {
      handled: true,
      text: `Slug inválido: \`${slug}\`. Debe cumplir \`^[a-z][a-z0-9-]{2,38}$\` (minúsculas, dígitos y guiones).`,
    };
  }

  const project = await projectsRepository.get(ctx.executor, ctx.projectId);
  if (!project) {
    return { handled: true, text: "No encontré el proyecto activo en este servidor." };
  }
  const path = (project.path || "").trim();
  if (!path || !path.startsWith("/")) {
    return {
      handled: true,
      text:
        "El proyecto necesita un **directorio de trabajo absoluto** antes de vincularlo " +
        "(edítalo en los ajustes del proyecto). El módulo se materializa en `<dir>/modules/" + slug + "/`.",
    };
  }

  try {
    await marketplaceLinkRepository.upsert(ctx.executor, {
      projectId: String(project.id ?? ctx.projectId),
      moduleId: slug,
      projectPath: path,
      provider: project.provider,
    });
  } catch (err) {
    return { handled: true, text: `No se pudo vincular: ${(err as Error).message}` };
  }

  return {
    handled: true,
    text: [
      `Proyecto **${project.title}** vinculado al módulo del marketplace \`${slug}\`. ✅`,
      "",
      "Siguientes pasos:",
      "- Pídeme generar la arquitectura del módulo (scaffold de `modules/" + slug + "/` con manifest borrador y esqueleto del SDK).",
      "- `/mod probar` para correr los tests · `/mod preview` para instalar la preview privada.",
      "- `/mod enviar <prUrl>` cuando el módulo esté listo para revisión.",
    ].join("\n"),
  };
}

/**
 * Verbos del ciclo → `rewrite`: instrucción en lenguaje natural que ordena al
 * agente invocar la tool `module-dev.*` (en CLI vía el MCP `luxipanel`). No se
 * ejecuta nada aquí — el run del agente conserva streaming/audit/confirmación.
 */
async function handleMod(args: string[], ctx: SlashContext): Promise<SlashResult> {
  const sub = (args[0] ?? "").toLowerCase();
  const param = args.slice(1).join(" ").trim();

  if (!sub || sub === "ayuda" || sub === "help") {
    return { handled: true, text: modHelpText() };
  }

  if (sub === "vincular") return handleModVincular(param, ctx);

  const link = await loadLink(ctx);

  switch (sub) {
    case "estado": {
      if (!link) {
        return {
          handled: false,
          rewrite:
            "Consulta el estado de mis módulos del marketplace: invoca la herramienta " +
            "module-dev.list_modules y resume en español el estado de revisión de cada módulo " +
            "(reviewStatus, versión, última actualización). Este proyecto aún no está vinculado " +
            "a un módulo (puedo vincularlo con /mod vincular <slug>).",
        };
      }
      return {
        handled: false,
        rewrite:
          `Consulta el estado de mi módulo del marketplace "${link.moduleId}" (vinculado a este proyecto, ` +
          `projectId ${link.projectId}): invoca module-dev.list_modules y luego module-dev.module_status ` +
          `con {"moduleId":"${link.moduleId}"}. Resume en español el estado de revisión y los últimos eventos.`,
      };
    }

    case "enviar":
    case "reenviar": {
      if (!link) return { handled: true, text: needLinkText() };
      if (!param || !/^https?:\/\//i.test(param)) {
        return {
          handled: true,
          text: `Uso: \`/mod ${sub} <prUrl>\` — URL del Pull Request contra el repo canónico (rama \`modules\`).`,
        };
      }
      const tool = sub === "enviar" ? "module-dev.submit_module" : "module-dev.resubmit_module";
      const verbo = sub === "enviar" ? "Envía" : "Reenvía";
      return {
        handled: false,
        rewrite:
          `${verbo} mi módulo del marketplace "${link.moduleId}" a revisión: invoca la herramienta ` +
          `${tool} con {"moduleId":"${link.moduleId}","prUrl":"${param}"} ` +
          `(proyecto vinculado projectId ${link.projectId}). Antes de invocarla, si falta algún requisito ` +
          `evidente (manifest inválido, tests sin correr) avísame; después resume en español el resultado ` +
          `(versionId y reviewStatus).`,
      };
    }

    case "probar": {
      if (!ctx.projectId) return { handled: true, text: NEED_PROJECT_TEXT };
      if (!link) return { handled: true, text: needLinkText() };
      return {
        handled: false,
        rewrite:
          `Ejecuta la suite de tests de mi módulo del marketplace "${link.moduleId}": invoca la herramienta ` +
          `module-dev.run_tests con {"projectId":"${link.projectId}"}. Resume en español el resultado ` +
          `(passed, exitCode, duración) y, si falló, los errores relevantes de la salida con una propuesta de corrección.`,
      };
    }

    case "preview": {
      if (!ctx.projectId) return { handled: true, text: NEED_PROJECT_TEXT };
      if (!link) return { handled: true, text: needLinkText() };
      return {
        handled: false,
        rewrite:
          `Instala la preview privada de mi módulo del marketplace "${link.moduleId}": invoca la herramienta ` +
          `module-dev.preview_install con {"projectId":"${link.projectId}"}. La preview es visible solo para mí. ` +
          `Resume en español archivos/bytes vendorizados, si cargó (loaded) y cualquier warning de validación.`,
      };
    }

    case "despublicar": {
      if (!link) return { handled: true, text: needLinkText() };
      return {
        handled: false,
        rewrite:
          `Despublica mi módulo del marketplace "${link.moduleId}": invoca la herramienta ` +
          `module-dev.unpublish_module con {"moduleId":"${link.moduleId}"}. Es una acción sensible: ` +
          `confírmame el alcance (deja de estar disponible en el marketplace; pasa a "inactivo") y luego ` +
          `reporta en español el reviewStatus resultante.`,
      };
    }

    case "republicar": {
      if (!link) return { handled: true, text: needLinkText() };
      return {
        handled: false,
        rewrite:
          `Reactiva mi módulo del marketplace "${link.moduleId}": invoca la herramienta ` +
          `module-dev.republish_module con {"moduleId":"${link.moduleId}"} (solo válido si está "inactivo" ` +
          `y fue aprobado antes). Reporta en español el reviewStatus resultante.`,
      };
    }

    default:
      return {
        handled: true,
        text: `Subcomando desconocido: \`/mod ${sub}\`.\n\n${modHelpText()}`,
      };
  }
}

// ── /ponytail — modo de código minimalista (skill ponytail) ─────────────────

/**
 * `/ponytail [off|lite|full|ultra]` — único comando de skill con lógica local:
 * persiste el toggle/modo del skill `ponytail` en el sidecar del target. Sin
 * argumento equivale a `full`. `off` desactiva el skill; el resto lo activa con
 * ese modo. Los `/ponytail-review|audit|debt` NO pasan por aquí: devuelven un
 * `rewrite` para que el modelo ejecute la revisión (no tocan el toggle).
 */
async function handlePonytail(args: string[], ctx: SlashContext): Promise<SlashResult> {
  const mode = (args[0] ?? "").toLowerCase();
  if (mode && !(PONYTAIL_MODES as readonly string[]).includes(mode)) {
    return {
      handled: true,
      text: `Modo inválido. Usa: ${PONYTAIL_MODES.join(", ")} (ej. \`/ponytail full\`).`,
    };
  }
  const effective = mode || "full";
  try {
    if (effective === "off") {
      await assistantSkillsService.setSkill("ponytail", { enabled: false }, ctx.executor);
    } else {
      await assistantSkillsService.setSkill(
        "ponytail",
        { enabled: true, options: { mode: effective } },
        ctx.executor,
      );
    }
  } catch (err) {
    return { handled: true, text: `No se pudo cambiar Ponytail: ${(err as Error).message}` };
  }
  return { handled: true, text: ponytailModeConfirmation(effective) };
}

export const slashCommandsService = {
  isSlash,

  /**
   * Handle a slash command. Returns `{ handled:false }` if the message is
   * not a recognized command (caller forwards it to the provider) and
   * `{ handled:false, rewrite }` when the caller must replace the user's
   * turn with `rewrite` and continue to the provider.
   */
  async handle(message: string, ctx: SlashContext = {}): Promise<SlashResult> {
    const { executor } = ctx;
    const raw = message.trim();
    if (!raw.startsWith("/")) return { handled: false };

    const [cmd, ...rest] = raw.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    const cfg = await assistantConfigRepository.load(executor);

    switch ((cmd ?? "").toLowerCase()) {
      case "help":
      case "?":
        return { handled: true, text: helpText(cfg) };

      case "status":
        return { handled: true, text: statusText(cfg) };

      case "clear":
      case "reset":
        return { handled: true, clear: true, text: "Conversación limpiada." };

      case "mod":
        return handleMod(rest, ctx);

      case "ponytail":
        return handlePonytail(rest, ctx);

      case "ponytail-review":
        return { handled: false, rewrite: buildPonytailReviewInstruction() };

      case "ponytail-audit":
        return { handled: false, rewrite: buildPonytailAuditInstruction() };

      case "ponytail-debt":
        return { handled: false, rewrite: buildPonytailDebtInstruction() };

      case "provider": {
        if (!isAssistantProviderId(arg)) {
          return {
            handled: true,
            text: `Proveedor inválido. Opciones: ${PROVIDER_IDS.join(", ")}.`,
          };
        }
        await assistantConfigRepository.patch({ activeProvider: arg }, executor);
        return { handled: true, text: `Proveedor activo → **${arg}**.` };
      }

      case "mode": {
        const mode = arg.toLowerCase();
        if (mode !== "api" && mode !== "cli") {
          return { handled: true, text: "Modo inválido. Usa `/mode api` o `/mode cli`." };
        }
        const id = cfg.activeProvider;
        const provider = { ...cfg.providers[id], mode: mode as "api" | "cli" };
        await assistantConfigRepository.save(
          { ...cfg, providers: { ...cfg.providers, [id]: provider } },
          executor,
        );
        return { handled: true, text: `Modo de **${id}** → **${mode}**.` };
      }

      case "model": {
        if (!arg) return { handled: true, text: "Uso: `/model <nombre>`." };
        const id = cfg.activeProvider;
        const slot = cfg.providers[id];
        const provider =
          slot.mode === "api"
            ? { ...slot, api: { apiKey: slot.api?.apiKey ?? "", model: arg, ...(slot.api?.baseUrl ? { baseUrl: slot.api.baseUrl } : {}) } }
            : { ...slot, cli: { ...(slot.cli ?? { installed: false, loggedIn: false }), version: slot.cli?.version, model: arg } as typeof slot.cli & { model: string } };
        await assistantConfigRepository.save(
          { ...cfg, providers: { ...cfg.providers, [id]: provider } },
          executor,
        );
        return { handled: true, text: `Modelo de **${id}** → \`${arg}\`.` };
      }

      default:
        // Unknown slash command. In CLI mode we forward it to the CLI
        // (it may have its own commands). In API mode we report unknown.
        if (cfg.providers[cfg.activeProvider].mode === "cli") {
          return { handled: false };
        }
        return {
          handled: true,
          text: `Comando desconocido: \`/${cmd}\`. Escribe \`/help\` para ver los disponibles.`,
        };
    }
  },
};
