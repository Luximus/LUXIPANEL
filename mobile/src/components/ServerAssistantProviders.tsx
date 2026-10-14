import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { luxAssistantProxy } from "../api/client";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { SegmentedControl } from "./ui/SegmentedControl";
import { accentBg, styles } from "./assistant/chat-pane.styles";
import { PROVIDER_META, PROVIDER_ORDER, ProviderIcon, type AssistantProviderId } from "./ProviderIcon";
import { bubblePrefs, type BubblePrefs } from "../lib/bubble-prefs";
import type { ThemeTokens } from "../theme/colors";
import type { AssistantStrings } from "./assistant/types";

// Verde esmeralda del switch activo (paridad EXACTA con el panel: el toggle
// "Mostrar en chat" y los toggles de skills usan `emerald-500`, no el brand del
// servidor). Ver `frontend/.../ProvidersTab.tsx:315` (peer-checked:bg-emerald-500)
// y `SkillsSettings.tsx:213`.
export const SWITCH_ON_EMERALD = "#10b981";

// ── Tipos (espejo redactado del /api/ai/config de LUXIPANEL) ────────────────

export type ProviderState = {
  mode: "api" | "cli";
  active?: boolean;
  api: { hasApiKey: boolean; apiKeyHint: string; model: string };
  cli: { installed: boolean; loggedIn: boolean; version?: string; model?: string };
};

export type AssistantConfig = {
  enabled: boolean;
  activeProvider: string;
  providers: Record<string, ProviderState>;
};

// La selección de modelo YA NO se hace por proveedor: LUXIPANEL la retiró en
// favor del auto-routing + modelo por defecto en "General". Paridad exacta: el
// patch de proveedor solo cubre modo, activación y API key.
type ProviderPatch = {
  mode?: "api" | "cli";
  active?: boolean;
  api?: { apiKey?: string };
};

type ProbeResult = { ok: boolean; detail?: string };

const EMPTY_STATE: ProviderState = {
  mode: "api",
  active: false,
  api: { hasApiKey: false, apiKeyHint: "", model: "" },
  cli: { installed: false, loggedIn: false },
};

// LUXIPANEL no expone CLI estable para DeepSeek: la tarjeta queda solo-API.
const CLI_DISABLED: ReadonlySet<string> = new Set(["deepseek"]);

/**
 * Vista "Proveedores" del asistente del servidor (alterna con el chat vía el
 * engranaje de la cabecera). Réplica móvil del ProvidersTab de LUXIPANEL,
 * SOLO configuración de proveedores: tarjeta por proveedor con switch
 * "Mostrar en chat", toggles de burbuja, modo API/CLI, API key, panel CLI
 * gestionado (Subscription Key de MiniMax) y sonda de prueba. SIN selector de
 * modelo por proveedor (paridad exacta con el panel). Todo viaja por el túnel
 * SSH (`luxAssistantProxy`).
 */
