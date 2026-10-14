// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * i18n module-local del sub-módulo "Agentes IA" (réplica nativa). Espeja
 * `AgentsTabMessages` del web (WEB/floating-assistant/AgentsTab.tsx, clave
 * `agentsTab` de i18n/<loc>/assistant.ts). Se usa el patrón module-local
 * `STR: Record<lang, AgentsStrings>` con fallback a español — NO el sistema
 * tipado `assistant-settings.ts`, porque este subárbol es enorme y rompería
 * `tsc` en los 11 locales.
 *
 * FACHADA: el cuerpo se dividió POR IDIOMA en `agents-i18n-locales/<lang>.ts`
 * (+ `types.ts` e `index.ts` que reensambla). La carpeta se llama
 * `agents-i18n-locales/` (no `agents-i18n/`) a propósito: desde este mismo
 * archivo `./agents-i18n` resolvería a ESTE .ts (el archivo gana a la
 * carpeta), creando un self-import circular. Este archivo re-exporta la MISMA
 * forma (AgentsStrings, agentsStrings, formatStr) para no tocar importadores.
 *
 * W1 provee `es` y `en` COMPLETOS. W8 añade pt/fr/it (completos) y
 * ru/zh/ko/ja/hi/ar (traducción real o fallback a `es`).
 */
export type { AgentsStrings } from "./agents-i18n-locales";
export { agentsStrings, formatStr } from "./agents-i18n-locales";
