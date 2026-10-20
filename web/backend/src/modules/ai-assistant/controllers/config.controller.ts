// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * AI Assistant — configuration endpoints.
 *
 * GET  /api/ai/config                       → redacted config for the UI
 * PUT  /api/ai/config                       → toggle enabled / activeProvider
 * PUT  /api/ai/config/providers/:id         → set provider mode + api/cli settings
 * POST /api/ai/config/providers/:id/test    → ping the provider (cheap)
 */

import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { assistantNotFound } from "./not-found-i18n.js";
import { zodIssues } from "../../../shared/validators/index.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { providerModelCatalog } from "../services/provider-model-catalog.service.js";
import { makeOpenAiVoice } from "../services/voice/openai-voice.js";
import {
  PROVIDER_IDS,
  COMPLEXITY_TIERS,
  APPROVAL_MODES,
  AGENTS_TABS,
  CONVERSATIONS_TABS,
  CHAT_REASONING_EFFORTS,
  isAssistantProviderId,
  redactAssistantConfig,
  type AssistantConfig,
  type AssistantProviderConfig,
  type AssistantProviderId,
} from "../models/assistant-config.types.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const configPatchSchema = z.object({
  enabled: z.boolean().optional(),
  activeProvider: z.enum(PROVIDER_IDS).optional(),
  uiMode: z.enum(["simple", "advanced"]).optional(),
  // Per-server default-tab preferences (general-settings selects). Persisted
  // in the config sidecar so they survive a reconnect (not just localStorage).
  defaultAgentsTab: z.enum(AGENTS_TABS).optional(),
  defaultConversationsTab: z.enum(CONVERSATIONS_TABS).optional(),
  // Per-server startup preference for NEW loose/project chats (provider + model).
  // `null` clears the preference back to "no default". Model is "auto" or a
  // provider model id — kept as a short free string (models vary per provider).
  defaultChatProvider: z.enum(PROVIDER_IDS).nullable().optional(),
  defaultChatModel: z.string().max(128).nullable().optional(),
  defaultChatEffort: z.enum(CHAT_REASONING_EFFORTS).nullable().optional(),
  // Voice (audio in/out) settings — merged field-by-field by the repo. The
  // engines reuse provider keys, so there's no secret here to set separately.
  voice: z
    .object({
      enabled: z.boolean().optional(),
      realtimeEnabled: z.boolean().optional(),
      sttEngine: z.enum(["openai", "auto"]).optional(),
      ttsEngine: z.enum(["openai", "auto"]).optional(),
      ttsProvider: z.literal("api").optional(),
      autoSpeak: z.boolean().optional(),
      voice: z.string().max(64).optional(),
    })
    .optional(),
  // Approval mode (how the agent conducts mutating actions) + the
  // "never ask again" allowlist. Merged field-by-field by the repo.
  approval: z
    .object({
      mode: z.enum(APPROVAL_MODES).optional(),
      autoApproveTools: z.array(z.string().max(128)).max(200).optional(),
    })
    .optional(),
});

const autoRoutingPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxTier: z.enum(COMPLEXITY_TIERS).optional(),
  })
  .strict();

const providerPatchSchema = z
  .object({
    mode: z.enum(["api", "cli"]).optional(),
    active: z.boolean().optional(),
    api: z
      .object({
        apiKey: z.string().trim().max(512).optional(),
        model: z.string().min(1).max(128).optional(),
        baseUrl: z.string().url().max(512).optional(),
      })
      .optional(),
    // CLI fields are populated by the cli-installer service, not the user.
    // We accept a writable subset for parity with the API path.
    cli: z
      .object({
        installed: z.boolean().optional(),
        loggedIn: z.boolean().optional(),
        // `binPath` is interpolated into a login shell (`command -v <bin>` /
        // `<bin> --version`) on the connected target. Restrict it to safe path
        // characters so it can never carry shell metacharacters (RCE): no
        // spaces, `$`, backticks, `;`, `|`, `&`, quotes, newlines, etc.
        binPath: z
          .string()
          .max(512)
          .regex(/^[A-Za-z0-9._/-]+$/, "binPath contiene caracteres no permitidos")
          .optional(),
        version: z.string().max(64).optional(),
        model: z.string().max(128).optional(),
        lastCheckedAt: z.string().datetime().optional(),
      })
      .optional(),
  })
  .strict();

function applyProviderPatch(
  current: AssistantProviderConfig,
  patch: z.infer<typeof providerPatchSchema>,
): AssistantProviderConfig {
  const baseUrl = patch.api?.baseUrl !== undefined ? patch.api.baseUrl : current.api?.baseUrl || undefined;
  return {
    mode: patch.mode ?? current.mode,
    active: patch.active ?? current.active ?? false,
    api: {
      apiKey: patch.api?.apiKey ?? current.api?.apiKey ?? "",
      model: patch.api?.model ?? current.api?.model ?? "",
      ...(baseUrl !== undefined ? { baseUrl } : {}),
    },
    cli: { ...(current.cli ?? { installed: false, loggedIn: false }), ...(patch.cli ?? {}) },
  };
}

// ── Controllers ────────────────────────────────────────────────────────────

