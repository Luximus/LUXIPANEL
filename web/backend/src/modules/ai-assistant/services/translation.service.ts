// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Background translation orchestration.
 *
 * Sits between the chat controller/run-registry and the translation engines.
 * Responsibilities:
 *   - protect code spans (fenced + inline) so they're never translated/mangled
 *   - cache short repeated strings (in-process LRU) to cut cost/latency
 *   - orchestrate language detection (cheap heuristic → engine fallback)
 *   - degrade safely: on any engine/integrity failure, return the input text
 *     unchanged so a run NEVER hangs or loses content (callers expect this).
 *
 * Engines translate RAW text; this module owns everything around them.
 */

import { createHash } from "node:crypto";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import type {
  AssistantConfig,
  AssistantProviderId,
  TranslationConfig,
  TranslationEngineId,
} from "../models/assistant-config.types.js";
import { DEFAULT_TRANSLATION_MODEL, TRANSLATION_PROVIDER_PRIORITY } from "../models/assistant-config.types.js";
import { usageRepository } from "../repositories/usage.repository.js";
import { buildTranslationProvider } from "./translation/translation-factory.js";
import type { TranslationProvider, TranslationUsageSink } from "./translation/translation.types.js";
import { detectLanguageHeuristic } from "./translation/lang-detect.js";

const log = createModuleLogger("translation-service");

// ── Reliability knobs ───────────────────────────────────────────────────────
// A single transient blip (network hiccup, 429/5xx, a slow/hung engine call)
// used to fall straight through to the untranslated original — the cause of
// "sometimes English leaks into the chat". We now bound each attempt with a
// timeout and retry a few times before degrading, so the silent fallback is a
// genuine last resort instead of the first failure.
const TRANSLATE_TIMEOUT_MS = 15_000;
const TRANSLATE_MAX_ATTEMPTS = 3;
const TRANSLATE_RETRY_BASE_MS = 400;

// ── Engine verification (settings save / "Test engine") ─────────────────────
// A single real EN→target call to PROVE an engine actually translates before we
// trust it. `translate()` never throws (it degrades to the source), and `ping()`
// only checks key/model presence — neither catches a quota/401/timeout. So a
// candidate counts as "working" only if it returns non-empty text that DIFFERS
// from this sample. One attempt, short timeout: this gates a UI save, not a run.
const PROBE_TIMEOUT_MS = 9_000;
const PROBE_SAMPLE_EN =
  "Hello, your server is running fine and all services are healthy.";
// Order tried when the chosen engine fails: cheap, reliable AI models first.
// Shared with the runtime resolver so verify-on-save and runtime agree.
const AI_FALLBACK_PRIORITY: AssistantProviderId[] = TRANSLATION_PROVIDER_PRIORITY;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const normalizeProbe = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** A single translation candidate (engine, and for "ai" the provider+model). */
interface TranslationCandidate {
  engine: TranslationEngineId;
  ai?: { providerId: AssistantProviderId; model: string };
}

/** Outcome of probing one candidate. */
export interface TranslationTrial {
  engine: TranslationEngineId;
  providerId?: AssistantProviderId;
  model?: string;
  ok: boolean;
  detail: string;
}

/** Result of verifying a desired engine with fallback/disable. */
export interface TranslationVerifyResult {
  /** The translation block to persist (chosen, fallen-back, or disabled). */
  translation: TranslationConfig;
  enabled: boolean;
  /** A working engine other than the user's first choice was selected. */
  fellBack: boolean;
  /** No engine worked → background translation was turned off. */
  disabled: boolean;
  trials: TranslationTrial[];
}

const hasAiKey = (config: AssistantConfig, id: AssistantProviderId): boolean =>
  !!config.providers[id]?.api?.apiKey?.trim();

/** Build the ordered candidate list: the user's pick first, then any other
 *  engine for which credentials exist. Deduped by engine (and ai provider). */
