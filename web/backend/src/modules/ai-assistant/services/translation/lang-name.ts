// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ISO 639-1 code → English language name, for building translation prompts and
 * mapping to engine-specific code conventions.
 */

const NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
};

export function langName(code: string): string {
  return NAMES[code?.toLowerCase?.() ?? ""] ?? code;
}

/** ISO codes we know how to name (used for UI language pickers). */
export const KNOWN_LANGS = Object.keys(NAMES);
