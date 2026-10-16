// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target persistence of the assistant configuration.
 *
 * Layout on the connected target:
 *   ${LUXIPANEL_CONFIG_DIR}/assistant/config.json  (kv-store map, single key "current")
 *
 * The kv-store guarantees `0600` on creation, so API keys never land in a
 * world-readable file. Reads/writes resolve the target executor via
 * `AsyncLocalStorage` (the controller has already established the request
 * scope by the time we get here).
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import {
  defaultAssistantConfig,
  defaultTranslationConfig,
  defaultVoiceConfig,
  defaultAutoRoutingConfig,
  defaultApprovalConfig,
  DEFAULT_PROVIDER_ID,
  type AssistantConfig,
  type ApprovalConfig,
  type AutoRoutingConfig,
  type TranslationConfig,
  type VoiceConfig,
  type AssistantIntegrationsConfig,
} from "../models/assistant-config.types.js";

const MODULE = "assistant";
const COLLECTION = "config";
const DOC_ID = "current";

// Assistant config (active provider + API keys / CLI logins) is PER-USER:
// namespace the per-server collection by the context user so two Linux users on
// one server keep separate providers. The SHARED collection (no suffix) is the
// instance-wide default — and the historical location, since per-user
// namespacing was added later.
function sharedColl(executor?: Executor | null) {
  return kv(executor).module(MODULE).collection<AssistantConfig>(COLLECTION);
}
function userColl(executor: Executor | null | undefined, uid: number) {
  return kv(executor).module(MODULE).collection<AssistantConfig>(`${COLLECTION}-u${uid}`);
}
/** Write target: per-user when a user is in context, else the shared doc. */
function store(executor?: Executor | null) {
  const uid = getContextUserId();
  return uid ? userColl(executor, uid) : sharedColl(executor);
}

/**
 * Read the raw config doc, resolving the right namespace:
 * the context user's doc when it exists, else the SHARED doc (where configs
 * actually live for users who set them before per-user namespacing, and the
 * instance default used by background jobs whose owner never saved a personal
 * config). Background runners (cron AI agents) pin the owner's userId via
 * `runWithExecutor`, so this resolves the same config the owner sees in the UI.
 */
async function readDoc(executor?: Executor | null): Promise<AssistantConfig | null> {
  const uid = getContextUserId();
  if (uid) {
    const own = await userColl(executor, uid).get(DOC_ID);
    if (own) return own;
  }
  return sharedColl(executor).get(DOC_ID);
}

/**
 * Deep-merge the translation block so a partial patch (e.g. only the DeepL key)
 * never wipes the other engines' settings. Sub-objects merge field-by-field.
 */
function mergeTranslation(
  base: TranslationConfig | undefined,
  patch: Partial<TranslationConfig> | undefined,
): TranslationConfig {
  const b = { ...defaultTranslationConfig(), ...(base ?? {}) };
  if (!patch) return b;
  // `argos` was removed as an engine (offline NMT, too low-quality). Coerce any
  // stored/patched "argos" selection to the AI engine so existing configs keep
  // translating with a usable engine instead of an invalid one.
  const rawEngine = patch.engine ?? b.engine;
  const engine = (rawEngine as string) === "argos" ? "ai" : rawEngine;
  return {
    enabled: patch.enabled ?? b.enabled,
    engine,
    targetLanguage: patch.targetLanguage ?? b.targetLanguage,
    ai: {
      providerId: patch.ai?.providerId ?? b.ai?.providerId ?? DEFAULT_PROVIDER_ID,
      model: patch.ai?.model ?? b.ai?.model ?? "",
    },
    aiFollowActive: patch.aiFollowActive ?? b.aiFollowActive ?? true,
    deepl: {
      apiKey: patch.deepl?.apiKey ?? b.deepl?.apiKey ?? "",
      baseUrl: patch.deepl?.baseUrl ?? b.deepl?.baseUrl,
    },
    google: {
      apiKey: patch.google?.apiKey ?? b.google?.apiKey ?? "",
      baseUrl: patch.google?.baseUrl ?? b.google?.baseUrl,
    },
    libretranslate: {
      baseUrl: patch.libretranslate?.baseUrl ?? b.libretranslate?.baseUrl ?? "",
      apiKey: patch.libretranslate?.apiKey ?? b.libretranslate?.apiKey ?? "",
    },
  };
}

