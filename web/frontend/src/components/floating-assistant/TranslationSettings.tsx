// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";
import { CredentialsLink } from "../workspace/credentials/CredentialsLink";
import { TOGGLE_SWITCH } from "@/lib/ui-classes";
import {
  assistantTranslationApi,
  TRANSLATION_LANGUAGES,
  type RedactedTranslationConfig,
  type TranslationConfigPatch,
  type TranslationEngineId,
  type TranslationVerification,
} from "./assistant-api/translation";
import { PROVIDER_META, PROVIDER_ORDER, type AssistantConfigState, type AssistantProviderId } from "./assistant-api/providers";
import { CollapsibleSection } from "./CollapsibleSection";
import { useAssistantI18n } from "./i18n";

/** Human label for a translation engine/provider (for the verify message). */
const ENGINE_LABELS: Record<TranslationEngineId, string> = {
  ai: "IA",
  deepl: "DeepL",
  google: "Google",
  libretranslate: "LibreTranslate",
};

function engineLabel(engine: TranslationEngineId, providerId?: AssistantProviderId): string {
  if (engine === "ai" && providerId) return PROVIDER_META[providerId]?.label ?? providerId;
  return ENGINE_LABELS[engine] ?? engine;
}

/** A user-facing notice produced by the backend's verify-on-save. */
type SaveNotice =
  | { kind: "switched"; chosen: string; picked: string; reason: string }
  | { kind: "disabled"; reason: string };

/**
 * Map the panel's site locale (e.g. "zh-Hant", "es", "en") to a translation
 * target-language code supported by the picker. Returns "" when there's no
 * sensible target (English needs no translation; unsupported → auto-detect).
 */
function siteLocaleToTargetLang(locale: string | undefined): string {
  if (!locale) return "";
  const primary = locale.toLowerCase().split("-")[0] ?? "";
  if (primary === "zh") return "zh"; // zh-Hant / zh-* → zh target
  const supported = new Set(TRANSLATION_LANGUAGES.map((l) => l.code));
  return supported.has(primary) ? primary : "";
}

