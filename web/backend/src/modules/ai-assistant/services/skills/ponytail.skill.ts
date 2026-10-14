// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Ponytail — minimalist-code development skill.
 *
 * Faithfully ported (Spanish) from the ponytail project:
 *   ponytail · MIT · github.com/DietrichGebert/ponytail
 */

import type { AssistantSkill, SkillPromptContext } from "./skill.types.js";

export const PONYTAIL_MODES = ["off", "lite", "full", "ultra"] as const;
export type PonytailMode = (typeof PONYTAIL_MODES)[number];

function ponytailPromptBlock(mode: string): string {
  return `## Ponytail — modo de código minimalista (modo actual: \`${mode}\`)
Eres un dev senior perezoso que ya lo ha visto todo: el mejor código es el que nunca se escribe. Antes de escribir código, detente en el primer peldaño que aplique:
1. ¿Necesita existir esto? → no: omitirlo (YAGNI)
2. ¿Lo hace la stdlib? → úsala
3. ¿Es una feature nativa de la plataforma? → úsala
4. ¿Una dependencia ya instalada? → úsala
5. ¿Cabe en una línea? → una línea
6. Solo entonces: el mínimo que funciona

Prefiere borrar antes que añadir, lo simple antes que lo ingenioso, menos archivos, el diff más corto.

NUNCA recortes: validación en límites de confianza, manejo de errores que evita pérdida de datos, seguridad, accesibilidad, calibración de hardware real, ni nada pedido explícitamente. El código perezoso sin su comprobación está sin terminar: para lógica no trivial, incluye UNA comprobación ejecutable en el código del proyecto (un smoke test o un \`assert\`, NO en la respuesta del chat) — sin framework de tests salvo que se pida; los one-liners triviales quedan exentos. Una auto-comprobación NUNCA se marca como exceso.

Marca cada simplificación intencional con un comentario \`ponytail: <techo>, <ruta de mejora>\` que nombre el techo conocido (lock global, escaneo O(n²), heurística ingenua) y qué dispara revisarlo.

Comportamiento por modo — lite: construye lo pedido y menciona en una línea la alternativa más simple (sin detenerte a preguntar). full: aplica la escalera, stdlib y nativo primero, el diff más corto. ultra: extremista de YAGNI — borrar antes que añadir, entrega el one-liner y descarta lo accesorio.`;
}

export function ponytailModeConfirmation(mode: string): string {
  if (mode === "off") return "Ponytail desactivado para este chat.";
  return `Ponytail en modo \`${mode}\`.`;
}

export function buildPonytailReviewInstruction(): string {
  return "Revisa ÚNICAMENTE el diff actual (líneas cambiadas, no todo el repo) buscando sobre-ingeniería. Por cada hallazgo usa una de estas etiquetas: `delete:` (código no usado/especulativo), `stdlib:` (reimplementa la librería estándar), `native:` (la plataforma ya lo provee), `yagni:` (abstracción con una sola implementación), `shrink:` (reescritura idéntica pero más corta). Formato por hallazgo: `L<línea>: <etiqueta> <qué>. <reemplazo>.` Fuera de alcance: bugs de correctitud, seguridad y rendimiento (eso es revisión estándar). Termina con `net: -<N> líneas posibles.` o, si no hay nada que cortar, `Lean already. Ship.` Solo reporta, no apliques cambios.";
}

export function buildPonytailAuditInstruction(): string {
  return "Audita TODO el repositorio buscando sobre-ingeniería, ordenado por impacto. Por cada hallazgo usa una de estas etiquetas: `delete:` (código no usado/especulativo), `stdlib:` (reimplementa la librería estándar), `native:` (la plataforma ya lo provee), `yagni:` (abstracción con una sola implementación), `shrink:` (reescritura idéntica pero más corta). Formato por hallazgo: `<etiqueta> <qué cortar>. <reemplazo>. [ruta]` Fuera de alcance: bugs de correctitud, seguridad y rendimiento (eso es revisión estándar). Termina con `net: -<N> líneas, -<M> deps posibles.` o, si no hay nada que cortar, `Lean already. Ship.` Solo reporta, no apliques cambios.";
}

export function buildPonytailDebtInstruction(): string {
  return "Recolecta cada comentario `ponytail:` del código en un libro de deuda. Escanea con `grep -rnE '(#|//) ?ponytail:' .` (omite node_modules, .git, build). Fila por marcador: `<archivo>:<línea>, <qué se simplificó>. ceiling: <límite>. upgrade: <disparador para revisarlo>.`, agrupado por archivo. Marca con `no-trigger` los que no nombran ruta de mejora. Termina con `<N> marcadores, <M> sin disparador.` o `No ponytail: debt. Clean ledger.` Solo lee y reporta, no cambies nada.";
}

export const ponytailSkill: AssistantSkill = {
  id: "ponytail",
  name: "Ponytail (código minimalista)",
  description:
    "Modo de desarrollo minimalista: escribe el mínimo código necesario (escalera de decisión + guardrails).",
  source: "ponytail · MIT · github.com/DietrichGebert/ponytail",
  category: "code-quality",
  kind: "prompt-block",
  defaultEnabled: false,
  options: [
    {
      key: "mode",
      label: "Intensidad",
      default: "full",
      choices: [
        { value: "off", label: "Apagado" },
        { value: "lite", label: "Lite — sugiere la alternativa más simple" },
        { value: "full", label: "Full — aplica la escalera" },
        { value: "ultra", label: "Ultra — extremista de YAGNI" },
      ],
    },
  ],
  systemPromptBlock(state, _ctx: SkillPromptContext): string {
    const mode = state.options?.["mode"] ?? "full";
    if (mode === "off") return "";
    return ponytailPromptBlock(mode);
  },
};
