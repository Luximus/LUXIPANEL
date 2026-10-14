// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-target assistant configuration.
 *
 * Lives in `${LUXIPANEL_CONFIG_DIR}/assistant/config.json` on the connected
 * target (sidecar mode `0600`). Holds API keys for each provider — never
 * leaves the target except via the redacted DTO returned from
 * `/api/ai/config`.
 */

export const PROVIDER_IDS = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"] as const;
export type AssistantProviderId = (typeof PROVIDER_IDS)[number];

/** An explicitly requested provider controls this run, including agent chats.
 * Calls without a provider still inherit the bound agent's configured slot. */
export function resolveAgentRunProvider(
  requestedProvider: AssistantProviderId | undefined,
  _selectedModel: string | undefined,
  agentProvider: AssistantProviderId | undefined,
): AssistantProviderId | undefined {
  return requestedProvider ?? agentProvider;
}

/** Keep an agent's saved model only while running on that agent's provider. */
export function resolveAgentRunModel(
  selectedModel: string | undefined,
  agentModel: string | undefined,
  runProvider: AssistantProviderId | undefined,
  agentProvider: AssistantProviderId | undefined,
): string | undefined {
  return selectedModel?.trim() || (runProvider === agentProvider ? agentModel?.trim() || undefined : undefined);
}

/** Default assistant provider — the fallback when none is specified. */
export const DEFAULT_PROVIDER_ID: (typeof PROVIDER_IDS)[number] = "claude";

export type AssistantProviderMode = "api" | "cli";

export interface AssistantProviderApiConfig {
  apiKey: string;
  model: string;
  /** Optional override (DeepSeek custom base, self-hosted OpenAI-compat, …). */
  baseUrl?: string;
}

export interface AssistantProviderCliConfig {
  installed: boolean;
  loggedIn: boolean;
  binPath?: string;
  version?: string;
  /** Model id passed to the CLI (`--model`), set via `/model`. */
  model?: string;
  /** ISO timestamp of last install/login probe. */
  lastCheckedAt?: string;
}

export interface AssistantProviderConfig {
  mode: AssistantProviderMode;
  api?: AssistantProviderApiConfig;
  cli?: AssistantProviderCliConfig;
  /** When true, this provider gets its own tab in the chat (multi-provider). */
  active?: boolean;
}

// ── Auto-routing (automatic model / effort / multi-agent selection) ───────
//
// The user (and admin) no longer pick a model. A deterministic heuristic
// (`services/auto-router.service.ts`) classifies each message into a
// complexity tier and the active provider's model + reasoning effort are
// derived from that tier. The only admin control is a cost cap (`maxTier`)
// and an on/off toggle — both live in the Providers tab, not the env.

export const COMPLEXITY_TIERS = ["low", "medium", "high", "max"] as const;
export type ComplexityTier = (typeof COMPLEXITY_TIERS)[number];

export interface AutoRoutingConfig {
  /** When true (default) the heuristic picks the model/effort automatically. */
  enabled: boolean;
  /** Cost cap: the chosen tier is clamped to at most this tier. */
  maxTier: ComplexityTier;
}

export function defaultAutoRoutingConfig(): AutoRoutingConfig {
  return { enabled: true, maxTier: "max" };
}

// ── Approval mode (how the agent conducts mutating actions) ───────────────
//
// When the CLI agent wants to run a mutating tool it asks through the
// permission broker (the amber "approve/deny" box in the chat). This setting
// governs that gate (per-user, persisted in the same `0600` sidecar):
//   • "manual" — ask for every mutating action (the default, safest).
//   • "auto"   — auto-approve everything; the agent runs uninterrupted.
//   • "plan"   — the agent must present a numbered plan and wait before acting
//                (the gate still asks, and the system prompt enforces plan-first).
// `autoApproveTools` is the "approve & never ask again" allowlist: those tool
// names are auto-approved regardless of mode (moot under "auto").
//
// Per-provider coverage (see ai-assistant/README.md §Approval modes for the
// full table): claude + claude-minimax honor all three modes natively via
// `--permission-prompt-tool` / `--dangerously-skip-permissions` /
// `--permission-mode plan`. codex uses `--dangerously-bypass-approvals-and-
// sandbox` (one-shot), gemini uses `--yolo` (one-shot), grok has no flag —
// for those three the system-prompt block is the only enforcement and the
// mode is advisory. Background callers (cron jobs, security-audit analyzer)
// must pass `approvalModeOverride` explicitly; they default to "manual" and
// never inherit an interactive "auto".