export function TranslationSettings({
  config,
  locale,
  credentialsOnly = false,
}: {
  config: AssistantConfigState;
  locale: string;
  credentialsOnly?: boolean;
}) {
  const t = useAssistantI18n().translationSettings;
  const [cfg, setCfg] = useState<RedactedTranslationConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ ok: boolean; detail?: string; sample?: string } | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const normalized = useRef(false);
  // Local entry state for the dedicated translation-engine credentials. Keys are
  // never returned by the API (only `hasApiKey` + a hint), so these inputs always
  // capture a NEW value to save. The LibreTranslate base URL IS returned, so it's
  // seeded from the loaded config.
  const [deeplKey, setDeeplKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [libreUrl, setLibreUrl] = useState("");
  const [libreKey, setLibreKey] = useState("");

  // Providers USABLE for translation. Translation calls a REST API, so a
  // provider qualifies only if it has an API key (CLI-only providers can't
  // translate). Checked here, before the selector renders, so the list never
  // offers an unusable provider.
  const usableProviders = PROVIDER_ORDER.filter((id) => Boolean(config.providers[id]?.api?.hasApiKey));
  const AUTO = "__auto__";
  // "Follow active provider" (default): the effective provider is the active
  // one; otherwise the user's explicit pick.
  const following = cfg?.aiFollowActive !== false;
  const effectiveProvider: AssistantProviderId | undefined = following
    ? (usableProviders.includes(config.activeProvider) ? config.activeProvider : usableProviders[0])
    : cfg?.ai.providerId;
  const effModel = effectiveProvider ? config.providers[effectiveProvider]?.api?.model ?? "" : "";
  const activeLabel = PROVIDER_META[config.activeProvider]?.label ?? config.activeProvider;

  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void assistantTranslationApi.getConfig().then((c) => {
      if (!cancelled) {
        setCfg(c);
        setLibreUrl(c.libretranslate?.baseUrl ?? "");
      }
    }).catch(error => { if (!cancelled) setProbe({ ok: false, detail: error.message }); }); };
    refresh();
    if (!credentialsOnly) window.addEventListener("luxipanel:credentials-changed", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("luxipanel:credentials-changed", refresh);
    };
  }, []);

  // One-shot normalization once the config is loaded: default the target
  // language to the site locale. The engine is NOT forced here — the backend
  // default (AI) applies and the user may pick another engine. The provider is
  // NOT pinned either — when "follow active provider" is on (default), the
  // backend resolves the effective provider from `activeProvider` at runtime.
  useEffect(() => {
    if (credentialsOnly || !cfg || normalized.current) return;
    normalized.current = true;
    const patch: TranslationConfigPatch = {};
    if (!cfg.targetLanguage) {
      const lang = siteLocaleToTargetLang(locale);
      if (lang) patch.targetLanguage = lang;
    }
    if (Object.keys(patch).length > 0) void save(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  /** Turn the backend's verify report into a user-facing notice (or clear it). */
  function applyVerification(next: RedactedTranslationConfig, v?: TranslationVerification) {
    if (!v || (!v.fellBack && !v.disabled)) {
      setNotice(null);
      return;
    }
    const firstFail = v.trials.find((tr) => !tr.ok);
    const reason = firstFail?.detail ?? t.genericFailure;
    if (v.disabled) {
      setNotice({ kind: "disabled", reason });
    } else {
      setNotice({
        kind: "switched",
        chosen: firstFail ? engineLabel(firstFail.engine, firstFail.providerId) : "",
        picked: engineLabel(next.engine, next.ai.providerId),
        reason,
      });
    }
  }

  async function save(patch: TranslationConfigPatch) {
    setBusy(true);
    try {
      const { translation, verification } = await assistantTranslationApi.setConfig(patch);
      setCfg(translation);
      applyVerification(translation, verification);
      window.dispatchEvent(new Event("luxipanel:credentials-changed"));
      return true;
    } catch (err) {
      setProbe({ ok: false, detail: (err as Error).message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setProbe(null);
    setBusy(true);
    try {
      setProbe(await assistantTranslationApi.test({ engine: cfg?.engine ?? "ai" }));
    } catch (err) {
      setProbe({ ok: false, detail: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-xs text-muted-foreground">
        <i className="ti ti-loader-2 animate-spin mr-1" aria-hidden></i>
        {probe?.detail || t.loading}
      </div>
    );
  }

  // An engine is selectable ONLY when its credentials are configured: AI needs a
  // usable (API-keyed) provider; DeepL/Google need their API key; LibreTranslate
  // needs its base URL. The currently-saved engine is always kept in the list so
  // the <select> stays valid even if its credentials were later cleared.
  const engineConfigured = (e: TranslationEngineId): boolean =>
    e === "ai"
      ? usableProviders.length > 0
      : e === "deepl"
        ? cfg.deepl.hasApiKey
        : e === "google"
          ? cfg.google.hasApiKey
          : e === "libretranslate"
            ? !!cfg.libretranslate.baseUrl.trim()
            : false;
  const ALL_ENGINES: TranslationEngineId[] = ["ai", "deepl", "google", "libretranslate"];
  const engineOptions = Array.from(new Set([...ALL_ENGINES.filter(engineConfigured), cfg.engine]));

  return (
    <CollapsibleSection
      defaultOpen={credentialsOnly}
      icon={<i className="ti ti-language text-lg" aria-hidden></i>}
      title={t.title}
      description={t.description}
      headerAction={!credentialsOnly &&
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={cfg.enabled}
            disabled={busy}
            onChange={(e) => void save({ enabled: e.currentTarget.checked })}
          />
          <span className={TOGGLE_SWITCH}></span>
        </label>
      }
    >
      {!credentialsOnly && <>
      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.yourLanguage}</span>
        <select
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          value={cfg.targetLanguage || ""}
          disabled={busy}
          onChange={(e) => void save({ targetLanguage: e.currentTarget.value })}
        >
          <option value="">{t.autoDetect}</option>
          {TRANSLATION_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.title}</span>
        <select
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          value={cfg.engine}
          disabled={busy}
          onChange={(e) => void save({ engine: e.currentTarget.value as TranslationEngineId })}
        >
          {engineOptions.map((e) => (
            <option key={e} value={e}>
              {ENGINE_LABELS[e]}{!engineConfigured(e) ? ` · ${t.notConfigured}` : ""}
            </option>
          ))}
        </select>
      </label>

      {cfg.engine === "ai" && (usableProviders.length === 0 ? (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
          {t.noActiveProviders}
        </p>
      ) : (
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{t.economicalProvider}</span>
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={following ? AUTO : cfg.ai.providerId}
            disabled={busy}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v === AUTO) {
                // Follow the active provider — backend resolves it at runtime.
                void save({ aiFollowActive: true });
              } else {
                const id = v as AssistantProviderId;
                void save({ aiFollowActive: false, ai: { providerId: id, model: config.providers[id]?.api?.model ?? "" } });
              }
            }}
          >
            <option value={AUTO}>{t.autoFollowActive} · {activeLabel}</option>
            {usableProviders.map((p) => (
              <option key={p} value={p}>{PROVIDER_META[p].label}</option>
            ))}
          </select>
          <span className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
            <span>{t.modeLabel}: {t.modeApi}</span>
            <span>{t.modelLabel}: {effModel || "-"}</span>
          </span>
        </label>
      ))}

      </>}
      {/* Credentials for the dedicated translation engines. An engine only
          appears in the selector above once its key/URL is saved here. */}
      {credentialsOnly ? <div className="mb-3 rounded-md border border-border/70 bg-card/30 p-2.5">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          {t.enginesCredentials}
        </p>

        {/* DeepL */}
        <div className="mb-2">
          <span className="mb-1 block text-[11px] text-muted-foreground">
            {t.deeplApiKey}{cfg.deepl.hasApiKey && <span className="text-emerald-500"> · {cfg.deepl.apiKeyHint}</span>}
          </span>
          <div className="flex gap-1.5">
            <input
              type="password"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={deeplKey}
              placeholder={cfg.deepl.hasApiKey ? t.passwordPlaceholder : t.deeplApiKey}
              disabled={busy}
              onChange={(e) => setDeeplKey(e.currentTarget.value)}
            />
            <button
              type="button"
              disabled={busy || !deeplKey.trim()}
              onClick={async () => { if (await save({ deepl: { apiKey: deeplKey.trim() } })) setDeeplKey(""); }}
              className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card/60 disabled:opacity-50"
            >
              {t.save}
            </button>
          </div>
        </div>

        {/* Google */}
        <div className="mb-2">
          <span className="mb-1 block text-[11px] text-muted-foreground">
            {t.googleApiKey}{cfg.google.hasApiKey && <span className="text-emerald-500"> · {cfg.google.apiKeyHint}</span>}
          </span>
          <div className="flex gap-1.5">
            <input
              type="password"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={googleKey}
              placeholder={cfg.google.hasApiKey ? t.passwordPlaceholder : t.googleApiKey}
              disabled={busy}
              onChange={(e) => setGoogleKey(e.currentTarget.value)}
            />
            <button
              type="button"
              disabled={busy || !googleKey.trim()}
              onClick={async () => { if (await save({ google: { apiKey: googleKey.trim() } })) setGoogleKey(""); }}
              className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card/60 disabled:opacity-50"
            >
              {t.save}
            </button>
          </div>
        </div>

        {/* LibreTranslate — base URL (required) + optional API key. */}
        <div>
          <span className="mb-1 block text-[11px] text-muted-foreground">
            LibreTranslate{cfg.libretranslate.baseUrl.trim() && <span className="text-emerald-500"> · {cfg.libretranslate.baseUrl}</span>}
          </span>
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={libreUrl}
              placeholder={t.serverUrlPlaceholder}
              disabled={busy}
              onChange={(e) => setLibreUrl(e.currentTarget.value)}
            />
            <div className="flex gap-1.5">
              <input
                type="password"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={libreKey}
                placeholder={cfg.libretranslate.hasApiKey ? t.passwordPlaceholder : t.optionalApiKey}
                disabled={busy}
                onChange={(e) => setLibreKey(e.currentTarget.value)}
              />
              <button
                type="button"
                disabled={busy || !libreUrl.trim()}
                onClick={async () => {
                  const saved = await save({ libretranslate: { baseUrl: libreUrl.trim(), ...(libreKey.trim() ? { apiKey: libreKey.trim() } : {}) } });
                  if (saved) setLibreKey("");
                }}
                className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card/60 disabled:opacity-50"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      </div> : <CredentialsLink label={t.enginesCredentials} credential="assistant" />}

      {notice && (
        <div
          role="alert"
          className={`mb-3 flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-snug ${
            notice.kind === "disabled"
              ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          <i className={`ti ${notice.kind === "disabled" ? "ti-alert-octagon" : "ti-switch-horizontal"} mt-0.5 shrink-0`} aria-hidden></i>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{notice.kind === "disabled" ? t.engineDisabled : t.engineSwitched}</p>
            {notice.kind === "switched" && notice.chosen && (
              <p className="mt-0.5 opacity-90">
                {notice.chosen} <i className="ti ti-arrow-right" aria-hidden></i> {notice.picked}
              </p>
            )}
            <p className="mt-0.5 break-words opacity-90">{t.reason}: {notice.reason}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="×"
          >
            <i className="ti ti-x" aria-hidden></i>
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || (cfg.engine === "ai" && usableProviders.length === 0)}
          onClick={() => void test()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-card/60 disabled:opacity-50"
        >
          <i className={`ti ${busy ? "ti-loader-2 animate-spin" : "ti-plug"}`} aria-hidden></i>
          {t.testEngine}
        </button>
        {probe && (
          <span className={`text-[11px] ${probe.ok ? "text-emerald-500" : "text-amber-500"}`}>
            {probe.ok ? `${t.ok}${probe.sample ? ` · "${probe.sample.slice(0, 48)}"` : ""}` : `${t.error}: ${probe.detail ?? t.genericFailure}`}
          </span>
        )}
      </div>
    </CollapsibleSection>
  );
}