function buildCandidates(config: AssistantConfig, desired: TranslationConfig): TranslationCandidate[] {
  const out: TranslationCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: TranslationCandidate): void => {
    const key = c.engine === "ai" ? `ai:${c.ai?.providerId}` : c.engine;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  // 1) The user's chosen engine. When "follow active provider" is on (default),
  //    the chosen AI provider IS the active/main one with its cheap model.
  if (desired.engine === "ai") {
    const following = desired.aiFollowActive !== false;
    const providerId = following ? config.activeProvider : desired.ai?.providerId ?? "claude";
    const model = following ? DEFAULT_TRANSLATION_MODEL[providerId] : desired.ai?.model || DEFAULT_TRANSLATION_MODEL[providerId];
    if (hasAiKey(config, providerId)) add({ engine: "ai", ai: { providerId, model } });
  } else {
    add({ engine: desired.engine });
  }
  // 2) Other AI providers that have an API key (cheap translation models).
  for (const id of AI_FALLBACK_PRIORITY) {
    if (hasAiKey(config, id)) add({ engine: "ai", ai: { providerId: id, model: DEFAULT_TRANSLATION_MODEL[id] } });
  }
  // 3) Dedicated engines that have credentials configured.
  if (config.translation.deepl?.apiKey?.trim()) add({ engine: "deepl" });
  if (config.translation.google?.apiKey?.trim()) add({ engine: "google" });
  if (config.translation.libretranslate?.baseUrl?.trim()) add({ engine: "libretranslate" });
  return out;
}

/** Apply a candidate onto a desired translation block (engine + ai override). */
function applyCandidate(desired: TranslationConfig, cand: TranslationCandidate): TranslationConfig {
  return { ...desired, engine: cand.engine, ...(cand.ai ? { ai: cand.ai } : {}) };
}

/** Reject if `p` doesn't settle within `ms`. The timer is always cleared. */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Where to attribute background-translation token usage. When `executor` is
 * present, real AI-engine calls are written to the per-server usage ledger so
 * translation shows up in the assistant's Statistics tab alongside chat turns.
 */
export interface TranslationUsageContext {
  executor?: Executor | null;
  conversationId?: string | null;
  projectId?: string | null;
  userId?: string | null;
}

/**
 * Build the usage sink that records each real AI-engine call into the ledger
 * (mode "api", real token counts → `estimated: false`). Returns undefined when
 * there's no executor to attribute against (e.g. the settings "test" button).
 */
function makeUsageSink(ctx?: TranslationUsageContext): TranslationUsageSink | undefined {
  if (!ctx?.executor) return undefined;
  const executor = ctx.executor;
  return (usage) => {
    void usageRepository.record(
      {
        ts: new Date().toISOString(),
        provider: usage.providerId,
        mode: "api",
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimated: false,
        conversationId: ctx?.conversationId ?? null,
        projectId: ctx?.projectId ?? null,
        userId: ctx?.userId != null ? String(ctx.userId) : null,
      },
      executor,
    );
  };
}

// ── Code-span protection ──────────────────────────────────────────────────
// Robust bracket sentinels (U+27E6/27E7) — unlikely to be altered by engines.

const FENCED = /```[\s\S]*?```/g;
const INLINE = /`[^`\n]+`/g;

function maskCode(text: string): { masked: string; spans: string[] } {
  const spans: string[] = [];
  const stash = (m: string): string => {
    const i = spans.push(m) - 1;
    return `⟦LXP${i}⟧`;
  };
  const masked = text.replace(FENCED, stash).replace(INLINE, stash);
  return { masked, spans };
}

function restoreCode(text: string, spans: string[]): { restored: string; ok: boolean } {
  let restored = text;
  let ok = true;
  for (let i = 0; i < spans.length; i++) {
    const token = `⟦LXP${i}⟧`;
    if (!restored.includes(token)) {
      ok = false;
      continue;
    }
    restored = restored.replace(token, () => spans[i]!);
  }
  return { restored, ok };
}

// ── Code-aware SPLIT translation (sentinel-free) ─────────────────────────────
// The mask/restore scheme above relies on the engine copying ⟦LXP{i}⟧ sentinels
// through verbatim. Large models (AI/DeepL/Google) do; the offline Argos NMT
// (SentencePiece) treats the rare Unicode brackets as out-of-vocabulary and
// reorders/merges/drops them, so a code-heavy message reliably fails with
// "dropped code sentinels". For such engines we don't mask at all: we SPLIT on
// code spans and translate ONLY the prose segments, splicing the code back in
// verbatim. Code never passes through the model, so no sentinel can be lost.
// The capturing group makes String.split keep the delimiters, so odd indices
// are the code spans and even indices are prose. More round-trips than one
// masked call, but Argos is a zero-cost loopback sidecar and reliability wins.
const CODE_SPLIT = /(```[\s\S]*?```|`[^`\n]+`)/g;

