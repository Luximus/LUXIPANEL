// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Cheap, dependency-free language detection.
 *
 * The goal is NOT linguistic precision — it's to answer "is this English?"
 * cheaply so we can skip translation and skip an engine round-trip on the hot
 * path. It scores a handful of common languages by stop-word hits + a couple of
 * script/diacritic signals and returns the best guess with a confidence.
 *
 * If confidence is low the caller may fall back to the engine's own
 * `detectLanguage` once and pin the result on the conversation.
 */

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "is", "are", "to", "of", "in", "you", "that", "it", "for", "with", "this", "what", "how", "why", "please", "can"],
  es: ["el", "la", "los", "las", "de", "que", "y", "en", "un", "una", "por", "qué", "cómo", "para", "con", "está", "puedo", "necesito", "hola"],
  pt: ["o", "a", "os", "as", "de", "que", "e", "em", "um", "uma", "por", "como", "para", "com", "está", "você", "não", "obrigado"],
  fr: ["le", "la", "les", "de", "que", "et", "un", "une", "pour", "avec", "est", "vous", "comment", "pourquoi", "merci", "bonjour", "je"],
  de: ["der", "die", "das", "und", "ist", "ein", "eine", "zu", "mit", "für", "nicht", "wie", "warum", "ich", "bitte", "danke"],
  it: ["il", "la", "le", "di", "che", "e", "un", "una", "per", "con", "è", "come", "perché", "grazie", "ciao", "sono"],
};

const SCRIPT_SIGNALS: Array<{ lang: string; re: RegExp }> = [
  { lang: "ru", re: /[Ѐ-ӿ]/ },
  { lang: "zh", re: /[一-鿿]/ },
  { lang: "ja", re: /[぀-ヿ]/ },
  { lang: "ko", re: /[가-힯]/ },
  { lang: "ar", re: /[؀-ۿ]/ },
  { lang: "hi", re: /[ऀ-ॿ]/ },
];

export interface DetectResult {
  lang: string;
  confidence: number; // 0..1
}

/** Heuristic detection. Returns `{ lang, confidence }`. */
export function detectLanguageHeuristic(text: string): DetectResult {
  const sample = text.slice(0, 1000);
  // Non-Latin scripts are unambiguous — short-circuit with high confidence.
  for (const { lang, re } of SCRIPT_SIGNALS) {
    if (re.test(sample)) return { lang, confidence: 0.95 };
  }

  const words = sample
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return { lang: "en", confidence: 0 };

  const scores: Record<string, number> = {};
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    let hits = 0;
    for (const w of words) if (set.has(w)) hits++;
    scores[lang] = hits / words.length;
  }
  // Latin-diacritic nudge toward romance languages when present.
  if (/[áéíóúñ¿¡]/i.test(sample)) scores.es = (scores.es ?? 0) + 0.05;
  if (/[àâçèéêëîïôûœ]/i.test(sample)) scores.fr = (scores.fr ?? 0) + 0.04;
  if (/[ãõâêô]/i.test(sample)) scores.pt = (scores.pt ?? 0) + 0.04;

  let best = "en";
  let bestScore = scores.en ?? 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  // Confidence scales with stop-word density (capped). Short inputs → low.
  const confidence = Math.min(1, bestScore * 6);
  return { lang: best, confidence };
}

/** True when the text is (almost certainly) English — no translation needed. */
export function isLikelyEnglish(text: string): boolean {
  const d = detectLanguageHeuristic(text);
  return d.lang === "en" && d.confidence >= 0.25;
}
