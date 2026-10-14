import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowLeftRight, Check, Key, Lock, RefreshCw, Server, ShieldCheck, X } from "lucide-react-native";
import { luxAssistantProxy } from "../../api/client";
import { modulesApi } from "./agents/agents-api";
import { PROVIDER_ORDER, ProviderIcon } from "../ProviderIcon";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { s } from "./styles";
import type { AssistantConfig, ApprovalMode, AuditEntry } from "./types";

type T = Messages["assistantSettings"];
type ApprovalState = { mode: ApprovalMode; autoApproveTools: string[] };

const EMERALD = "#10b981";
const PROVIDER_ID_SET = new Set<string>(PROVIDER_ORDER);

/** Etiqueta amigable (sin jerga) por prefijo de módulo. Réplica reducida de
 *  `humanizeToolName` de WEB/assistant-api.ts. */
function humanizeToolName(name: string): string {
  const mod = name.split(".")[0] ?? "";
  const map: Record<string, string> = {
    monitor: "Revisando el servidor",
    files: "Trabajando con archivos",
    mail: "Gestionando el correo",
    nginx: "Configurando el sitio web",
    ssl: "Gestionando certificados",
    cron: "Programando tareas",
    backup: "Copias de seguridad",
    users: "Gestionando usuarios",
    firewall: "Ajustando el firewall",
    hosting: "Gestionando el hosting",
    dashboard: "Consultando el panel",
    cli: "Ejecutando en terminal",
  };
  return map[mod] ?? name;
}

/**
 * Sub-tab "Accesos": réplica nativa de `AccessTab.tsx` de LUXIPANEL. Tres bloques:
 * (a) permisos (informativo), (b) Aprobación automática (allowlist "no preguntar
 * más" con revocar por tool + badge si el modo es "auto"), y (c) Invocaciones
 * recientes (registro de auditoría, con filtro por proveedor y detalle
 * cross-server). La lista de módulos on/off vive ahora en el sub-tab "Módulos".
 */