async function translateByCodeSegments(
  provider: TranslationProvider,
  text: string,
  from: string | "auto",
  to: string,
): Promise<string> {
  const parts = text.split(CODE_SPLIT);
  const out = await Promise.all(
    parts.map((part, i) =>
      // Odd indices are captured code spans (and whitespace-only prose needs no
      // call) → keep verbatim; even indices are prose → translate.
      i % 2 === 1 || !part.trim() ? part : provider.translate(part, from, to),
    ),
  );
  return out.join("");
}

// Engines that cannot be trusted to preserve sentinels → use the split path.
// (Empty since the offline `argos` engine — the only sentinel-dropper — was
// removed; kept as a hook in case another such engine is added later.)
const SPLIT_TRANSLATE_ENGINES = new Set<TranslationEngineId>([]);

// ── LRU cache for short strings ─────────────────────────────────────────────

const CACHE_MAX = 500;
const CACHE_MAX_LEN = 2000;
const cache = new Map<string, string>();

function cacheKey(engine: TranslationEngineId, from: string, to: string, text: string): string {
  return createHash("sha1").update(`${engine} ${from} ${to} ${text}`).digest("hex");
}

function cacheGet(key: string): string | undefined {
  const v = cache.get(key);
  if (v !== undefined) {
    cache.delete(key);
    cache.set(key, v); // bump to MRU
  }
  return v;
}