export const assistantConfigController = {
  /** GET /api/ai/config */
  get: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    res.json({ ok: true, config: redactAssistantConfig(cfg) });
  }),

  /** PUT /api/ai/config — toggle enabled + activeProvider only. */
  patch: asyncHandler(async (req: Request, res: Response) => {
    const parsed = configPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const next: Partial<AssistantConfig> = {};
    if (parsed.data.enabled !== undefined) next.enabled = parsed.data.enabled;
    if (parsed.data.activeProvider !== undefined) next.activeProvider = parsed.data.activeProvider;
    if (parsed.data.uiMode !== undefined) next.uiMode = parsed.data.uiMode;
    if (parsed.data.defaultAgentsTab !== undefined) next.defaultAgentsTab = parsed.data.defaultAgentsTab;
    if (parsed.data.defaultConversationsTab !== undefined)
      next.defaultConversationsTab = parsed.data.defaultConversationsTab;
    // Startup provider/model for new chats. Presence of the key (even null)
    // means "change it"; null ⇒ clear back to no default (merge drops it).
    if (parsed.data.defaultChatProvider !== undefined)
      next.defaultChatProvider = parsed.data.defaultChatProvider ?? undefined;
    if (parsed.data.defaultChatModel !== undefined)
      next.defaultChatModel = parsed.data.defaultChatModel ?? undefined;
    if (parsed.data.defaultChatEffort !== undefined)
      next.defaultChatEffort = parsed.data.defaultChatEffort ?? undefined;
    if (parsed.data.voice !== undefined) next.voice = parsed.data.voice as AssistantConfig["voice"];
    if (parsed.data.approval !== undefined) next.approval = parsed.data.approval as AssistantConfig["approval"];
    const saved = await assistantConfigRepository.patch(next, executor);
    res.json({ ok: true, config: redactAssistantConfig(saved) });
  }),

  /** PUT /api/ai/config/auto-routing — toggle + cost cap (admin). */
  setAutoRouting: asyncHandler(async (req: Request, res: Response) => {
    const parsed = autoRoutingPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const saved = await assistantConfigRepository.patch(
      { autoRouting: parsed.data as AssistantConfig["autoRouting"] },
      executor,
    );
    res.json({ ok: true, config: redactAssistantConfig(saved) });
  }),

  /** PUT /api/ai/config/providers/:id */
  setProvider: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params["id"];
    if (!isAssistantProviderId(id)) throw assistantNotFound(res.locals.locale, "provider");
    const parsed = providerPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body", zodIssues(parsed.error.issues, res.locals.locale));
    }
    const executor = getExecutor(req);
    const current = await assistantConfigRepository.load(executor);
    const updatedProvider = applyProviderPatch(current.providers[id], parsed.data);
    const next: AssistantConfig = {
      ...current,
      providers: { ...current.providers, [id]: updatedProvider } as AssistantConfig["providers"],
    };
    const saved = await assistantConfigRepository.save(next, executor);
    res.json({ ok: true, config: redactAssistantConfig(saved) });
  }),

  /**
   * POST /api/ai/config/providers/:id/test
   *
   * OpenAI validates the saved API key against the same endpoint/config used
   * by voice, including in CLI mode: CLI login does not authenticate audio.
   * Other providers retain their local configuration/installation checks.
   */
  testProvider: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params["id"];
    if (!isAssistantProviderId(id)) throw assistantNotFound(res.locals.locale, "provider");
    const executor = getExecutor(req);
    const cfg = await assistantConfigRepository.load(executor);
    const provider = cfg.providers[id as AssistantProviderId];
    if (id === "codex") {
      const result = await makeOpenAiVoice(cfg).ping();
      res.json({ ...result, probedAt: new Date().toISOString() });
      return;
    }
    if (provider.mode === "api") {
      const hasKey = (provider.api?.apiKey ?? "").length > 0;
      const hasModel = (provider.api?.model ?? "").length > 0;
      res.json({
        ok: hasKey && hasModel,
        detail: !hasKey ? "API key vacía" : !hasModel ? "Modelo vacío" : "Configuración válida",
        probedAt: new Date().toISOString(),
      });
      return;
    }
    // mode === "cli". We trust that if the binary is present, the user
    // has already authenticated it via the Terminal module's flow. If
    // not, the CLI itself will surface the error on first chat use.
    const cli = provider.cli ?? { installed: false, loggedIn: false };
    res.json({
      ok: Boolean(cli.installed),
      detail: cli.installed
        ? `Listo${cli.version ? ` · ${cli.version}` : ""}`
        : "CLI no instalado — instálalo desde la terminal flotante",
      probedAt: new Date().toISOString(),
    });
  }),

  /** GET /api/ai/config/providers/:id/models — authenticated, target-scoped model catalog. */
  getProviderModels: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params["id"];
    if (!isAssistantProviderId(id)) throw assistantNotFound(res.locals.locale, "provider");
    const executor = getExecutor(req);
    const config = await assistantConfigRepository.load(executor);
    const refresh = req.query["refresh"] === "1" || req.query["refresh"] === "true";
    res.json({ ok: true, catalog: await providerModelCatalog(executor, config, id, { refresh }) });
  }),
};
