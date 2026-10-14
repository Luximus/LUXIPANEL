import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { PROVIDER_META, ProviderIcon } from "../../../../components/ProviderIcon";
import { directAi } from "../../../../api/assistantDirect";
import type { Messages } from "../../../../i18n";
import "./ProvidersView.css";

/**
 * Vista "Proveedores" FUNCIONAL del asistente en modo directo (servidor
 * STANDALONE): habla DIRECTO con `/api/ai/config*` del box vía `directAi`
 * (sin token de portal, sin túnel). Réplica adaptada de
 * `frontend/src/components/servers/ServerAssistantProviders.tsx`.
 */

type ProviderApiState = {
  hasApiKey: boolean;
  apiKeyHint?: string;
  model?: string;
};

type ProviderCliState = {
  installed: boolean;
  loggedIn: boolean;
  version?: string;
  model?: string;
};

type ProviderConfigState = {
  mode: "api" | "cli";
  active: boolean;
  api: ProviderApiState;
  cli: ProviderCliState;
};

type AssistantFullConfig = {
  providers: Record<string, ProviderConfigState>;
};

type ConfigEnvelope = { ok?: boolean; config?: AssistantFullConfig };
type TestEnvelope = { ok?: boolean; detail?: string };

type LoadState =
  | { kind: "loading" }
  | { kind: "error-network" }
  | { kind: "error-version" }
  | { kind: "ok"; config: AssistantFullConfig };

type ProbeResult = { ok: boolean; detail?: string };

type Copy = Messages["serverStandalone"];