export const APPROVAL_MODES = ["manual", "auto", "plan"] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export interface ApprovalConfig {
  /** How the agent conducts mutating actions (see above). */
  mode: ApprovalMode;
  /** Tool names the user chose "approve & never ask again" — auto-approved. */
  autoApproveTools: string[];
}

export function defaultApprovalConfig(): ApprovalConfig {
  return { mode: "manual", autoApproveTools: [] };
}

// ── Background translation layer ─────────────────────────────────────────
//
// A non-English user can have their input translated to English before it
// reaches the agent (cheaper tokens) and the agent's English answer translated
// back to their language for display — all in the background. The user picks
// the engine; keys live in this same `0600` sidecar.

export const TRANSLATION_ENGINE_IDS = ["ai", "deepl", "google", "libretranslate"] as const;
export type TranslationEngineId = (typeof TRANSLATION_ENGINE_IDS)[number];

export interface TranslationConfig {
  /** Global default: translate non-English conversations in the background. */
  enabled: boolean;
  /** Which engine performs translations. */
  engine: TranslationEngineId;
  /**
   * The user's display language (ISO 639-1, e.g. "es"). When empty/unset the
   * runtime auto-detects per conversation and pins `ConversationMeta.lang`.
   */
  targetLanguage?: string;
  /**
   * AI engine: reuse an existing provider slot (its API key/baseUrl) but force
   * a cheap model for this simple task.
   */
  ai?: { providerId: AssistantProviderId; model: string };
  /**
   * When true (the default), the AI translation engine FOLLOWS the active/main
   * chat provider (`activeProvider`) with a cheap model — so translation tracks
   * whatever provider the user runs by default. A manual provider pick in the
   * UI sets this false (an explicit override). Resolved at runtime by
   * `resolveAiConfig`, so changing the active provider re-points translation
   * automatically without rewriting `ai`.
   */
  aiFollowActive?: boolean;
  deepl?: { apiKey: string; baseUrl?: string };
  google?: { apiKey: string; baseUrl?: string };
  libretranslate?: { baseUrl: string; apiKey?: string };
}

// ── Voice (audio in/out) layer ───────────────────────────────────────────
//
// Audio INPUT is transcribed to text server-side (STT) and injected as the
// user's message, so it works with ANY chat model. Audio OUTPUT synthesizes the
// assistant's text reply to speech (TTS) on demand. Both engines REUSE an
// existing provider's API key — OpenAI uses the `codex` slot, Gemini the
// `gemini` slot — so there is no separate key to store. Availability ("según
// modelo se permita") is therefore derived from which provider keys exist; see
// `voiceCapabilities()` below and its mirror `services/providers/audio.ts`.

export const VOICE_ENGINE_IDS = ["openai", "gemini"] as const;
export type VoiceEngineId = (typeof VOICE_ENGINE_IDS)[number];
/** TTS can also run on the local Piper CLI engine (panel host, offline, free). */
export type TtsEngineId = VoiceEngineId | "piper" | "minimax";

export interface VoiceConfig {
  /** Master switch for the voice surface (mic + speaker). */
  enabled: boolean;
  /** STT engine; "auto" picks the first provider that has a key. */
  sttEngine: VoiceEngineId | "auto";
  /** TTS engine; "auto" picks the first TTS-capable provider that has a key. */
  ttsEngine: VoiceEngineId | "auto";
  /**
   * Audio output backend for TTS:
   *   "api" → cloud provider (OpenAI /v1/audio/speech) — high quality, billed.
   *   "cli" → local Piper engine on the panel host — offline, free, no quota.
   *   "minimax-cli" → MiniMax CLI on the target server — TTS via `mmx speech`.
   */
  ttsProvider: "api" | "cli" | "minimax-cli";
  /** Auto-play the assistant's reply as speech when an API-mode turn completes. */
  autoSpeak: boolean;
  /** TTS voice name (engine-specific; OpenAI default "alloy"). */
  voice?: string;
}

export function defaultVoiceConfig(): VoiceConfig {
  return { enabled: true, sttEngine: "auto", ttsEngine: "auto", ttsProvider: "api", autoSpeak: false, voice: "alloy" };
}