/** Merge the voice block field-by-field so a partial patch never wipes it. */
function mergeVoice(
  base: VoiceConfig | undefined,
  patch: Partial<VoiceConfig> | undefined,
): VoiceConfig {
  const b = { ...defaultVoiceConfig(), ...(base ?? {}) };
  if (!patch) return b;
  return {
    enabled: patch.enabled ?? b.enabled,
    sttEngine: patch.sttEngine ?? b.sttEngine,
    ttsEngine: patch.ttsEngine ?? b.ttsEngine,
    ttsProvider: patch.ttsProvider ?? b.ttsProvider,
    autoSpeak: patch.autoSpeak ?? b.autoSpeak,
    voice: patch.voice ?? b.voice,
    realtimeEnabled: patch.realtimeEnabled ?? b.realtimeEnabled ?? false,
  };
}

/** Merge the auto-routing block field-by-field so a partial patch never wipes it. */
function mergeAutoRouting(
  base: AutoRoutingConfig | undefined,
  patch: Partial<AutoRoutingConfig> | undefined,
): AutoRoutingConfig {
  const b = { ...defaultAutoRoutingConfig(), ...(base ?? {}) };
  if (!patch) return b;
  return {
    enabled: patch.enabled ?? b.enabled,
    maxTier: patch.maxTier ?? b.maxTier,
  };
}

/** Merge the approval block field-by-field so a partial patch (e.g. only the
 *  mode, or only the auto-approve list) never wipes the other field. The list
 *  is replaced wholesale when provided (callers compute the union first). */
function mergeApproval(
  base: ApprovalConfig | undefined,
  patch: Partial<ApprovalConfig> | undefined,
): ApprovalConfig {
  const b = { ...defaultApprovalConfig(), ...(base ?? {}) };
  if (!patch) return b;
  return {
    mode: patch.mode ?? b.mode,
    autoApproveTools: patch.autoApproveTools ?? b.autoApproveTools,
  };
}

/**
 * Merge the third-party integrations block (ElevenLabs today) sub-object by
 * sub-object so a partial patch (e.g. only the voice id) never wipes the key.
 * An explicit `{ elevenlabs: undefined }` in the patch CLEARS the integration
 * (that is how DELETE removes it).
 */
function mergeIntegrations(
  base: AssistantIntegrationsConfig | undefined,
  patch: AssistantIntegrationsConfig | undefined,
): AssistantIntegrationsConfig {
  const b = base ?? {};
  if (!patch) return b;
  const out: AssistantIntegrationsConfig = { ...b };
  if ("elevenlabs" in patch) {
    const el = patch.elevenlabs;
    if (!el) delete out.elevenlabs;
    else {
      const apiKey = el.apiKey || b.elevenlabs?.apiKey || "";
      const voiceId = el.defaultVoiceId !== undefined ? el.defaultVoiceId : b.elevenlabs?.defaultVoiceId;
      out.elevenlabs = { apiKey, ...(voiceId ? { defaultVoiceId: voiceId } : {}) };
    }
  }
  return out;
}

function merge(base: AssistantConfig, patch: Partial<AssistantConfig>): AssistantConfig {
  return {
    // The assistant is ALWAYS enabled — no opt-out. Ignore any stored/patched
    // `enabled:false` (the "Habilitar asistente IA" toggle was removed).
    enabled: true,
    activeProvider: patch.activeProvider ?? base.activeProvider,
    providers: { ...base.providers, ...(patch.providers ?? {}) } as AssistantConfig["providers"],
    translation: mergeTranslation(base.translation, patch.translation),
    voice: mergeVoice(base.voice, patch.voice),
    autoRouting: mergeAutoRouting(base.autoRouting, patch.autoRouting),
    approval: mergeApproval(base.approval, patch.approval),
    uiMode: patch.uiMode ?? base.uiMode ?? "simple",
    defaultAgentsTab: patch.defaultAgentsTab ?? base.defaultAgentsTab ?? "leaders",
    defaultConversationsTab: patch.defaultConversationsTab ?? base.defaultConversationsTab ?? "loose",
    // Optional startup provider/model for new chats. A patch that includes the
    // key (even as null → cleared) wins; otherwise keep the base. `null` clears
    // the preference back to "no default".
    ...mergeOptional("defaultChatProvider", base, patch),
    ...mergeOptional("defaultChatModel", base, patch),
    ...mergeOptional("defaultChatEffort", base, patch),
    integrations: mergeIntegrations(base.integrations, patch.integrations),
  };
}

