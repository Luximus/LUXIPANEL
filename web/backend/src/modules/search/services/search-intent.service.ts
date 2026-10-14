// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * search-intent.service — fallback IA del super buscador del navbar.
 *
 * El ranking local (frontend, `lib/search-catalog.ts` + `super-search.ts`)
 * resuelve la mayoría de consultas. Cuando es débil/ambiguo, el cliente manda la
 * consulta en lenguaje natural + los candidatos (id/label/ruta/keywords) y aquí
 * una completion one-shot (`aiComplete`, misma vía que las sugerencias de
 * agentes) elige el candidato que mejor responde a la intención.
 *
 * Fail-open por diseño: sin proveedor API configurado → `NoAiProviderError`
 * (el controller responde 503 limpio y el cliente deja de preguntar en la
 * sesión). Salida inválida del modelo → `{ id: null, confidence: 0 }`.
 */
import type { AssistantConfig } from "../../ai-assistant/models/assistant-config.types.js";
import { aiComplete } from "../../ai-assistant/services/translation/ai-translator.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { SearchCandidate, SearchIntentResult } from "../models/search-intent.types.js";

const log = createModuleLogger("search-intent");

export class NoAiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoAiProviderError";
  }
}

/** Tolerant JSON-object extraction (strips ``` fences / surrounding prose). */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text ?? "").replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    return obj && typeof obj === "object" && !Array.isArray(obj) ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function renderCandidates(candidates: SearchCandidate[]): string {
  return candidates
    .map((c) => {
      const path = c.path ? ` (${c.path})` : "";
      const kw = c.keywords.length ? ` — ${c.keywords.slice(0, 8).join(", ")}` : "";
      return `- ${c.id}: ${c.label}${path}${kw}`;
    })
    .join("\n");
}

export function buildSystemPrompt(locale: string, candidates: SearchCandidate[]): string {
  return (
    "Eres el buscador inteligente de LUXIPANEL, un panel de administración de servidores Linux. " +
    "El usuario escribe en lenguaje natural lo que quiere hacer o dónde quiere ir. " +
    "Debes elegir, de la lista de destinos candidatos, el ÚNICO que mejor responde a su intención " +
    "(vista, pestaña, sección de un drawer o acción). Ten en cuenta verbos como crear/editar/configurar/ver " +
    "(por ejemplo «crear cuenta de correo» → la acción de nueva cuenta de correo; «roles» → la pestaña Roles de Usuarios). " +
    `Idioma del usuario: ${locale}. ` +
    "Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional ni markdown, con esta forma: " +
    '{ "id": string | null, "confidence": number entre 0 y 1 }. ' +
    "Usa null cuando ningún candidato encaje razonablemente.\n\n" +
    `Destinos candidatos (id: etiqueta (ruta) — palabras clave):\n${renderCandidates(candidates)}`
  );
}

export const searchIntentService = {
  /**
   * Resolve the best candidate for a natural-language query. Throws
   * `NoAiProviderError` when no API-backed provider is configured.
   */
  async resolve(
    config: AssistantConfig,
    input: { query: string; locale: string; candidates: SearchCandidate[] },
    signal?: AbortSignal,
  ): Promise<SearchIntentResult> {
    const ids = new Set(input.candidates.map((c) => c.id));
    let text = "";
    try {
      const out = await aiComplete(config, {
        system: buildSystemPrompt(input.locale, input.candidates),
        user: `Consulta del usuario: ${input.query}`,
        signal: signal ?? AbortSignal.timeout(15_000),
      });
      text = out.text ?? "";
    } catch (err) {
      const message = (err as Error).message ?? "";
      // TranslationError("ai", "…no tiene API key…") → no usable provider.
      if (/api key|modelo configurado|no tiene/i.test(message)) throw new NoAiProviderError(message);
      log.warn({ err: message }, "search-intent: aiComplete failed");
      return { id: null, confidence: 0 };
    }
    const obj = extractJsonObject(text);
    if (!obj) return { id: null, confidence: 0 };
    const rawId = obj["id"];
    const id = typeof rawId === "string" && ids.has(rawId) ? rawId : null;
    const rawConf = Number(obj["confidence"]);
    const confidence = id ? (Number.isFinite(rawConf) ? Math.min(1, Math.max(0, rawConf)) : 0.5) : 0;
    return { id, confidence };
  },
};