/**
 * Which voice engine (if any) can actually run, derived purely from configured
 * provider API keys. STT: OpenAI (Whisper/gpt-4o-transcribe) or Gemini. TTS:
 * OpenAI only in v1 (Gemini TTS returns raw PCM — deferred). "auto" resolves to
 * the preferred engine that has a key; an explicit engine only counts if its
 * key is present. This is the single source of truth the UI mirrors to decide
 * whether to show the mic/speaker controls.
 */
export function voiceCapabilities(cfg: AssistantConfig): {
  stt: VoiceEngineId | null;
  tts: TtsEngineId | null;
} {
  const hasOpenai = !!cfg.providers?.codex?.api?.apiKey;
  const hasGemini = !!cfg.providers?.gemini?.api?.apiKey;
  const hasMinimaxCli = !!cfg.providers?.minimax?.cli?.installed;
  const hasMinimaxAuth = !!cfg.providers?.minimax?.cli?.loggedIn || !!cfg.providers?.minimax?.api?.apiKey;
  const v = cfg.voice ?? defaultVoiceConfig();
  if (!v.enabled) return { stt: null, tts: null };

  // Bias "auto" toward the active/main chat provider's voice engine so voice
  // follows the default provider (codex→openai, gemini→gemini) when it has a
  // key; otherwise fall back to the fixed preference (first provider with a key).
  const activeEngine: VoiceEngineId | null =
    cfg.activeProvider === "codex" ? "openai" : cfg.activeProvider === "gemini" ? "gemini" : null;
  const sttPref: VoiceEngineId[] = activeEngine
    ? [activeEngine, ...(["openai", "gemini"] as VoiceEngineId[]).filter((e) => e !== activeEngine)]
    : ["openai", "gemini"];
  const sttHas = (e: VoiceEngineId) => (e === "openai" ? hasOpenai : hasGemini);
  let stt: VoiceEngineId | null = null;
  if (v.sttEngine === "auto") stt = sttPref.find(sttHas) ?? null;
  else if (sttHas(v.sttEngine)) stt = v.sttEngine;

  // TTS backend. "cli" → local Piper (controller confirms host install state).
  // "minimax-cli" → target-side `mmx speech` when the CLI is installed and the
  // user either logged it in already or configured a MiniMax API key the server
  // can persist on first use. "api" → OpenAI only in v1.
  const tts: TtsEngineId | null =
    v.ttsProvider === "cli"
      ? "piper"
      : v.ttsProvider === "minimax-cli"
        ? hasMinimaxCli && hasMinimaxAuth
          ? "minimax"
          : null
        : hasOpenai
          ? "openai"
          : null;
  return { stt, tts };
}

/**
 * UI complexity mode. "simple" hides provider/CLI/tool jargon and shows a
 * guided, non-programmer surface; "advanced" exposes the full UI. Per-user.
 */
export type AssistantUiMode = "simple" | "advanced";

// ── Default-tab preferences (which tab starts active) ─────────────────────
//
// Two selects on the assistant Settings modal's general screen: which tab the
// AGENTS section and the CONVERSATIONS list open on (dashboard grid + chat
// sidebar toggles). These are PER-SERVER preferences — they persist in this
// same config sidecar so they survive a reconnect (the frontend also mirrors
// them into a local `uiPrefs` cache for the views that read them at mount).
// Defaults preserve the historical behaviour (leaders / loose).

export const AGENTS_TABS = ["leaders", "projects"] as const;
export type AssistantAgentsTab = (typeof AGENTS_TABS)[number];

export const CONVERSATIONS_TABS = ["agents", "loose"] as const;
export type AssistantConversationsTab = (typeof CONVERSATIONS_TABS)[number];

// ── Third-party integrations (non-chat providers) ────────────────────────
//
// Credentials for services the assistant uses OUTSIDE the chat providers —
// today only ElevenLabs (real-time audio-call translation). They live in the
// same `0600` sidecar as the provider keys and, like them, NEVER leave the
// target unredacted: the public view exposes `apiKeySet` + `apiKeyPreview`
// (`••••abcd`) only.

export interface ElevenLabsIntegrationConfig {
  apiKey: string;
  /** Optional default voice used when a caller does not pick one. */
  defaultVoiceId?: string;
}

export interface AssistantIntegrationsConfig {
  elevenlabs?: ElevenLabsIntegrationConfig;
}

/** Empty by default — an integration exists only once its key is saved. */
export function defaultIntegrationsConfig(): AssistantIntegrationsConfig {
  return {};
}

