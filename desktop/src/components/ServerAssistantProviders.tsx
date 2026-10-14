import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { luxAssistantProxy } from "../api/client";
import { ProviderIcon, PROVIDER_META } from "./ProviderIcon";

/**
 * Vista "Proveedores" del asistente del servidor — réplica de la pestaña
 * Proveedores del módulo Asistente IA de LUXIPANEL (`ProvidersTab.tsx`),
 * reducida a lo que aplica vía túnel: tarjetas por proveedor con toggle
 * "Mostrar en chat", segmented API/CLI, modelo (canónicos + custom), API key y
 * Probar. Habla con /api/ai/config* de LUXIPANEL vía el proxy del backend LP.
 */

const PROVIDER_ORDER = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"] as const;

/** Modelos canónicos por proveedor (mismo set que LUXIPANEL `assistant-api.ts`). */
const PROVIDER_MODELS: Record<string, string[]> = {
  claude: ["claude-opus-4-8", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5", "opus", "sonnet", "haiku"],
  codex: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-4.1", "gpt-4o"],
  gemini: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  minimax: ["MiniMax-M2.5", "MiniMax-M2.7", "MiniMax-M2.5-highspeed", "MiniMax-M2.1"],
};

/** Proveedores sin CLI estable (LUXIPANEL fuerza modo API). */
const CLI_DISABLED = new Set(["deepseek"]);

type ProviderMode = "api" | "cli";

export type ProviderState = {
  mode: ProviderMode;
  active?: boolean;
  api: { model: string; hasApiKey?: boolean; apiKeyHint?: string };
  cli: { installed: boolean; loggedIn: boolean; version?: string; model?: string };
};

export type AssistantConfig = {
  enabled: boolean;
  activeProvider: string;
  providers: Record<string, ProviderState>;
};

type ConfigEnvelope = { ok?: boolean; config?: AssistantConfig };
type ProbeResult = { ok: boolean; detail?: string; probedAt?: string };

type ProviderPatch = {
  mode?: ProviderMode;
  active?: boolean;
  api?: { apiKey?: string; model?: string };
  cli?: { model?: string };
};

type ProvidersStrings = {
  loading: string;
  loadError: string;
  retry: string;
  showInChat: string;
  apiMode: string;
  cliMode: string;
  model: string;
  cliModel: string;
  otherModel: string;
  chooseModel: string;
  customModelPlaceholder: string;
  apiKey: string;
  pasteKey: string;
  replaceKey: string;
  toggleSecret: string;
  save: string;
  saving: string;
  test: string;
  testing: string;
  okPrefix: string;
  warnPrefix: string;
  cliInstalled: string;
  cliNotInstalled: string;
  cliSession: string;
  cliNoSession: string;
  cliVersion: string;
  cliStatusManaged: string;
  descriptions: Record<string, string>;
};

const STRINGS: Record<string, ProvidersStrings> = {
  es: {
    loading: "Cargando configuración…",
    loadError: "No se pudo leer la configuración del asistente.",
    retry: "Reintentar",
    showInChat: "Mostrar en chat",
    apiMode: "API key",
    cliMode: "CLI local",
    model: "Modelo",
    cliModel: "Modelo (CLI)",
    otherModel: "Otro modelo…",
    chooseModel: "Elige un modelo",
    customModelPlaceholder: "nombre-del-modelo",
    apiKey: "API key",
    pasteKey: "Pega tu API key",
    replaceKey: "Reemplazar la key guardada",
    toggleSecret: "Mostrar/ocultar key",
    save: "Guardar",
    saving: "Guardando…",
    test: "Probar",
    testing: "Probando…",
    okPrefix: "OK ·",
    warnPrefix: "Aviso ·",
    cliInstalled: "CLI instalado",
    cliNotInstalled: "CLI no instalado",
    cliSession: "sesión iniciada",
    cliNoSession: "sin sesión",
    cliVersion: "versión",
    cliStatusManaged: "El estado del CLI se gestiona en el servidor (módulo Asistente de LUXIPANEL).",
    descriptions: {
      claude: "Modo agente nativo con tool_use.",
      codex: "Function calling vía OpenAI o CLI @openai/codex.",
      gemini: "Function declarations vía Generative Language API.",
      deepseek: "OpenAI-compatible. Modo CLI próximamente.",
      minimax: "Anthropic-compatible por API · CLI headless de texto vía mmx.",
    },
  },
  en: {
    loading: "Loading configuration…",
    loadError: "Couldn't read the assistant configuration.",
    retry: "Retry",
    showInChat: "Show in chat",
    apiMode: "API key",
    cliMode: "Local CLI",
    model: "Model",
    cliModel: "Model (CLI)",
    otherModel: "Other model…",
    chooseModel: "Choose a model",
    customModelPlaceholder: "model-name",
    apiKey: "API key",
    pasteKey: "Paste your API key",
    replaceKey: "Replace the stored key",
    toggleSecret: "Show/hide key",
    save: "Save",
    saving: "Saving…",
    test: "Test",
    testing: "Testing…",
    okPrefix: "OK ·",
    warnPrefix: "Warning ·",
    cliInstalled: "CLI installed",
    cliNotInstalled: "CLI not installed",
    cliSession: "logged in",
    cliNoSession: "no session",
    cliVersion: "version",
    cliStatusManaged: "CLI status is managed on the server (LUXIPANEL Assistant module).",
    descriptions: {
      claude: "Native agent mode with tool_use.",
      codex: "Function calling via OpenAI or the @openai/codex CLI.",
      gemini: "Function declarations via the Generative Language API.",
      deepseek: "OpenAI-compatible. CLI mode coming soon.",
      minimax: "Anthropic-compatible via API · headless text CLI via mmx.",
    },
  },
};

function strings(language?: string): ProvidersStrings {
  return STRINGS[(language ?? "es").slice(0, 2)] ?? STRINGS.es;
}

export default function ServerAssistantProviders({
  panelId,
  token,
  language,
  onConfigChanged,
}: {
  panelId: string;
  token: string;
  language?: string;
  /** Notifica al pane (chips de proveedor) cada vez que la config cambia. */
  onConfigChanged?: (config: AssistantConfig) => void;
}) {
  const t = strings(language);
  type ViewState = { kind: "loading" } | { kind: "error" } | { kind: "ok"; config: AssistantConfig };
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  // Carga inicial (y al cambiar de panel): el setState ocurre solo en el
  // callback async, nunca síncrono dentro del efecto.
  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<ConfigEnvelope>(panelId, token, "GET", "/api/ai/config").then((res) => {
      if (!cancelled) setState(res?.config ? { kind: "ok", config: res.config } : { kind: "error" });
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const retry = () => {
    setState({ kind: "loading" });
    void luxAssistantProxy<ConfigEnvelope>(panelId, token, "GET", "/api/ai/config").then((res) => {
      setState(res?.config ? { kind: "ok", config: res.config } : { kind: "error" });
    });
  };

  const applyConfig = (next: AssistantConfig) => {
    setState({ kind: "ok", config: next });
    onConfigChanged?.(next);
  };

  if (state.kind === "loading") {
    return (
      <div className="server-assistant__pview server-assistant__pview--center">
        <Loader2 size={20} className="animate-spin" />
        <p>{t.loading}</p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="server-assistant__pview server-assistant__pview--center">
        <AlertTriangle size={20} />
        <p>{t.loadError}</p>
        <button type="button" className="server-assistant__approve server-assistant__approve--ghost" onClick={retry}>
          {t.retry}
        </button>
      </div>
    );
  }

  const config = state.config;
  const ids = PROVIDER_ORDER.filter((id) => config.providers?.[id]);
  return (
    <div className="server-assistant__pview">
      {ids.map((id) => (
        <ProviderCard
          key={id}
          id={id}
          state={config.providers[id]}
          t={t}
          onPatch={async (patch) => {
            const res = await luxAssistantProxy<ConfigEnvelope>(
              panelId, token, "PUT", `/api/ai/config/providers/${encodeURIComponent(id)}`, patch,
            );
            if (res?.config) applyConfig(res.config);
            return res?.config ?? null;
          }}
          onTest={async () => {
            const res = await luxAssistantProxy<ProbeResult>(
              panelId, token, "POST", `/api/ai/config/providers/${encodeURIComponent(id)}/test`,
            );
            return res ?? { ok: false, detail: t.loadError };
          }}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  id,
  state,
  t,
  onPatch,
  onTest,
}: {
  id: string;
  state: ProviderState;
  t: ProvidersStrings;
  onPatch: (patch: ProviderPatch) => Promise<AssistantConfig | null>;
  onTest: () => Promise<ProbeResult>;
}) {
  const meta = PROVIDER_META[id];
  const active = Boolean(state.active);
  const cliDisabled = CLI_DISABLED.has(id);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  // Estado derivado: el modelo mostrado es el override local (selección sin
  // guardar) o el persistido en el servidor — sin useEffect de sincronía.
  const [modelOverride, setModelOverride] = useState<string | null>(null);
  const model = modelOverride ?? (state.api.model ?? "");
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = apiKey.length > 0 || model !== (state.api.model ?? "");

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const patch: ProviderPatch = {};
      if (apiKey.length > 0) patch.api = { ...(patch.api ?? {}), apiKey };
      if (model !== (state.api.model ?? "")) patch.api = { ...(patch.api ?? {}), model };
      const ok = await onPatch(patch);
      if (ok) { setApiKey(""); setShowKey(false); setModelOverride(null); }
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    if (busy) return;
    setBusy(true);
    try {
      setProbe(await onTest());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`server-assistant__pcard ${active ? "is-active" : ""}`}>
      <div className="server-assistant__pcard-head">
        <span className="server-assistant__pcard-ico" style={{ background: `color-mix(in srgb, ${meta?.tint ?? "#64748b"} 12%, transparent)`, color: meta?.tint }}>
          <ProviderIcon id={id} style={{ fontSize: "1.05rem" }} />
        </span>
        <span className="server-assistant__pcard-id">
          <span className="server-assistant__pcard-label">{meta?.label ?? id}</span>
          <span className="server-assistant__pcard-desc">{t.descriptions[id] ?? ""}</span>
        </span>
      </div>

      <label className="server-assistant__switch">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => { void onPatch({ active: e.currentTarget.checked }); }}
        />
        <span className="server-assistant__switch-track" aria-hidden />
        <span className="server-assistant__switch-label">{t.showInChat}</span>
      </label>

      <div className="server-assistant__seg" role="tablist">
        {(cliDisabled ? (["api"] as const) : (["api", "cli"] as const)).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={state.mode === m}
            className={`server-assistant__seg-btn ${state.mode === m ? "is-active" : ""}`}
            disabled={saving}
            onClick={() => { if (state.mode !== m) void onPatch({ mode: m }); }}
          >
            {m === "api" ? t.apiMode : t.cliMode}
          </button>
        ))}
      </div>

      {state.mode === "cli" ? (
        <>
          <div className="server-assistant__pcli">
            <p>
              {state.cli.installed
                ? <Check size={12} className="inline text-emerald-500" />
                : <AlertTriangle size={12} className="inline text-amber-500" />}{" "}
              {state.cli.installed ? t.cliInstalled : t.cliNotInstalled}
              {state.cli.installed ? ` · ${state.cli.loggedIn ? t.cliSession : t.cliNoSession}` : ""}
              {state.cli.version ? ` · ${t.cliVersion} ${state.cli.version}` : ""}
            </p>
            <p className="server-assistant__pcli-hint">{t.cliStatusManaged}</p>
          </div>
          <label className="server-assistant__pfield">
            <span>{t.cliModel}</span>
            <ModelSelect
              id={id}
              value={state.cli.model ?? ""}
              t={t}
              onChange={(m) => { void onPatch({ cli: { model: m } }); }}
            />
          </label>
        </>
      ) : (
        <>
          <label className="server-assistant__pfield">
            <span>{t.model}</span>
            <ModelSelect id={id} value={model} t={t} onChange={setModelOverride} />
          </label>
          <label className="server-assistant__pfield">
            <span>
              {t.apiKey}
              {state.api.hasApiKey ? <em className="server-assistant__pkey-hint"> · {state.api.apiKeyHint ?? "••••"}</em> : null}
            </span>
            <span className="server-assistant__pkey">
              <input
                type={showKey ? "text" : "password"}
                className="server-assistant__pinput"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={state.api.hasApiKey ? t.replaceKey : t.pasteKey}
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={t.toggleSecret}>
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </span>
          </label>
        </>
      )}

      <div className="server-assistant__pcard-foot">
        <button type="button" className="server-assistant__pbtn" onClick={() => void test()} disabled={busy}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : null}
          {busy ? t.testing : t.test}
        </button>
        {state.mode === "api" ? (
          <button
            type="button"
            className="server-assistant__pbtn server-assistant__pbtn--primary"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : null}
            {saving ? t.saving : t.save}
          </button>
        ) : null}
      </div>

      {probe ? (
        <p className={`server-assistant__probe ${probe.ok ? "is-ok" : "is-warn"}`}>
          {probe.ok ? <Check size={12} className="inline" /> : <AlertTriangle size={12} className="inline" />}{" "}
          {probe.ok ? t.okPrefix : t.warnPrefix} {probe.detail ?? ""}
        </p>
      ) : null}
    </div>
  );
}

function ModelSelect({
  id,
  value,
  t,
  onChange,
}: {
  id: string;
  value: string;
  t: ProvidersStrings;
  onChange: (model: string) => void;
}) {
  const known = PROVIDER_MODELS[id] ?? [];
  const options = value && !known.includes(value) ? [value, ...known] : known;
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <span className="server-assistant__pkey">
        <input
          type="text"
          autoFocus
          defaultValue={value}
          placeholder={t.customModelPlaceholder}
          className="server-assistant__pinput font-mono"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v) onChange(v);
            setCustom(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = (e.target as HTMLInputElement).value.trim();
              if (v) onChange(v);
              setCustom(false);
            }
          }}
        />
        <button type="button" onClick={() => setCustom(false)} aria-label="x">×</button>
      </span>
    );
  }

  return (
    <select
      className="server-assistant__pinput font-mono"
      value={value}
      onChange={(e) => {
        if (e.target.value === "__custom__") { setCustom(true); return; }
        onChange(e.target.value);
      }}
    >
      {!value ? <option value="">{t.chooseModel}</option> : null}
      {options.map((m) => <option key={m} value={m}>{m}</option>)}
      <option value="__custom__">{t.otherModel}</option>
    </select>
  );
}