/**
 * Carry an OPTIONAL config key through a merge with clear semantics: if the
 * patch names the key (even `null`), the patch wins (`null`/empty ⇒ unset);
 * otherwise the base value is preserved. Keeps the key absent when unset so the
 * sidecar JSON stays clean.
 */
function mergeOptional<K extends "defaultChatProvider" | "defaultChatModel" | "defaultChatEffort">(
  key: K,
  base: AssistantConfig,
  patch: Partial<AssistantConfig>,
): Partial<Pick<AssistantConfig, K>> {
  const source = key in patch ? patch : base;
  const value = source[key];
  return value ? ({ [key]: value } as Pick<AssistantConfig, K>) : {};
}

export const assistantConfigRepository = {
  async load(executor?: Executor | null): Promise<AssistantConfig> {
    const doc = await readDoc(executor);
    if (!doc) return defaultAssistantConfig();
    // Backfill missing provider entries (forward-compat with new providers).
    const fresh = defaultAssistantConfig();
    return {
      // Always enabled — see merge(). No opt-out from the UI or stored state.
      enabled: true,
      activeProvider: doc.activeProvider ?? fresh.activeProvider,
      providers: { ...fresh.providers, ...(doc.providers ?? {}) } as AssistantConfig["providers"],
      translation: mergeTranslation(fresh.translation, doc.translation),
      voice: mergeVoice(fresh.voice, doc.voice),
      autoRouting: mergeAutoRouting(fresh.autoRouting, doc.autoRouting),
      approval: mergeApproval(fresh.approval, doc.approval),
      uiMode: doc.uiMode ?? fresh.uiMode,
      defaultAgentsTab: doc.defaultAgentsTab ?? fresh.defaultAgentsTab,
      defaultConversationsTab: doc.defaultConversationsTab ?? fresh.defaultConversationsTab,
      // Optional startup provider/model for new chats — kept absent when unset.
      ...(doc.defaultChatProvider ? { defaultChatProvider: doc.defaultChatProvider } : {}),
      ...(doc.defaultChatModel ? { defaultChatModel: doc.defaultChatModel } : {}),
      ...(doc.defaultChatEffort ? { defaultChatEffort: doc.defaultChatEffort } : {}),
      // Third-party integrations (ElevenLabs) — absent in configs saved before
      // the block existed, so default to the empty object.
      integrations: doc.integrations ?? {},
    };
  },

  async save(cfg: AssistantConfig, executor?: Executor | null): Promise<AssistantConfig> {
    await store(executor).set(DOC_ID, cfg);
    return cfg;
  },

  async patch(
    patch: Partial<AssistantConfig>,
    executor?: Executor | null,
  ): Promise<AssistantConfig> {
    const current = await this.load(executor);
    const next = merge(current, patch);
    return this.save(next, executor);
  },

  /**
   * "Approve & never ask again": add `tool` to the persisted auto-approve
   * allowlist (union — no duplicates), keeping the current mode. Returns the
   * updated config. No-op write when the tool was already present.
   */
  async addAutoApproveTool(tool: string, executor?: Executor | null): Promise<AssistantConfig> {
    const current = await this.load(executor);
    const set = new Set(current.approval.autoApproveTools);
    if (set.has(tool)) return current;
    set.add(tool);
    return this.patch({ approval: { mode: current.approval.mode, autoApproveTools: [...set] } }, executor);
  },
};