/** Public (redacted) view of one integration — never carries the secret. */
export interface RedactedElevenLabsIntegration {
  apiKeySet: boolean;
  /** `••••abcd` when a key is stored, `null` when not. */
  apiKeyPreview: string | null;
  defaultVoiceId: string | null;
}

export interface RedactedIntegrationsConfig {
  elevenlabs: RedactedElevenLabsIntegration;
}

export interface AssistantConfig {
  enabled: boolean;
  activeProvider: AssistantProviderId;
  providers: Record<AssistantProviderId, AssistantProviderConfig>;
  /** Background translation settings (always present after load/backfill). */
  translation: TranslationConfig;
  /** Voice (STT in / TTS out) settings (always present after load/backfill). */
  voice: VoiceConfig;
  /** Automatic model/effort/multi-agent selection (always present after backfill). */
  autoRouting: AutoRoutingConfig;
  /** How the agent asks for approval before mutating actions (always present after backfill). */
  approval: ApprovalConfig;
  /** UI complexity mode (default "simple" for non-technical users). */
  uiMode: AssistantUiMode;
  /** Which AGENTS-section tab starts active (always present after backfill). */
  defaultAgentsTab: AssistantAgentsTab;
  /** Which CONVERSATIONS-list tab starts active (always present after backfill). */
  defaultConversationsTab: AssistantConversationsTab;
  /**
   * Per-server startup preference for NEW loose/project chats: which provider a
   * fresh chat opens on. Optional — when unset the frontend falls back to
   * `activeProvider`. Only a UI arrival hint; the backend's runtime provider
   * selection is unchanged.
   */
  defaultChatProvider?: AssistantProviderId;
  /**
   * Per-server startup preference for NEW loose/project chats: the model a fresh
   * chat opens on ("auto" or a provider model id). Optional — when unset the
   * frontend falls back to "auto". UI arrival hint only.
   */
  defaultChatModel?: string;
  /**
   * Third-party integration credentials (ElevenLabs today). Optional: absent
   * until the admin saves one. Redacted out of every public view.
   */
  integrations?: AssistantIntegrationsConfig;
}

/**
 * Order tried when resolving/fallback-picking a translation provider (cheap,
 * reliable engines first). SINGLE source shared by the runtime resolver
 * (`resolveEffectiveTranslationProvider`) and verify-on-save fallback, so both
 * land on the same provider.
 */
export const TRANSLATION_PROVIDER_PRIORITY: AssistantProviderId[] = ["gemini", "claude", "deepseek", "grok", "codex", "minimax"];

/** Cheap models used by the AI translation engine, per provider. */
export const DEFAULT_TRANSLATION_MODEL: Record<AssistantProviderId, string> = {
  claude: "claude-haiku-4-5",
  codex: "gpt-6-luna",
  gemini: "gemini-3.5-flash-lite",
  deepseek: "deepseek-flash",
  grok: "grok-4.7",
  minimax: "MiniMax-M3",
};

export function defaultTranslationConfig(): TranslationConfig {
  return {
    enabled: true,
    engine: "ai",
    targetLanguage: "",
    ai: { providerId: "claude", model: DEFAULT_TRANSLATION_MODEL.claude },
    aiFollowActive: true,
    deepl: { apiKey: "" },
    google: { apiKey: "" },
    libretranslate: { baseUrl: "", apiKey: "" },
  };
}

/** Sane defaults for a freshly connected target. */
export const DEFAULT_PROVIDER_MODEL: Record<AssistantProviderId, string> = {
  claude: "claude-sonnet-5",
  codex: "gpt-6-sol",
  gemini: "gemini-3.8-flash",
  deepseek: "deepseek-flash",
  grok: "grok-4.7",
  minimax: "MiniMax-M3",
};

/**
 * Model picked per provider for each complexity tier (auto-routing). Cheaper /
 * faster models for low-complexity chat, the most capable for high/max. A
 * providers with a single public model (grok) repeat it across tiers.
 */
export const PROVIDER_MODEL_TIERS: Record<
  AssistantProviderId,
  Record<ComplexityTier, string>
