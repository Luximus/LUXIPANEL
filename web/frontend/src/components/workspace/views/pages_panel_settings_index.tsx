// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/settings/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel Settings — /panel/settings
 * Configuración global del panel (solo admins)
 */
import PanelLayout from "../module-frame";
import { ModuleHeaderStatus } from "../ModuleHeaderStatus";
import { getPageMessages } from "../view-context";
import {
  buildCustomLayoutPalette,
  DEFAULT_CUSTOM_LAYOUT_COLOR,
  LAYOUT_PALETTES,
  paletteToSettings,
} from "@/lib/layout-palettes";
import { DEFAULT_LAYOUT_SETTINGS, buildLayoutCss } from "@/lib/layout-branding";
import LoginEffectsConfig from "./components_settings_LoginEffectsConfig";
import ModalNavbar from "./components_ui_ModalNavbar";
import SettingsGeneralPanel from "./components_settings_SettingsGeneralPanel";
import SettingsLayoutPanel from "./components_settings_SettingsLayoutPanel";
import SettingsSecurityPanel from "./components_settings_SettingsSecurityPanel";
import SettingsCredentialsPanel from "./components_settings_SettingsCredentialsPanel";
import SettingsServersPanel from "./components_settings_SettingsServersPanel";
import SettingsModulesPanel from "./components_settings_SettingsModulesPanel";
import SettingsSystemPanel from "./components_settings_SettingsSystemPanel";
import SettingsDialogs from "./components_settings_SettingsDialogs";
export default function pages_panel_settings_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, [
    "settings",
    "files",
    "repositoryStore",
    "components",
    "servers",
  ]);
  // Panel-background copy. Locales not yet translated (only es/en define panelBg)
  // fall back to the login-background labels so SSR never dereferences undefined.
  const panelBgCopy = t.settings.layout.panelBg ?? {
    groupTitle: t.settings.layout.loginBg.groupTitle,
    enableLabel: t.settings.layout.loginBg.enableLabel,
    labelFallbackColor: t.settings.layout.loginBg.labelFallbackColor,
    labelActiveEffect: t.settings.layout.loginBg.labelActiveEffect,
  };
  // Predefined color palettes ("layouts"). Each carries a full light+dark color
  // set; selecting one re-themes the whole site. We precompute the live CSS here
  // (reusing the same buildLayoutCss the runtime uses) so the client can swap it
  // instantly, and serialize the catalog as JSON for the page script.
  const paletteI18n = (t.settings as Record<string, any>).palettes as
    | Record<
        string,
        {
          name?: string;
          description?: string;
        }
      >
    | undefined;
  const paletteCards = LAYOUT_PALETTES.map((p: any) => ({
    id: p.id,
    name: paletteI18n?.[p.id]?.name ?? p.name,
    description: paletteI18n?.[p.id]?.description ?? p.description,
    customizable: Boolean(
      (
        p as {
          customizable?: boolean;
        }
      ).customizable,
    ),
    preview: {
      light: {
        background: p.light.background,
        card: p.light.card,
        primary: p.light.primary,
        accent: p.light.primary_accent,
        foreground: p.light.foreground,
        border: p.light.border,
      },
      dark: {
        background: p.dark.background,
        card: p.dark.card,
        primary: p.dark.primary,
        accent: p.dark.primary_accent,
        foreground: p.dark.foreground,
        border: p.dark.border,
      },
    },
  }));
  const paletteJson = JSON.stringify(
    LAYOUT_PALETTES.map((p: any) => {
      const settings = paletteToSettings(p);
      return {
        id: p.id,
        settings,
        css: buildLayoutCss({ ...DEFAULT_LAYOUT_SETTINGS, ...settings }),
        customizable: Boolean(
          (
            p as {
              customizable?: boolean;
            }
          ).customizable,
        ),
      };
    }),
  );
  const customPalettePreview = buildCustomLayoutPalette(
    DEFAULT_CUSTOM_LAYOUT_COLOR,
  );
  // `general`, `layout` and `system` are admin-only (panel-wide config).
  // `security` is per-user (own 2FA / passkeys / recovery codes), shown
  // to everyone with a session.
  const isAdmin =
    (
      Astro.locals.user as {
        kind?: string;
      } | null
    )?.kind === "admin";
  const ALL_TABS = [
    {
      id: "general",
      label: t.settings.tabs.general,
      icon: "ti-settings",
      color: "text-primary",
      bg: "bg-primary/10",
      adminOnly: true,
    },
    {
      id: "layout",
      label: t.settings.tabs.layoutUi,
      icon: "ti-palette",
      color: "text-fuchsia-500",
      bg: "bg-fuchsia-500/10",
      adminOnly: true,
    },
    {
      id: "security",
      label: t.settings.tabs.security,
      icon: "ti-shield-lock",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      adminOnly: false,
    },
    {
      id: "credentials",
      label: t.settings.tabs.credentials,
      icon: "ti-key",
      color: "text-teal-500",
      bg: "bg-teal-500/10",
      adminOnly: false,
    },
    {
      id: "servers",
      label: (t.servers as any)?.pageTitle ?? "Servidores",
      icon: "ti-server",
      color: "text-sky-500",
      bg: "bg-sky-500/10",
      adminOnly: false,
    },
    {
      id: "modules",
      label: t.settings.tabs.modules,
      icon: "ti-bolt",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      adminOnly: true,
    },
    {
      id: "system",
      label: t.settings.tabs.system,
      icon: "ti-refresh",
      color: "text-red-500",
      bg: "bg-red-500/10",
      adminOnly: true,
    },
  ];
  const tabs = ALL_TABS.filter((t: any) => !t.adminOnly || isAdmin);
  const defaultTabId = tabs[0]?.id ?? "security";
  // ── Credenciales (Access Tokens / API keys por módulo) ──────────────────────
  // Se renderizan TODAS las tarjetas; `credentials-script1.ts` oculta en cliente
  // las de módulos no habilitados consultando `/api/modules/installed` (el JWT
  // `user.modules` es el catálogo del ROL, NO los módulos habilitados del panel).
  // Token simple: contrato GET/PUT/DELETE /api/<mod>/config (+ POST /test
  // opcional). Complejas (asistente IA, backups): enlazan a su UI nativa.
  // `del` = ruta DELETE; por defecto = base, salvo OpenClaw que borra en
  // /api/openclaw/api-key (NO /config). `gate` = módulo que habilita la tarjeta
  // (por defecto = id); BitNinja se gatea por su propio módulo.
  // Bloque i18n de la tarjeta ElevenLabs (null-safe como `cred` más abajo: si el
  // namespace perdiera el bloque, la tarjeta degrada en vez de tumbar el SSR).
  const credElevenLabs = ((
    (t.settings.credentials ?? {}) as Record<string, any>
  ).elevenlabs ?? {}) as Record<string, any>;
  // Bloque i18n de la tarjeta Tolqia (token de API de la cuenta tolqia.com que
  // habilita las llamadas con traducción para los usuarios de ESTE servidor).
  const credTolqia = (((t.settings.credentials ?? {}) as Record<string, any>)
    .tolqia ?? {}) as Record<string, any>;
  const TOKEN_CREDENTIALS = [
    {
      id: "cloudflare",
      label: "Cloudflare",
      icon: "ti-brand-cloudflare",
      base: "/api/cloudflare/config",
      del: "/api/cloudflare/config",
      test: "/api/cloudflare/test",
      putKey: "apiToken",
      setField: "tokenSet",
      previewField: "tokenPreview",
      docUrl: "https://dash.cloudflare.com/profile/api-tokens",
    },
    {
      id: "expo",
      label: "Expo (EAS)",
      icon: "ti-device-mobile",
      base: "/api/expo/config",
      del: "/api/expo/config",
      test: "",
      putKey: "token",
      setField: "tokenSet",
      previewField: "tokenPreview",
      docUrl: "https://expo.dev/settings/access-tokens",
    },
    {
      id: "openclaw",
      label: "OpenClaw",
      icon: "ti-robot",
      base: "/api/openclaw/config",
      del: "/api/openclaw/api-key",
      test: "/api/openclaw/test",
      putKey: "apiKey",
      setField: "apiKeySet",
      previewField: "apiKeyPreview",
      docUrl: "",
    },
    {
      id: "repository-store",
      gate: "repository-store|files",
      label: "Git / GitHub",
      icon: "ti-brand-github",
      base: "/api/admin/repository-store/config",
      del: "/api/admin/repository-store/config",
      test: "",
      putKey: "token",
      setField: "tokenConfigured",
      previewField: "",
      docUrl: "https://github.com/settings/tokens",
    },
    {
      id: "bitninja",
      label: "BitNinja",
      icon: "ti-shield-check",
      base: "/api/bitninja/config",
      del: "/api/bitninja/config",
      test: "",
      putKey: "licenseKey",
      setField: "tokenSet",
      previewField: "tokenPreview",
      docUrl: "https://bitninja.io",
    },
    // ElevenLabs: credencial del módulo Agentes IA (traducción en tiempo real de
    // las audiollamadas) → se gatea por "assistant", no por un módulo propio.
    // `extraField` = campo opcional adicional (Voice ID) del contrato genérico.
    {
      id: "elevenlabs",
      label: "ElevenLabs",
      icon: "ti-microphone",
      base: "/api/ai/integrations/elevenlabs",
      del: "/api/ai/integrations/elevenlabs",
      test: "/api/ai/integrations/elevenlabs/test",
      putKey: "apiKey",
      setField: "apiKeySet",
      previewField: "apiKeyPreview",
      docUrl: "https://elevenlabs.io/app/settings/api-keys",
      gate: "assistant",
      hint: credElevenLabs.help,
      extraField: credElevenLabs.voiceIdLabel
        ? {
            key: "defaultVoiceId",
            getField: "defaultVoiceId",
            label: credElevenLabs.voiceIdLabel,
            placeholder: credElevenLabs.voiceIdPlaceholder ?? "",
          }
        : null,
    },
    // Tolqia: el token de API con el que ESTE servidor se une a una cuenta de
    // tolqia.com (plan Plus/Premium). Con él, las llamadas con traducción corren
    // con las claves del dueño del token, no con las del panel. Se gatea por
    // "assistant" como ElevenLabs — Mensajes no es un módulo del catálogo.
    {
      id: "tolqia",
      label: "Tolqia",
      icon: "ti-phone-call",
      base: "/api/chat/tolqia/config",
      del: "/api/chat/tolqia/config",
      test: "/api/chat/tolqia/test",
      putKey: "token",
      setField: "tokenSet",
      previewField: "tokenPreview",
      docUrl: "https://tolqia.com/settings/api",
      gate: "assistant",
      hint: credTolqia.help,
      // El GET devuelve `accountSummary` ("Plan Plus · activo · traducción hasta
      // 4 participantes"): la nota lo pinta bajo el campo y se refresca al probar.
      noteField: "accountSummary",
    },
  ];
  // Credenciales de almacenamiento a nivel de cuenta (reutilizables por Backups).
  // `gate: "backups"` → solo visibles si el módulo Backups está habilitado.
  // R2 se presenta con la marca Cloudflare (configurable "desde Cloudflare").
  const STORAGE_CREDENTIALS = [
    {
      provider: "r2",
      label: "Cloudflare R2",
      icon: "ti-brand-cloudflare",
      gate: "backups",
      docUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
    },
    {
      provider: "s3",
      label: "Amazon S3 / compatible",
      icon: "ti-database",
      gate: "backups",
      docUrl:
        "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    },
  ];
  // Conectores MCP (almacenamiento/Notion) gestionados por el asistente IA vía
  // /api/ai/connectors. Los campos de credenciales los provee la API
  // (credentialFields); aquí solo declaramos id/label/icono y el gate.
  const CONNECTOR_CREDENTIALS = [
    {
      id: "google-drive",
      label: "Google Drive",
      icon: "ti-brand-google-drive",
    },
    { id: "onedrive", label: "OneDrive", icon: "ti-brand-onedrive" },
    { id: "dropbox", label: "Dropbox", icon: "ti-brand-dropbox" },
    { id: "notion", label: "Notion", icon: "ti-brand-notion" },
  ];
  // Null-safe: si el namespace i18n perdiera el bloque `credentials` (p.ej. un
  // regen/revert de locales), el tab degrada en vez de tumbar la página (500).
  const cred = (t.settings.credentials ?? null) as Record<string, any> | null;
  const credManagedSummary = (cred?.managedSummary ?? {}) as Record<
    string,
    string
  >;
  const credManagedHint = (cred?.managedHint ?? {}) as Record<string, string>;
  const credManagedLabel = (cred?.managedLabel ?? {}) as Record<string, string>;
  // Guías de ayuda por tarjeta (token/storage) — los conectores traen su guía del
  // backend (setup.steps) y la rellena el script.
  const credHelp = (cred?.help ?? {}) as Record<string, any>;
  const credGuides = {
    ...((credHelp.guides ?? {}) as Record<
      string,
      {
        steps: string[];
        docUrl?: string;
        docLabel?: string;
      }
    >),
    // La guía de ElevenLabs vive junto al resto de su bloque (credentials.elevenlabs).
    ...(credElevenLabs.guide ? { elevenlabs: credElevenLabs.guide } : {}),
    // Igual que ElevenLabs: la guía de Tolqia vive en su propio bloque i18n.
    ...(credTolqia.guide ? { tolqia: credTolqia.guide } : {}),
  };
  const MANAGED_CREDENTIALS = [
    // La tarjeta "Backups" se removió: las credenciales de almacenamiento ya están
    // como tarjetas propias (Cloudflare R2 + Amazon S3) más arriba.
    {
      id: "assistant",
      label: credManagedLabel.assistant ?? "Agentes IA",
      icon: "ti-robot-face",
      href: "",
      summary: credManagedSummary.assistant,
      hint: credManagedHint.assistant,
    },
  ];

  return (
    <Fragment>
      <PanelLayout title={t.settings.pageTitle} activeModule="settings">
        <div className="space-y-6">
          {/** Skeleton */}
          <div id="settings-skeleton" className="space-y-4">
            <div className="h-11 w-full rounded-xl border border-border bg-card animate-pulse" />
            <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
          </div>

          {/** Load error banner: shown when GET /api/settings fails so the page is
         never stuck on an infinite skeleton. The message text is set by the
         script (session/server vs generic) via #settings-load-error-msg. */}
          <div
            id="settings-load-error"
            role="alert"
            className="hidden rounded-xl border border-destructive/40 bg-destructive/10 p-4"
          >
            <div className="flex items-start gap-3">
              <i
                className="ti ti-alert-triangle text-lg text-destructive shrink-0 mt-0.5"
                aria-hidden="true"
              ></i>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {t.settings.loadFailure.title}
                </p>
                <p
                  id="settings-load-error-msg"
                  className="text-sm text-muted-foreground"
                >
                  {t.settings.loadFailure.genericMessage}
                </p>
              </div>
              <button
                id="settings-load-error-retry"
                type="button"
                className="shrink-0 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <i className="ti ti-refresh text-sm" aria-hidden="true"></i>
                <span>{t.settings.loadFailure.retry}</span>
              </button>
            </div>
          </div>

          {/** Tab container */}
          <div id="settings-content" className="hidden">
            {/** Tab nav (estilo modules: underline + count badge).
         El badge contador solo se pinta en los tabs que reciben un número
         real (Seguridad / Credenciales / Uso de datos); el resto no lleva
         badge. El estado se muestra en el encabezado del drawer. */}
            <div className="flex gap-1 overflow-x-auto border-b border-border pb-3 mb-5">
              {tabs.map((t: any) => {
                const hasCount = ["security", "credentials"].includes(t.id);
                return (
                  <Fragment>
                    <button
                      data-tab={t.id}
                      className={`tab-btn inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-all
                ${
                  t.id === defaultTabId
                    ? "border-primary text-primary hover:text-primary/80"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                    >
                      <span>{t.label}</span>
                      {hasCount && (
                        <Fragment>
                          <span
                            id={`tab-${t.id}-count`}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t.id === defaultTabId ? "bg-primary/10" : "bg-muted"}`}
                          >
                            —
                          </span>
                        </Fragment>
                      )}
                    </button>
                  </Fragment>
                );
              })}
            </div>
            <ModuleHeaderStatus>
              <div id="settings-autosave-status" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                {t.settings.header.autosave}
              </div>
            </ModuleHeaderStatus>

            {/** ── General ─────────────────────────────────────────── */}
            <SettingsGeneralPanel t={t} />

            {/** ── Layout / UI ─────────────────────────────────────── */}
            <SettingsLayoutPanel
              t={t}
              panelBgCopy={panelBgCopy}
              paletteCards={paletteCards}
              customPalettePreview={customPalettePreview}
              paletteJson={paletteJson}
            />

            {/** ── Seguridad ────────────────────────────────────────── */}
            <SettingsSecurityPanel t={t} />

            {/** ── Credenciales (Access Tokens / API keys por módulo) ── */}
            <SettingsCredentialsPanel
              isAdmin={isAdmin}
              cred={cred}
              t={t}
              credHelp={credHelp}
              credGuides={credGuides}
              TOKEN_CREDENTIALS={isAdmin ? TOKEN_CREDENTIALS : []}
              STORAGE_CREDENTIALS={isAdmin ? STORAGE_CREDENTIALS : []}
              CONNECTOR_CREDENTIALS={isAdmin ? CONNECTOR_CREDENTIALS : []}
              MANAGED_CREDENTIALS={MANAGED_CREDENTIALS}
            />

            {/** ── Servidores (bóveda SSH única: panel + agente IA) ─── */}
            <SettingsServersPanel t={t} />

            {/** ── Módulos (caché por servidor) ─────────────────────── */}
            <SettingsModulesPanel t={t} />

            {/** ── Sistema ──────────────────────────────────────────── */}
            <SettingsSystemPanel t={t} />
          </div>
        </div>

        {/** Hidden file input shared by all logo upload buttons */}
        <SettingsDialogs t={t} />
      </PanelLayout>

      <script
        id="settings-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["settings"]) }}
      ></script>
      <script
        id="credentials-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(t.settings.credentials),
        }}
      ></script>
    </Fragment>
  );
}