export default function ProvidersView({
  serverId,
  copy,
  readOnly,
}: {
  serverId: string;
  copy: Copy;
  readOnly: boolean;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(() => {
    setState({ kind: "loading" });
    void directAi<ConfigEnvelope>(serverId, "GET", "/api/ai/config").then((res) => {
      if (res === null) {
        setState({ kind: "error-network" });
        return;
      }
      if (!res.config) {
        setState({ kind: "error-version" });
        return;
      }
      setState({ kind: "ok", config: res.config });
    });
  }, [serverId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="sap-prov-center">
        <Loader2 size={20} className="sap-prov-spin" />
      </div>
    );
  }

  if (state.kind === "error-network" || state.kind === "error-version") {
    const message = state.kind === "error-network" ? copy.providersConfigErrorNetwork : copy.providersConfigErrorVersion;
    return (
      <div className="sap-prov-center">
        <p className="sap-prov-notice">{message}</p>
        <button type="button" className="sap-prov-btn" onClick={load}>
          {copy.providersRetry}
        </button>
      </div>
    );
  }

  const ids = Object.keys(state.config.providers);
  if (ids.length === 0) {
    return (
      <div className="sap-prov-center">
        <p className="sap-prov-notice">{copy.providersEmpty}</p>
      </div>
    );
  }

  return (
    <div className="sap-prov-grid">
      {ids.map((id) => (
        <ProviderCard
          key={id}
          id={id}
          state={state.config.providers[id]}
          copy={copy}
          readOnly={readOnly}
          onPatch={async (patch) => {
            const res = await directAi<ConfigEnvelope>(
              serverId,
              "PUT",
              `/api/ai/config/providers/${encodeURIComponent(id)}`,
              patch,
            );
            if (res?.config) {
              setState({ kind: "ok", config: res.config });
              return true;
            }
            return false;
          }}
          onTest={async () => {
            const res = await directAi<TestEnvelope>(
              serverId,
              "POST",
              `/api/ai/config/providers/${encodeURIComponent(id)}/test`,
            );
            if (!res) return { ok: false, detail: copy.providersError };
            return { ok: Boolean(res.ok), detail: res.detail };
          }}
        />
      ))}
    </div>
  );
}

type ProviderPatch = {
  mode?: "api" | "cli";
  active?: boolean;
  api?: { apiKey?: string; model?: string };
  cli?: { model?: string };
};

function ProviderCard({
  id,
  state,
  copy,
  readOnly,
  onPatch,
  onTest,
}: {
  id: string;
  state: ProviderConfigState;
  copy: Copy;
  readOnly: boolean;
  onPatch: (patch: ProviderPatch) => Promise<boolean>;
  onTest: () => Promise<ProbeResult>;
}) {
  const meta = PROVIDER_META[id] ?? { label: id, tint: "#64748b" };
  const active = Boolean(state.active);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(state.mode === "cli" ? (state.cli.model ?? "") : (state.api.model ?? ""));
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setModel(state.mode === "cli" ? (state.cli.model ?? "") : (state.api.model ?? ""));
  }, [state.mode, state.api.model, state.cli.model]);

  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (readOnly) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const currentModel = state.mode === "cli" ? (state.cli.model ?? "") : (state.api.model ?? "");
  const dirty = apiKey.length > 0 || model !== currentModel;

  const save = () => run(async () => {
    const patch: ProviderPatch = state.mode === "cli" ? {} : {};
    if (state.mode === "api") {
      const apiPatch: { apiKey?: string; model?: string } = {};
      if (apiKey.length > 0) apiPatch.apiKey = apiKey;
      if (model !== currentModel) apiPatch.model = model;
      if (Object.keys(apiPatch).length === 0) return;
      patch.api = apiPatch;
    } else {
      if (model === currentModel) return;
      patch.cli = { model };
    }
    const ok = await onPatch(patch);
    if (ok) {
      setApiKey("");
      setShowKey(false);
      setSavedFlash(true);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1800);
    }
  });

  const test = () => run(async () => {
    setProbe(await onTest());
  });

  const toggleActive = () => run(async () => {
    await onPatch({ active: !active });
  });

  const setMode = (mode: "api" | "cli") => run(async () => {
    if (mode !== state.mode) await onPatch({ mode });
  });

  return (
    <div className={`sap-prov-card ${active ? "is-active" : ""}`}>
      <div className="sap-prov-head">
        <span
          className="sap-prov-logo"
          style={{ color: meta.tint, background: `color-mix(in srgb, ${meta.tint} 12%, transparent)` }}
        >
          <ProviderIcon id={id} style={{ fontSize: "1.05rem" }} />
        </span>
        <span className="sap-prov-id">
          <span className="sap-prov-name">{meta.label}</span>
          {active ? <span className="sap-prov-badge">{copy.providersActive}</span> : null}
        </span>
      </div>

      <label className="sap-prov-toggle">
        <input
          type="checkbox"
          checked={active}
          disabled={readOnly || busy}
          aria-label={active ? copy.providersDeactivate : copy.providersActivate}
          onChange={() => void toggleActive()}
        />
        <span className="sap-prov-track" aria-hidden="true" />
        <span>{copy.providersShowInChat}</span>
      </label>

      <div className="sap-prov-field">
        <span className="sap-prov-label">{copy.providersMode}</span>
        <div className="sap-prov-segmented" role="tablist">
          {(["api", "cli"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={state.mode === m}
              disabled={readOnly || busy}
              className={`sap-prov-seg ${state.mode === m ? "is-on" : ""}`}
              onClick={() => void setMode(m)}
            >
              {m === "api" ? "API" : "CLI"}
            </button>
          ))}
        </div>
      </div>

      <label className="sap-prov-field">
        <span className="sap-prov-label">{copy.providersModel}</span>
        <input
          type="text"
          className="sap-prov-input"
          value={model}
          disabled={readOnly}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>

      {state.mode === "api" ? (
        <label className="sap-prov-field">
          <span className="sap-prov-label">
            {copy.providersApiKey}
            {state.api.hasApiKey && state.api.apiKeyHint ? (
              <em className="sap-prov-hint"> · {state.api.apiKeyHint}</em>
            ) : null}
          </span>
          <span className="sap-prov-key-wrap">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              disabled={readOnly}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={state.api.hasApiKey ? copy.providersApiKeyKeep : copy.providersApiKeyPlaceholder}
              className="sap-prov-input sap-prov-input--mono"
              autoComplete="off"
            />
            <button
              type="button"
              className="sap-prov-eye"
              onClick={() => setShowKey((v) => !v)}
              aria-label={copy.providersApiKey}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </span>
        </label>
      ) : (
        <div className="sap-prov-cli-status">
          <p>
            {state.cli.installed ? <Check size={12} className="sap-prov-ok" /> : <X size={12} className="sap-prov-warn" />}
            <span>
              {state.cli.installed ? copy.providersCliInstalled : copy.providersCliNotInstalled}
              {state.cli.installed && state.cli.version ? ` · ${state.cli.version}` : ""}
            </span>
          </p>
          <p>
            {state.cli.loggedIn ? <Check size={12} className="sap-prov-ok" /> : <X size={12} className="sap-prov-warn" />}
            <span>{state.cli.loggedIn ? copy.providersCliSession : copy.providersCliNoSession}</span>
          </p>
          <p className="sap-prov-cli-note">{copy.providersCliManaged}</p>
        </div>
      )}

      <div className="sap-prov-actions">
        <button type="button" className="sap-prov-btn" onClick={() => void test()} disabled={busy}>
          {busy ? <Loader2 size={12} className="sap-prov-spin" /> : null}
          {busy ? copy.providersTesting : copy.providersTest}
        </button>
        {state.mode === "api" && !readOnly ? (
          <button
            type="button"
            className="sap-prov-btn sap-prov-btn--primary"
            onClick={() => void save()}
            disabled={busy || !dirty}
          >
            {busy ? copy.providersSaving : savedFlash ? copy.providersSaved : copy.providersSave}
          </button>
        ) : null}
      </div>

      {probe ? (
        <p className={`sap-prov-probe ${probe.ok ? "is-ok" : "is-warn"}`}>
          {probe.ok ? "✓" : "⚠"} {probe.detail ?? (probe.ok ? copy.providersTestOk : copy.providersError)}
        </p>
      ) : null}
    </div>
  );
}