> = {
  claude: {
    low: "claude-haiku-4-5",
    medium: "claude-sonnet-5",
    // Sonnet handles the frequent high-tier heuristic; Opus is reserved for max.
    // Fable remains a manual choice for especially demanding work.
    high: "claude-sonnet-5",
    max: "claude-opus-5-5",
  },
  codex: {
    low: "gpt-6-luna",
    medium: "gpt-6-sol",
    high: "gpt-6-sol",
    max: "gpt-6-astra",
  },
  gemini: {
    low: "gemini-3.5-flash-lite",
    medium: "gemini-3.8-flash",
    high: "gemini-3.1-pro-preview",
    max: "gemini-3.1-pro-preview",
  },
  deepseek: {
    low: "deepseek-flash",
    medium: "deepseek-flash",
    high: "deepseek-v4-pro",
    max: "deepseek-v4-pro",
  },
  grok: {
    low: "grok-4.7",
    medium: "grok-4.7",
    high: "grok-4.7",
    max: "grok-4.7",
  },
  minimax: {
    low: "MiniMax-M2.7",
    medium: "MiniMax-M3",
    high: "MiniMax-M3",
    max: "MiniMax-M3",
  },
};

/**
 * Reasoning effort per tier. The provider decides whether its current model
 * actually supports the parameter (see the gating in each `*-api.provider.ts`).
 */
export const EFFORT_BY_TIER: Record<ComplexityTier, "low" | "medium" | "high" | "xhigh"> = {
  low: "low",
  medium: "medium",
  high: "high",
  max: "xhigh",
};

export function defaultAssistantConfig(): AssistantConfig {
  return {
    // Always active by default — the assistant has no enable/disable toggle.
    enabled: true,
    activeProvider: "claude",
    providers: PROVIDER_IDS.reduce(
      (acc, id) => {
        acc[id] = {
          mode: "api",
          api: { apiKey: "", model: DEFAULT_PROVIDER_MODEL[id] },
          cli: { installed: false, loggedIn: false },
        };
        return acc;
      },
      {} as Record<AssistantProviderId, AssistantProviderConfig>,
    ),
    translation: defaultTranslationConfig(),
    voice: defaultVoiceConfig(),
    autoRouting: defaultAutoRoutingConfig(),
    approval: defaultApprovalConfig(),
    uiMode: "simple",
    // Historical defaults (leaders / loose) — see AssistantConfig.
    defaultAgentsTab: "leaders",
    defaultConversationsTab: "loose",
    integrations: defaultIntegrationsConfig(),
  };
}

export function isAssistantProviderId(value: unknown): value is AssistantProviderId {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value);
}

// ── Redaction (for transport to the UI) ──────────────────────────────────

/** "••••" + last 4 chars when present, "" when missing. */
export function apiKeyHint(key: string | undefined): string {
  return key && key.length > 0 ? `••••${key.slice(-4)}` : "";
}

export interface RedactedTranslationConfig {
  enabled: boolean;
  engine: TranslationEngineId;
  targetLanguage: string;
  ai: { providerId: AssistantProviderId; model: string };
  aiFollowActive: boolean;
  deepl: { hasApiKey: boolean; apiKeyHint: string; baseUrl?: string };
  google: { hasApiKey: boolean; apiKeyHint: string; baseUrl?: string };
  libretranslate: { baseUrl: string; hasApiKey: boolean; apiKeyHint: string };
}

export function redactTranslationConfig(t: TranslationConfig): RedactedTranslationConfig {
  return {
    enabled: t.enabled,
    engine: t.engine,
    targetLanguage: t.targetLanguage ?? "",
    ai: {
      providerId: t.ai?.providerId ?? "claude",
      model: t.ai?.model ?? DEFAULT_TRANSLATION_MODEL.claude,
    },
    aiFollowActive: t.aiFollowActive !== false,
    deepl: { hasApiKey: !!t.deepl?.apiKey, apiKeyHint: apiKeyHint(t.deepl?.apiKey), baseUrl: t.deepl?.baseUrl },
    google: { hasApiKey: !!t.google?.apiKey, apiKeyHint: apiKeyHint(t.google?.apiKey), baseUrl: t.google?.baseUrl },
    libretranslate: {
      baseUrl: t.libretranslate?.baseUrl ?? "",
      hasApiKey: !!t.libretranslate?.apiKey,
      apiKeyHint: apiKeyHint(t.libretranslate?.apiKey),
    },
  };
}

export interface RedactedVoiceConfig {
  enabled: boolean;
  sttEngine: VoiceEngineId | "auto";
  ttsEngine: VoiceEngineId | "auto";
  /** Audio output backend: "api" (OpenAI), "cli" (local Piper), or MiniMax CLI. */
  ttsProvider: "api" | "cli" | "minimax-cli";
  autoSpeak: boolean;
  voice: string;
  /** Derived availability (per provider-key presence) — drives the UI gating. */
  capabilities: { stt: VoiceEngineId | null; tts: TtsEngineId | null };
}