export function ServerAssistantProviders({
  panelId,
  token,
  t,
  tokens,
  onProvidersChanged,
  topSections,
}: {
  panelId: string;
  token: string;
  t: AssistantStrings;
  tokens: ThemeTokens;
  /** Notifica al chat la lista de proveedores activos tras guardar cambios. */
  onProvidersChanged: (activeIds: string[], activeProvider?: string) => void;
  /** Bloques globales de la vista "Todos" (auto-routing, traducción, voz,
   *  notificaciones, skills) que se pintan ARRIBA de las tarjetas de proveedor,
   *  igual que la vista "Todos" del ProvidersTab de la web. */
  topSections?: React.ReactNode;
}) {
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [failed, setFailed] = useState(false);

  const applyConfig = (next: AssistantConfig) => {
    setConfig(next);
    const active = PROVIDER_ORDER.filter((id) => next.providers?.[id]?.active);
    onProvidersChanged(active, next.activeProvider);
  };

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void luxAssistantProxy<{ config?: AssistantConfig }>(panelId, token, "GET", "/api/ai/config").then((body) => {
      if (cancelled) return;
      if (body?.config) applyConfig(body.config);
      else setFailed(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId, token]);

  if (failed) {
    return (
      <View style={styles.provLoading}>
        <Text style={[styles.provLoadingText, { color: tokens.danger }]}>{t.configError}</Text>
      </View>
    );
  }
  if (!config) {
    return (
      <View style={styles.provLoading}>
        <ActivityIndicator size="small" color={tokens.brand} />
        <Text style={[styles.provLoadingText, { color: tokens.textMuted }]}>{t.loadingConfig}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.provView} contentContainerStyle={styles.provViewContent} nestedScrollEnabled>
      {topSections ? <View style={{ gap: 14, marginBottom: 4 }}>{topSections}</View> : null}
      {PROVIDER_ORDER.map((id) => (
        <ProviderCard
          key={id}
          id={id}
          state={config.providers?.[id] ?? EMPTY_STATE}
          t={t}
          tokens={tokens}
          onPatch={async (patch) => {
            const body = await luxAssistantProxy<{ config?: AssistantConfig }>(
              panelId, token, "PUT", `/api/ai/config/providers/${id}`, patch,
            );
            if (body?.config) applyConfig(body.config);
            return body?.config ?? null;
          }}
          onTest={async () => {
            const body = await luxAssistantProxy<{ ok?: boolean; detail?: string }>(
              panelId, token, "POST", `/api/ai/config/providers/${id}/test`,
            );
            if (!body) return { ok: false, detail: t.configError };
            return { ok: body.ok === true, detail: body.detail };
          }}
        />
      ))}
    </ScrollView>
  );
}

/**
 * Toggle de burbuja por proveedor (preferencia de presentación del chat, sin
 * estado en el servidor). Paridad con el `BubbleToggle` del ProvidersTab web:
 * pastilla compacta que alterna un `BubblePrefs` en `bubblePrefs`.
 */
function BubbleToggle({
  provider,
  field,
  label,
  tokens,
}: {
  provider: string;
  field: keyof BubblePrefs;
  label: string;
  tokens: ThemeTokens;
}) {
  useSyncExternalStore(
    bubblePrefs.subscribe,
    () => JSON.stringify(bubblePrefs.get(provider)),
    () => "{}",
  );
  const checked = bubblePrefs.get(provider)[field];
  return (
    <Pressable
      onPress={() => bubblePrefs.set(provider, { [field]: !checked })}
      style={[
        styles.bubbleToggle,
        checked
          ? { backgroundColor: accentBg(tokens.brand), borderColor: tokens.brand }
          : { backgroundColor: "transparent", borderColor: tokens.border },
      ]}
    >
      <View
        style={[
          styles.bubbleDot,
          { borderColor: checked ? tokens.brand : tokens.textMuted, backgroundColor: checked ? tokens.brand : "transparent" },
        ]}
      />
      <Text style={[styles.bubbleToggleText, { color: checked ? tokens.brand : tokens.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function ProviderCard({
  id,
  state,
  t,
  tokens,
  onPatch,
  onTest,
}: {
  id: AssistantProviderId;
  state: ProviderState;
  t: AssistantStrings;
  tokens: ThemeTokens;
  onPatch: (patch: ProviderPatch) => Promise<AssistantConfig | null>;
  onTest: () => Promise<ProbeResult>;
}) {
  const meta = PROVIDER_META[id];
  const active = Boolean(state.active);
  const cliDisabled = CLI_DISABLED.has(id);
  const [apiKey, setApiKey] = useState("");
  const [subKey, setSubKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  // DeepSeek no tiene CLI estable: si el servidor devolviera mode="cli" lo
  // forzamos a "api" (paridad con el efecto del ProviderCard web).
  useEffect(() => {
    if (cliDisabled && state.mode === "cli") void onPatch({ mode: "api" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliDisabled, state.mode]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const key = apiKey.trim();
    if (key.length === 0) return;
    const next = await onPatch({ api: { apiKey: key } });
    if (next) setApiKey("");
  });

  const saveSubKey = () => run(async () => {
    const key = subKey.trim();
    if (key.length === 0) return;
    const next = await onPatch({ api: { apiKey: key } });
    if (next) setSubKey("");
  });

  const test = () => run(async () => {
    setProbe(null);
    setProbe(await onTest());
  });

  const showApi = state.mode === "api" || cliDisabled;

  return (
    <View
      style={[
        styles.provCard,
        { backgroundColor: tokens.bgInput, borderColor: active ? tokens.brand : tokens.border },
      ]}
    >
      <View style={styles.provCardHead}>
        <View style={[styles.provIconBox, { backgroundColor: accentBg(meta.tint) }]}>
          <ProviderIcon id={id} size={18} color={meta.tint} />
        </View>
        <View style={styles.provHeadMain}>
          <Text style={[styles.provLabel, { color: tokens.textPrimary }]}>{meta.label}</Text>
          <Text style={[styles.provDesc, { color: tokens.textMuted }]}>{t.providerDesc[id] ?? ""}</Text>
        </View>
      </View>

      <View style={styles.provSwitchRow}>
        <Text style={[styles.provSwitchLabel, { color: tokens.textSecondary }]}>{t.showInChat}</Text>
        <Switch
          value={active}
          disabled={busy}
          onValueChange={(v) => void run(() => onPatch({ active: v }))}
          trackColor={{ false: tokens.border, true: SWITCH_ON_EMERALD }}
          thumbColor="#ffffff"
        />
      </View>

      {/* Toggles de presentación de la burbuja (paridad con BubbleToggle web). */}
      <View style={styles.bubbleRow}>
        <BubbleToggle provider={id} field="input" label={t.bubbleInput ?? "Ver entrada"} tokens={tokens} />
        <BubbleToggle provider={id} field="modifiedFiles" label={t.modifiedFiles ?? "Archivos modificados"} tokens={tokens} />
        <BubbleToggle provider={id} field="terminalLive" label={t.bubbleTerminal ?? "Terminal en vivo"} tokens={tokens} />
      </View>

      {!cliDisabled ? (
        <SegmentedControl
          fill
          items={[{ key: "api", label: t.modeApi }, { key: "cli", label: t.modeCli }]}
          value={state.mode}
          onChange={(m) => { if (m !== state.mode) void run(() => onPatch({ mode: m as "api" | "cli" })); }}
        />
      ) : null}

      {showApi ? (
        <View>
          <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>
            {t.apiKey}
            {state.api.hasApiKey && state.api.apiKeyHint ? (
              <Text style={{ color: tokens.success }}>{`  · ${state.api.apiKeyHint}`}</Text>
            ) : null}
          </Text>
          <Input
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={state.api.hasApiKey ? t.keyReplace : t.keyPlaceholder}
            secureTextEntry
            secureToggle
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {/* Panel CLI gestionado por el panel (estado + Signed in + MCP). */}
          <View style={[styles.cliBox, { backgroundColor: tokens.bgSecondary, borderColor: tokens.border }]}>
            <View style={styles.cliRow}>
              <Text style={{ color: state.cli.installed ? tokens.success : tokens.warning, fontSize: 12 }}>
                {state.cli.installed ? "✓" : "✗"}
              </Text>
              <Text style={[styles.cliText, { color: tokens.textSecondary }]}>
                {state.cli.installed
                  ? `${t.cliInstalled}${state.cli.version ? ` · ${state.cli.version}` : ""}`
                  : t.cliNotInstalled}
              </Text>
            </View>
            <View style={styles.cliRow}>
              <Text style={{ color: state.cli.loggedIn ? tokens.success : tokens.warning, fontSize: 12 }}>
                {state.cli.loggedIn ? "✓" : "✗"}
              </Text>
              <Text style={[styles.cliText, { color: tokens.textSecondary }]}>
                {state.cli.loggedIn ? t.cliSession : t.cliNoSession}
              </Text>
            </View>
            <Text style={[styles.cliManagedText, { color: tokens.textMuted }]}>{t.cliManaged ?? "Estado gestionado por el panel."}</Text>
          </View>

          {/* MiniMax: Subscription Key (sk-cp-…) que el bridge escribe al env del
           *  wrapper `claude-minimax`. Se guarda en el slot compartido api.apiKey. */}
          {id === "minimax" ? (
            <View style={[styles.cliBox, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
              <Text style={[styles.fieldLabel, { color: tokens.textMuted, marginBottom: 6 }]}>
                {t.subscriptionKey ?? "Subscription Key (sk-cp)"}
                {state.api.hasApiKey && state.api.apiKeyHint ? (
                  <Text style={{ color: tokens.success }}>{`  · ${state.api.apiKeyHint}`}</Text>
                ) : null}
              </Text>
              <Input
                value={subKey}
                onChangeText={setSubKey}
                placeholder={state.api.hasApiKey ? t.keyReplace : (t.subscriptionKeyPlaceholder ?? "Pega tu Subscription Key (sk-cp-…)")}
                secureTextEntry
                secureToggle
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={[styles.provActionsRow, { justifyContent: "flex-end", marginTop: 8 }]}>
                <Button size="sm" variant="primary" label={t.save} loading={busy} disabled={busy || subKey.trim().length === 0} onPress={() => void saveSubKey()} />
              </View>
              <Text style={[styles.cliManagedText, { color: tokens.textMuted, marginTop: 4 }]}>{t.subscriptionKeyHint ?? ""}</Text>
            </View>
          ) : null}

          <Text style={[styles.cliMcpNote, { color: tokens.textMuted }]}>{t.mcpNote ?? "MCP disponible en la pestaña Access."}</Text>
        </View>
      )}

      <View style={styles.provActionsRow}>
        <Button size="sm" variant="ghost" label={busy ? t.testing : t.test} disabled={busy} onPress={() => void test()} />
        {showApi ? (
          <Button size="sm" variant="primary" label={t.save} loading={busy} disabled={apiKey.trim().length === 0 || busy} onPress={() => void save()} />
        ) : null}
      </View>

      {probe ? (
        <Text style={[styles.probeText, { color: probe.ok ? tokens.success : tokens.warning }]}>
          {probe.ok ? "✓ " : "⚠ "}
          {probe.detail ?? ""}
        </Text>
      ) : null}
    </View>
  );
}

export default ServerAssistantProviders;