function cacheSet(key: string, value: string): void {
  if (value.length > CACHE_MAX_LEN) return;
  cache.set(key, value);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export const translationService = {
  /**
   * Translate `text` and report whether it actually succeeded. NEVER throws.
   * On success → `{ text: translated, ok: true }`. After every retry fails →
   * `{ text: <original>, ok: false, error: <human reason> }` so callers can
   * both degrade gracefully AND surface why the translation was not performed.
   */
  async translateDetailed(
    config: AssistantConfig,
    text: string,
    from: string | "auto",
    to: string,
    usageCtx?: TranslationUsageContext,
  ): Promise<{ text: string; ok: boolean; error?: string }> {
    if (!text.trim() || from === to) return { text, ok: true };
    const engine = config.translation.engine;
    const key = cacheKey(engine, from, to, text);
    const hit = cacheGet(key);
    if (hit !== undefined) return { text: hit, ok: true }; // cache hit → no API call → no tokens to record

    // Retry transient failures (timeouts, 429/5xx, dropped code sentinels)
    // before giving up. Only after every attempt fails do we degrade to the
    // untranslated original — never on the first hiccup.
    let lastErr: unknown;
    for (let attempt = 1; attempt <= TRANSLATE_MAX_ATTEMPTS; attempt++) {
      try {
        const provider = buildTranslationProvider(config, undefined, makeUsageSink(usageCtx));
        let restored: string;
        if (SPLIT_TRANSLATE_ENGINES.has(engine)) {
          // Sentinel-free path: code spans never reach the engine, so there's
          // nothing to drop (the cause of Argos' "dropped code sentinels").
          restored = await withTimeout(
            translateByCodeSegments(provider, text, from, to),
            TRANSLATE_TIMEOUT_MS,
            "translation",
          );
        } else {
          const { masked, spans } = maskCode(text);
          const translated = await withTimeout(provider.translate(masked, from, to), TRANSLATE_TIMEOUT_MS, "translation");
          const r = restoreCode(translated, spans);
          // A code sentinel went missing — restoring would corrupt code. Treat as
          // a retryable failure (often a one-off model hiccup); degrade only if it
          // keeps happening.
          if (!r.ok) throw new Error("translation dropped code sentinels");
          restored = r.restored;
        }
        cacheSet(key, restored);
        return { text: restored, ok: true };
      } catch (err) {
        lastErr = err;
        if (attempt < TRANSLATE_MAX_ATTEMPTS) {
          log.warn({ err: (err as Error).message, engine, from, to, attempt }, "translation attempt failed — retrying");
          await sleep(TRANSLATE_RETRY_BASE_MS * attempt);
        }
      }
    }
    const detail = (lastErr as Error | undefined)?.message ?? "error desconocido";
    log.warn(
      { err: detail, engine, from, to, attempts: TRANSLATE_MAX_ATTEMPTS },
      "translation failed after retries — returning original",
    );
    return {
      text,
      ok: false,
      error: `El motor de traducción "${engine}" falló tras ${TRANSLATE_MAX_ATTEMPTS} intentos: ${detail}`,
    };
  },

  /**
   * Translate `text` from `from` (or "auto") to `to`, protecting code spans and
   * using the LRU cache. NEVER throws — on failure returns the original text
   * and logs (so the chat run degrades gracefully). Thin wrapper over
   * `translateDetailed` for the many callers that only need the text.
   */
  async translate(
    config: AssistantConfig,
    text: string,
    from: string | "auto",
    to: string,
    usageCtx?: TranslationUsageContext,
  ): Promise<string> {
    return (await translationService.translateDetailed(config, text, from, to, usageCtx)).text;
  },

  /**
   * Detect the language of `text` (ISO 639-1). Cheap heuristic first; if it's
   * low-confidence and the engine supports detection, ask the engine once.
   * Never throws — falls back to the heuristic best guess.
   */
  async detectLanguage(
    config: AssistantConfig,
    text: string,
    usageCtx?: TranslationUsageContext,
  ): Promise<string> {
    const h = detectLanguageHeuristic(text);
    if (h.confidence >= 0.4) return h.lang;
    try {
      const provider = buildTranslationProvider(config, undefined, makeUsageSink(usageCtx));
      if (provider.detectLanguage) {
        const code = await provider.detectLanguage(text);
        if (/^[a-z]{2}$/.test(code)) return code;
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, "engine detectLanguage failed — using heuristic");
    }
    return h.lang;
  },

  /** Validate an engine's reachability/keys (for the settings "test" button). */
  async ping(config: AssistantConfig, engineOverride?: TranslationEngineId) {
    try {
      const provider = buildTranslationProvider(config, engineOverride);
      return provider.ping();
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  },

  /**
   * Prove a config's engine actually translates: ONE real EN→target call,
   * bypassing the never-throw `translate()` wrapper. "Working" = non-empty
   * output that DIFFERS from the sample (a degraded engine returns the source
   * verbatim, and 429/401/timeout throw). Used by the settings save + test.
   */
  async probeConfig(
    config: AssistantConfig,
    target: string,
    sample?: string,
  ): Promise<{ ok: boolean; detail: string; sample?: string }> {
    const to = target || "es";
    const source = (sample && sample.trim()) || PROBE_SAMPLE_EN;
    try {
      const provider = buildTranslationProvider(config);
      const { masked, spans } = maskCode(source);
      const out = await withTimeout(provider.translate(masked, "en", to), PROBE_TIMEOUT_MS, "translation probe");
      const { restored, ok } = restoreCode(out, spans);
      if (!ok) return { ok: false, detail: "el motor alteró/eliminó zonas de código protegidas" };
      if (!restored.trim()) return { ok: false, detail: "el motor devolvió texto vacío" };
      if (normalizeProbe(restored) === normalizeProbe(source))
        return { ok: false, detail: "el motor devolvió el texto sin traducir" };
      return { ok: true, detail: "ok", sample: restored };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  },

  /**
   * Verify the DESIRED translation engine works; if not, fall back to the first
   * working alternative for which credentials exist; if none work, DISABLE
   * background translation. Returns the translation block to persist plus a
   * per-candidate report. Never throws.
   */
  async verifyWithFallback(
    config: AssistantConfig,
    desired: TranslationConfig,
  ): Promise<TranslationVerifyResult> {
    const target = desired.targetLanguage || "es";
    const trials: TranslationTrial[] = [];
    const candidates = buildCandidates(config, desired);
    for (const cand of candidates) {
      const trialCfg: AssistantConfig = { ...config, translation: applyCandidate(desired, cand) };
      const res = await this.probeConfig(trialCfg, target);
      trials.push({ engine: cand.engine, providerId: cand.ai?.providerId, model: cand.ai?.model, ok: res.ok, detail: res.detail });
      if (res.ok) {
        const fellBack = trials.length > 1;
        // A fallback engine must STICK: pin it (aiFollowActive=false) so the
        // runtime resolver uses it instead of re-following the active provider
        // that just failed. The first-choice success keeps the user's setting.
        return {
          translation: { ...applyCandidate(desired, cand), enabled: true, ...(fellBack ? { aiFollowActive: false } : {}) },
          enabled: true,
          fellBack,
          disabled: false,
          trials,
        };
      }
      log.warn({ engine: cand.engine, providerId: cand.ai?.providerId, detail: res.detail }, "translation candidate failed verification");
    }
    // Every candidate failed → turn background translation off (keep the user's
    // engine selection so they can fix credentials and re-enable later).
    log.error({ trials }, "all translation engines failed verification — disabling background translation");
    return { translation: { ...desired, enabled: false }, enabled: false, fellBack: false, disabled: true, trials };
  },

  /** Internal helpers exposed for unit tests. */
  _internal: { maskCode, restoreCode, translateByCodeSegments },
};