export function AccessSubTab({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const at = t.accessTab;
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [approvalErr, setApprovalErr] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [toolTitles, setToolTitles] = useState<Map<string, string>>(new Map());

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [auditErr, setAuditErr] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Config (para el modo y la allowlist de aprobación) + títulos de tools.
  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ config?: AssistantConfig }>(panelId, token, "GET", "/api/ai/config").then((body) => {
      if (cancelled) return;
      if (body?.config) setApproval(body.config.approval ?? { mode: "manual", autoApproveTools: [] });
      else setApprovalErr(true);
    });
    void modulesApi.list(panelId, token).then((mods) => {
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const mod of mods) for (const tool of mod.tools) if (tool.title) map.set(tool.name, tool.title);
      setToolTitles(map);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  // Registro de auditoría (recargable con el botón refrescar).
  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setAuditErr(false);
    void luxAssistantProxy<{ entries?: AuditEntry[] }>(panelId, token, "GET", "/api/ai/audit?limit=100").then((body) => {
      if (cancelled) return;
      if (body && Array.isArray(body.entries)) setEntries(body.entries);
      else setAuditErr(true);
    });
    return () => { cancelled = true; };
  }, [panelId, token, reloadKey]);

  const revokeAutoApprove = useCallback(async (tool: string) => {
    if (!approval || revoking) return;
    const prev = approval;
    const next = approval.autoApproveTools.filter((x) => x !== tool);
    setApproval({ ...approval, autoApproveTools: next }); // optimista
    setRevoking(tool);
    try {
      const body = await luxAssistantProxy<{ config?: AssistantConfig }>(
        panelId, token, "PUT", "/api/ai/config", { approval: { autoApproveTools: next } },
      );
      if (body?.config?.approval) setApproval(body.config.approval);
      else if (!body) setApproval(prev); // rollback si el proxy falló
    } finally {
      setRevoking(null);
    }
  }, [approval, revoking, panelId, token]);

  const availableProviders = useMemo(() => {
    if (!entries) return [] as string[];
    const seen = new Set<string>();
    const arr: string[] = [];
    for (const e of entries) if (e.provider && !seen.has(e.provider)) { seen.add(e.provider); arr.push(e.provider); }
    return arr;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (!entries) return [] as AuditEntry[];
    if (!selectedProvider) return entries;
    return entries.filter((e) => e.provider === selectedProvider);
  }, [entries, selectedProvider]);

  return (
    <View style={s.root}>
      {availableProviders.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: tokens.border }}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <ProviderPill label={at.all} active={selectedProvider === null} onPress={() => setSelectedProvider(null)} tokens={tokens} />
          {availableProviders.map((id) => (
            <ProviderPill
              key={id}
              label={id}
              icon={PROVIDER_ID_SET.has(id) ? <ProviderIcon id={id} size={13} color={selectedProvider === id ? "#ffffff" : tokens.textMuted} /> : undefined}
              active={selectedProvider === id}
              onPress={() => setSelectedProvider(id)}
              tokens={tokens}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
        {/* Permisos (informativo) */}
        <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 4 }]}>
          <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{at.permissionsTitle}</Text>
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{at.permissionsDescription}</Text>
        </View>

        {/* Aprobación automática (allowlist "no preguntar más") */}
        <View style={[s.card, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, gap: 6 }]}>
          <View style={[s.rowStart, { gap: 8 }]}>
            <ShieldCheck size={16} color={EMERALD} />
            <Text style={[s.toggleLabel, { color: tokens.textPrimary }]}>{at.autoApproveTitle}</Text>
            {approval?.mode === "auto" ? (
              <View style={[s.badge, { backgroundColor: `${tokens.warning}1a`, borderWidth: 1, borderColor: `${tokens.warning}55` }]}>
                <Text style={[s.badgeText, { color: tokens.warning }]}>{at.autoApproveModeAuto}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{at.autoApproveDescription}</Text>

          {approvalErr ? (
            <Text style={[s.cardDesc, { color: tokens.warning }]}>{t.loadError}</Text>
          ) : approval === null ? (
            <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.loading}</Text>
          ) : approval.autoApproveTools.length === 0 ? (
            <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{at.autoApproveEmpty}</Text>
          ) : (
            <View style={{ gap: 6, marginTop: 2 }}>
              {approval.autoApproveTools.map((tool) => {
                const title = toolTitles.get(tool) ?? humanizeToolName(tool);
                return (
                  <View
                    key={tool}
                    style={[s.rowBetween, { borderWidth: 1, borderColor: tokens.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: tokens.bgInput }]}
                  >
                    <View style={{ flex: 1 }}>
                      {title && title !== tool ? (
                        <Text style={[s.toggleLabel, { color: tokens.textPrimary }]} numberOfLines={1}>{title}</Text>
                      ) : null}
                      <Text style={[s.mono, { color: tokens.textMuted }]} numberOfLines={1}>{tool}</Text>
                    </View>
                    <Pressable
                      onPress={() => void revokeAutoApprove(tool)}
                      disabled={revoking !== null}
                      style={{ borderWidth: 1, borderColor: `${tokens.danger}55`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, opacity: revoking !== null ? 0.5 : 1 }}
                    >
                      <Text style={{ color: tokens.danger, fontSize: 12, fontWeight: "700" }}>
                        {revoking === tool ? "…" : at.autoApproveRevoke}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Invocaciones recientes */}
        <View style={[s.rowBetween]}>
          <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{at.recentInvocations}</Text>
          <Pressable
            onPress={() => setReloadKey((k) => k + 1)}
            style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 8, padding: 7 }}
          >
            <RefreshCw size={15} color={tokens.textMuted} />
          </Pressable>
        </View>

        {auditErr ? (
          <Text style={[s.cardDesc, { color: tokens.warning }]}>{t.loadError}</Text>
        ) : entries === null ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{t.loading}</Text>
        ) : entries.length === 0 ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{at.emptyRecent}</Text>
        ) : visibleEntries.length === 0 ? (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{at.emptyProvider}</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {visibleEntries.map((e) => (
              <AuditRow key={String(e.id ?? e.ts)} e={e} at={at} tokens={tokens} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AuditRow({ e, at, tokens }: { e: AuditEntry; at: T["accessTab"]; tokens: ThemeTokens }) {
  const [showKey, setShowKey] = useState(false);
  const isCross = e.kind === "cross-server";
  const when = (() => {
    try { return new Date(e.ts).toLocaleTimeString(); } catch { return e.ts; }
  })();
  return (
    <View
      style={[s.card, {
        padding: 10, gap: 4,
        backgroundColor: isCross ? `${tokens.brand}0d` : tokens.bgCardSolid,
        borderColor: isCross ? `${tokens.brand}66` : tokens.border,
      }]}
    >
      <View style={[s.rowBetween]}>
        <View style={[s.rowStart, { gap: 6, flex: 1 }]}>
          {e.success ? <Check size={14} color={EMERALD} /> : <X size={14} color={tokens.warning} />}
          {isCross ? <ArrowLeftRight size={13} color={tokens.brand} /> : null}
          <Text style={[s.mono, { color: tokens.textPrimary, flexShrink: 1 }]} numberOfLines={1}>{e.tool}</Text>
        </View>
        <Text style={{ fontSize: 10, color: tokens.textMuted }}>{when} · {e.durationMs}ms</Text>
      </View>

      {isCross ? (
        <View style={{ gap: 2, borderRadius: 7, backgroundColor: `${tokens.brand}0d`, paddingHorizontal: 8, paddingVertical: 6 }}>
          <View style={[s.rowStart, { gap: 5 }]}>
            <Server size={12} color={tokens.brand} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: tokens.textPrimary }}>{e.targetServerName || e.targetServerId}</Text>
            {e.targetHost ? <Text style={{ fontSize: 11, color: tokens.textMuted }}>· IP {e.targetHost}</Text> : null}
            {e.linuxUser ? <Text style={{ fontSize: 11, color: tokens.textMuted }}>· {e.linuxUser}</Text> : null}
          </View>
          {e.command ? <Text style={[s.mono, { color: tokens.textMuted }]} numberOfLines={1}>$ {e.command}</Text> : null}
          {e.password ? (
            <View style={[s.rowStart, { gap: 5 }]}>
              <Lock size={11} color={tokens.warning} />
              <Text style={[s.mono, { color: tokens.textMuted }]} numberOfLines={1}>password: {e.password}</Text>
            </View>
          ) : null}
          {e.passphrase ? (
            <View style={[s.rowStart, { gap: 5 }]}>
              <Lock size={11} color={tokens.warning} />
              <Text style={[s.mono, { color: tokens.textMuted }]} numberOfLines={1}>passphrase: {e.passphrase}</Text>
            </View>
          ) : null}
          {e.privateKey ? (
            <Pressable onPress={() => setShowKey((v) => !v)} style={[s.rowStart, { gap: 5 }]}>
              <Key size={11} color={EMERALD} />
              <Text style={{ fontSize: 11, color: tokens.textMuted }}>private key</Text>
            </Pressable>
          ) : null}
          {e.privateKey && showKey ? (
            <Text style={[s.mono, { color: tokens.textMuted, fontSize: 9 }]}>{e.privateKey}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[s.rowStart, { gap: 6 }]}>
        <View style={[s.badge, { backgroundColor: tokens.bgInput }]}>
          <Text style={[s.badgeText, { color: tokens.textMuted }]}>{e.provider}</Text>
        </View>
        {e.username || e.userId ? (
          <Text style={{ fontSize: 10, color: tokens.textMuted }}>{at.byUser} {e.username || e.userId}</Text>
        ) : null}
      </View>
      {e.outputPreview ? (
        <Text style={[s.mono, { color: tokens.textMuted, fontSize: 10 }]} numberOfLines={2}>{e.outputPreview}</Text>
      ) : null}
    </View>
  );
}

function ProviderPill({ label, icon, active, onPress, tokens }: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onPress: () => void;
  tokens: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1,
        borderColor: active ? tokens.brand : tokens.border,
        backgroundColor: active ? tokens.brand : tokens.bgCardSolid,
      }}
    >
      {icon}
      <Text style={{ fontSize: 12.5, fontWeight: "700", color: active ? "#ffffff" : tokens.textSecondary, textTransform: "capitalize" }}>{label}</Text>
    </Pressable>
  );
}

export default AccessSubTab;
