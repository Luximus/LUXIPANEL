// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Project quick-start suggestions.
 *
 * At project create/update time we ask a CHEAP one-shot LLM (`aiComplete`,
 * reusing the translation engine's provider/key resolution) to produce up to 50
 * short, varied questions a user might ask the assistant about THAT project.
 * They're stored on the project (`suggestions`) so the chat UI can sample a few
 * at random for an empty chat — varying them so they don't always repeat.
 *
 * Entirely best-effort / FAIL-OPEN: if there's no API key (pure-CLI setup) or
 * the call fails, the project still saves and the UI falls back to generic
 * starters. Runs fire-and-forget from the controller (does NOT block the save),
 * so it takes an EXPLICIT executor (the request's ALS context is already gone).
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { projectsRepository, sanitizeSuggestions, type AssistantProject } from "../repositories/projects.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { aiComplete } from "./translation/ai-translator.js";

const log = createModuleLogger("project-suggestions");

const SYSTEM =
  "Generas preguntas/peticiones BREVES que un usuario podría escribirle a un asistente de IA que " +
  "administra un servidor Linux, ENFOCADAS en el proyecto descrito. Cada una redactada como la " +
  "escribiría el usuario (primera persona o imperativo), VARIADAS entre sí (estado/resumen, archivos y " +
  "estructura, configuración, depuración de errores, siguientes pasos, mejoras, pruebas, despliegue), " +
  "concretas al proyecto cuando haya contexto, de máximo ~90 caracteres cada una. Escribe en español. " +
  "Devuelve SOLO un array JSON de cadenas (hasta 50 elementos), sin ningún texto adicional ni explicaciones.";

function buildUserPrompt(project: AssistantProject): string {
  const parts = [`Proyecto: ${project.title}`];
  if (project.path) parts.push(`Directorio de trabajo: ${project.path}`);
  parts.push(`Proveedor/herramienta: ${project.provider}`);
  const instr = project.instructions?.trim();
  if (instr) parts.push(`Instrucciones/contexto del proyecto:\n${instr.slice(0, 4000)}`);
  parts.push(
    "\nGenera hasta 50 preguntas/peticiones variadas para arrancar un chat sobre este proyecto. Solo el array JSON.",
  );
  return parts.join("\n");
}

/** Parse the model output into a clean string[] (JSON array, else line list). */
function parseSuggestions(text: string): string[] {
  const trimmed = (text || "").trim();
  let arr: unknown;
  // Prefer a JSON array even if wrapped in prose / code fences.
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      arr = JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* fall through to line parsing */
    }
  }
  const list = Array.isArray(arr)
    ? arr.map((x) => String(x ?? ""))
    : trimmed
        .split(/\r?\n/)
        .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["'`]+|["'`,]+$/g, "").trim());
  return sanitizeSuggestions(list);
}

export const projectSuggestionsService = {
  /**
   * Generate suggestions for `project` and persist them. Never throws — logs a
   * warning and returns on any failure (no key, LLM error, write error).
   */
  async generateAndStore(executor: Executor | null | undefined, project: AssistantProject): Promise<void> {
    if (!project.id) return;
    try {
      const config = await assistantConfigRepository.load(executor);
      const out = await aiComplete(config, { system: SYSTEM, user: buildUserPrompt(project) });
      const list = parseSuggestions(out.text);
      if (list.length) {
        await projectsRepository.setSuggestions(executor, project.id, list);
        log.info({ projectId: project.id, count: list.length }, "project suggestions generated");
      } else {
        log.warn({ projectId: project.id }, "project suggestions: model returned none — skipped");
      }
    } catch (err) {
      log.warn(
        { projectId: project.id, err: (err as Error).message },
        "project suggestions generation failed (fail-open)",
      );
    }
  },
};
