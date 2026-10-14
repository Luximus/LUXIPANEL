// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Reensambla el registro de locales del sub-módulo "Agentes IA" con la MISMA
 * forma que exportaba `../agents-i18n.ts` (que queda de fachada): el tipo
 * `AgentsStrings` + `agentsStrings()` + `formatStr()`. Los cuerpos por idioma
 * viven en `./<lang>.ts` (es/en de W1; pt/fr/it/ru/zh/ko/ja/hi/ar de W8).
 */
import type { AgentsStrings } from "./types";
import { es } from "./es";
import { en } from "./en";
import { pt } from "./pt";
import { fr } from "./fr";
import { it } from "./it";
import { ru } from "./ru";
import { zh } from "./zh";
import { ko } from "./ko";
import { ja } from "./ja";
import { hi } from "./hi";
import { ar } from "./ar";

export type { AgentsStrings } from "./types";

/** Registro de locales. es + en (W1) y pt/fr/it/ru/zh/ko/ja/hi/ar (W8). */
const STR: Record<string, AgentsStrings> = { es, en, pt, fr, it, ru, zh, ko, ja, hi, ar };

/**
 * Cadenas del módulo Agentes para un idioma. Cae a español para locales no
 * provistos (misma política que el resto de la app). Acepta códigos con región
 * ("es-ES" → "es").
 */
export function agentsStrings(lang?: string): AgentsStrings {
  const code = (lang ?? "es").toLowerCase().split(/[-_]/)[0] ?? "es";
  return STR[code] ?? es;
}

/**
 * Interpola placeholders `{clave}` de una plantilla i18n con `vars`. Espeja
 * `formatAssistantMessage` del web (los strings de este módulo usan la misma
 * convención de llaves). Placeholders sin valor se dejan literales.
 */
export function formatStr(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