export interface RedactedAssistantConfig {
  enabled: boolean;
  activeProvider: AssistantProviderId;
  providers: Record<
    AssistantProviderId,
    {
      mode: AssistantProviderMode;
      active: boolean;
      api: {
        hasApiKey: boolean;
        /** "" + last 4 chars when present, "" when missing. */
        apiKeyHint: string;
        model: string;
        baseUrl?: string;
      };
      cli: AssistantProviderCliConfig;
    }
  >;
  translation: RedactedTranslationConfig;
  voice: RedactedVoiceConfig;
  autoRouting: AutoRoutingConfig;
  /** Approval mode + auto-approved tools (not secret — drives the chat selector). */
  approval: ApprovalConfig;
  uiMode: AssistantUiMode;
  /** Per-server default-tab preferences (not secret — drive the UI toggles). */
  defaultAgentsTab: AssistantAgentsTab;
  defaultConversationsTab: AssistantConversationsTab;
  /** Per-server startup provider/model for new loose/project chats (may be unset). */
  defaultChatProvider?: AssistantProviderId;
  defaultChatModel?: string;
  /** Third-party integrations — presence + preview only, never the key. */
  integrations: RedactedIntegrationsConfig;
}

/**
 * Public view of the integrations block: presence + a `••••abcd` preview, never
 * the key itself. Reuses the same `apiKeyHint` helper as the provider keys.
 */
export function redactIntegrationsConfig(
  i: AssistantIntegrationsConfig | undefined,
): RedactedIntegrationsConfig {
  const key = i?.elevenlabs?.apiKey ?? "";
  const voiceId = i?.elevenlabs?.defaultVoiceId ?? "";
  return {
    elevenlabs: {
      apiKeySet: key.length > 0,
      apiKeyPreview: key.length > 0 ? apiKeyHint(key) : null,
      defaultVoiceId: voiceId.length > 0 ? voiceId : null,
    },
  };
}

export function redactVoiceConfig(cfg: AssistantConfig): RedactedVoiceConfig {
  const v = cfg.voice ?? defaultVoiceConfig();
  return {
    enabled: v.enabled,
    sttEngine: v.sttEngine,
    ttsEngine: v.ttsEngine,
    ttsProvider: v.ttsProvider ?? "api",
    autoSpeak: v.autoSpeak,
    voice: v.voice ?? "alloy",
    capabilities: voiceCapabilities(cfg),
  };
}

export function redactAssistantConfig(cfg: AssistantConfig): RedactedAssistantConfig {
  const providers = {} as RedactedAssistantConfig["providers"];
  for (const id of PROVIDER_IDS) {
    const p = cfg.providers[id];
    const key = p.api?.apiKey ?? "";
    providers[id] = {
      mode: p.mode,
      active: p.active ?? false,
      api: {
        hasApiKey: key.length > 0,
        apiKeyHint: apiKeyHint(key),
        model: p.api?.model ?? DEFAULT_PROVIDER_MODEL[id],
        baseUrl: p.api?.baseUrl,
      },
      cli: p.cli ?? { installed: false, loggedIn: false },
    };
  }
  return {
    enabled: cfg.enabled,
    activeProvider: cfg.activeProvider,
    providers,
    translation: redactTranslationConfig(cfg.translation ?? defaultTranslationConfig()),
    voice: redactVoiceConfig(cfg),
    autoRouting: cfg.autoRouting ?? defaultAutoRoutingConfig(),
    approval: cfg.approval ?? defaultApprovalConfig(),
    uiMode: cfg.uiMode ?? "simple",
    defaultAgentsTab: cfg.defaultAgentsTab ?? "leaders",
    defaultConversationsTab: cfg.defaultConversationsTab ?? "loose",
    integrations: redactIntegrationsConfig(cfg.integrations),
    // Optional startup provider/model for new chats — passed through as-is
    // (undefined ⇒ the frontend falls back to activeProvider + "auto").
    ...(cfg.defaultChatProvider ? { defaultChatProvider: cfg.defaultChatProvider } : {}),
    ...(cfg.defaultChatModel ? { defaultChatModel: cfg.defaultChatModel } : {}),
  };
}
