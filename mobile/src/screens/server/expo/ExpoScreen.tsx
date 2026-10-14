import { nativeText } from '../../../i18n/native-text';
import { FormDrawer } from "../../../components/ui/FormDrawer";
import { RelatedModuleSettings } from "../../../components/server/RelatedModuleSettings";
import { ModuleGrid } from "../../../components/server/ModuleLayouts";
import { NativeOperationCard } from "../NativeOperationCard";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
/**
 * ExpoScreen — réplica nativa del módulo Expo (EAS builds) de LUXIPANEL
 * (`frontend/src/pages/panel/expo/index.astro`). Tabs Configuración / Proyectos
 * / Builds: estado y guardado del Access Token, lista de proyectos detectados en
 * el servidor (al elegir uno alimenta Builds) e historial de builds con diálogo
 * para lanzar uno nuevo. Datos por el gateway (`serverExpoApi`); mutaciones con
 * la cola write-behind (`runServerMutation`).
 */
import { ScrollView } from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ModuleSettingsDrawer, SettingsColumns } from "../../../components/ui/ModuleSettingsDrawer";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { ServerDataTable, type ServerColumn, type ServerRowAction } from "../../../components/server/ServerDataTable";
import { ConfirmDialog, Field, InfoBox, DialogFooter, Checkbox } from "../../../components/server/Form";
import { pillColors, type PillKind } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Button } from "../../../components/ui/Button";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import {
  TablerSettings,
  TablerBrandReactNative,
  TablerRocket,
  TablerDeviceFloppy,
  TablerTrash,
  TablerEdit,
  TablerPlus,
  TablerKey,
  TablerUpload,
  TablerPlayerPlay,
} from "../../../features/app/tabler-icons";
import { serverExpoApi, unwrap, callServerApi } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";

import { IconCloudUpload, IconDeviceMobile, IconShieldLock, IconWebhook } from "./expo-icons";
import { BuildDialog, EnvDialog, SubmitDialog, OtaDialog, DevClientDialog, GoogleCredDialog, AppleCredDialog, WebhookDialog, DeviceDialog } from "./expo-dialogs";
import {
  type ExpoBuild,
  type ExpoConfig,
  type ExpoEnvVar,
  type ExpoProject,
  type ExpoStoreCredentials,
  GUARDS,
  envDisplayValue,
  fmtDate,
  hasToken,
  statusKind,
  tokenPreview,
  visibilityKind,
} from "./expo-types";

export function ExpoScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverExpo;

  const [tab, setTab] = useWorkspaceModuleTab<string>("projects");
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => { if (tab === "config") { setSettingsOpen(true); setTab("projects"); } }, [tab, setTab]);
  const [config, setConfig] = useState<ExpoConfig>({});
  const [projects, setProjects] = useState<ExpoProject[]>([]);
  const [builds, setBuilds] = useState<ExpoBuild[]>([]);
  const [selected, setSelected] = useState<ExpoProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<ExpoBuild | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  // Ciclo de vida del build: subir a tienda, OTA y dev-client (todos sobre el
  // proyecto seleccionado en el tab Builds).
  const [submitOpen, setSubmitOpen] = useState(false);
  const [otaOpen, setOtaOpen] = useState(false);
  const [devClientOpen, setDevClientOpen] = useState(false);

  // Avanzado · Credenciales (de tienda, webhooks, dispositivos) — sobre el
  // proyecto seleccionado.
  const [storeCreds, setStoreCreds] = useState<ExpoStoreCredentials | null>(null);
  const [storeCredsLoading, setStoreCredsLoading] = useState(false);
  const [storeCredsError, setStoreCredsError] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [appleOpen, setAppleOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);

  const [envVars, setEnvVars] = useState<ExpoEnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envDialog, setEnvDialog] = useState<{ mode: "create" | "edit"; row?: ExpoEnvVar } | null>(null);
  const [confirmDelEnv, setConfirmDelEnv] = useState<ExpoEnvVar | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({
    visible: false,
    variant: "success",
    message: "",
    nonce: 0,
  });
  const showToast = useCallback(
    (message: string, err = false) =>
      setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })),
    [],
  );

  const load = useCallback(async () => {
    const [cfgRes, projRes] = await Promise.all([
      serverExpoApi.getConfig(panelId, token),
      serverExpoApi.projects(panelId, token),
    ]);
    if (cfgRes.code && GUARDS.includes(cfgRes.code)) {
      setGuardCode(cfgRes.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setConfig(unwrap<ExpoConfig>(cfgRes) ?? {});
    setProjects(unwrap<ExpoProject[]>(projRes) ?? []);
  }, [panelId, token]);

  const loadBuilds = useCallback(
    async (path: string) => {
      if (!path) {
        setBuilds([]);
        return;
      }
      setBuildsLoading(true);
      const res = await serverExpoApi.buildList(panelId, token, { path });
      setBuildsLoading(false);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      setBuilds(unwrap<ExpoBuild[]>(res) ?? []);
    },
    [panelId, token],
  );

  const loadEnv = useCallback(
    async (project: ExpoProject) => {
      setEnvLoading(true);
      const res = await serverExpoApi.envList(panelId, token, {
        path: project.path,
        ...(project.projectId ? { projectId: project.projectId } : {}),
      });
      setEnvLoading(false);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      setEnvVars(unwrap<ExpoEnvVar[]>(res) ?? []);
    },
    [panelId, token],
  );

  // Estado de credenciales de tienda: endpoint que DEVUELVE datos → callServerApi
  // directo + unwrap (no es una mutación).
  const loadStoreCreds = useCallback(
    async (project: ExpoProject) => {
      setStoreCredsLoading(true);
      setStoreCredsError(false);
      const res = await callServerApi(panelId, token, "POST", "/api/expo/store-credentials", {
        path: project.path,
        ...(project.projectId ? { projectId: project.projectId } : {}),
      });
      setStoreCredsLoading(false);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      if (!res.ok) {
        setStoreCredsError(true);
        return;
      }
      setStoreCreds(unwrap<ExpoStoreCredentials>(res) ?? null);
    },
    [panelId, token],
  );

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (selected) void loadBuilds(selected.path);
    else setBuilds([]);
  }, [selected, loadBuilds]);

  // Cargar variables sólo cuando se entra al tab (evita una llamada por proyecto seleccionado).
  useEffect(() => {
    if (selected) void loadEnv(selected);
    else setEnvVars([]);
  }, [tab, selected, loadEnv]);

  // Igual para credenciales: sólo al entrar al tab.
  useEffect(() => {
    if (selected) void loadStoreCreds(selected);
    else setStoreCreds(null);
  }, [tab, selected, loadStoreCreds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (selected) await loadBuilds(selected.path);
    if (tab === "env" && selected) await loadEnv(selected);
    if (tab === "credentials" && selected) await loadStoreCreds(selected);
    setRefreshing(false);
  }, [load, loadBuilds, loadEnv, loadStoreCreds, selected, tab]);

  // ── Configuración ────────────────────────────────────────────────────────────
  const saveToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    const out = await runServerMutation(panelId, token, () => serverExpoApi.setConfig(panelId, token, { token: tokenInput.trim() }));
    setSavingToken(false);
    if (out.ok) {
      setTokenInput("");
      showToast(t.toasts.saved);
      void load();
    } else showToast(out.error ?? t.toasts.error, true);
  }, [tokenInput, panelId, token, showToast, load, t.toasts]);

  const clearToken = useCallback(async () => {
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => serverExpoApi.deleteConfig(panelId, token));
    if (out.ok) {
      showToast(t.toasts.cleared);
      void load();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmClear(false);
    } finally { setConfirmBusy(false); }
  }, [panelId, token, showToast, load, t.toasts]);

  // ── Builds ─────────────────────────────────────────────────────────────────
  const cancelBuild = useCallback(async () => {
    if (!confirmCancel || !selected) {
        return;
    }
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => serverExpoApi.buildCancel(panelId, token, { path: selected.path, buildId: confirmCancel.id }));
    if (out.ok) {
      showToast(t.toasts.cancelled);
      void loadBuilds(selected.path);
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmCancel(null);
    } finally { setConfirmBusy(false); }
  }, [confirmCancel, selected, panelId, token, showToast, loadBuilds, t.toasts]);

  // ── Variables de entorno ─────────────────────────────────────────────────────
  const deleteEnv = useCallback(async () => {
    if (!confirmDelEnv || !selected || !confirmDelEnv.id) {
        return;
    }
    const project = selected;
    const id = confirmDelEnv.id;
    setConfirmBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () =>
      serverExpoApi.envDelete(panelId, token, {
        path: project.path,
        ...(project.projectId ? { projectId: project.projectId } : {}),
        id,
      }),
    );
    if (out.ok) {
      showToast(t.env.deleted);
      void loadEnv(project);
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDelEnv(null);
    } finally { setConfirmBusy(false); }
  }, [confirmDelEnv, selected, panelId, token, showToast, loadEnv, t.env, t.toasts]);

  // ── Pill helper ──────────────────────────────────────────────────────────────
  const Pill = ({ label, kind }: { label: string; kind: PillKind }) => {
    const c = pillColors(tokens, kind);
    return (
      <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11, fontWeight: "500" }}>{label}</Text>
      </View>
    );
  };

  // ── Tarjeta de credenciales de tienda (Google / Apple) ───────────────────────
  const StoreCredCard = ({ title, badges, rows }: { title: string; badges: { label: string; kind: PillKind }[]; rows: { label: string; value: string }[] }) => (
    <View style={{ borderWidth: 1, borderColor: tokens.border, borderRadius: 10, padding: 12, gap: 8 }}>
      <Text style={{ color: tokens.textPrimary, fontSize: 13, fontWeight: "600" }}>{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {badges.map((b, i) => (
          <Pill key={i} label={b.label} kind={b.kind} />
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 2 }}>
          <Text style={{ color: tokens.textMuted, fontSize: 11 }}>{r.label}</Text>
          <Text selectable style={{ color: tokens.textSecondary, fontSize: 12 }}>
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );

  // ── Columnas ─────────────────────────────────────────────────────────────────
  const projectColumns: ServerColumn<ExpoProject>[] = useMemo(
    () => [
      { id: "app", header: t.projects.colApp, cell: (p) => p.name ?? p.slug ?? "—", sortable: true, sortValue: (p) => p.name ?? "", width: 150 },
      { id: "path", header: t.projects.colPath, cell: (p) => p.path, width: 220 },
      { id: "projectId", header: t.projects.colProjectId, cell: (p) => p.projectId ?? "—", width: 200 },
      {
        id: "status",
        header: t.projects.colStatus,
        cell: (p) => <Pill label={p.projectId ? t.projects.linked : t.projects.unlinked} kind={p.projectId ? "ok" : "neutral"} />,
        width: 120,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );

  const buildColumns: ServerColumn<ExpoBuild>[] = useMemo(
    () => [
      { id: "id", header: t.builds.colId, cell: (b) => b.id.slice(0, 8), width: 110 },
      { id: "status", header: t.builds.colStatus, cell: (b) => <Pill label={b.status ?? "—"} kind={statusKind(b.status)} />, width: 130 },
      { id: "platform", header: t.builds.colPlatform, cell: (b) => b.platform ?? "—", width: 110 },
      { id: "profile", header: t.builds.colProfile, cell: (b) => b.profile ?? "—", width: 120 },
      { id: "date", header: t.builds.colDate, cell: (b) => fmtDate(b.createdAt), sortable: true, sortValue: (b) => b.createdAt ?? "", width: 150 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );

  const projectRowActions: ServerRowAction[] = useMemo(
    () => [{ id: "use", label: t.projects.use, icon: <TablerRocket size={18} /> }],
    [t],
  );
  const buildRowActions: ServerRowAction[] = useMemo(
    () => [{ id: "cancel", label: t.builds.cancel, icon: <TablerTrash size={18} />, danger: true }],
    [t],
  );

  const envColumns: ServerColumn<ExpoEnvVar>[] = useMemo(
    () => [
      { id: "name", header: t.env.colName, cell: (v) => v.name, sortable: true, sortValue: (v) => v.name, width: 180 },
      { id: "value", header: t.env.colValue, cell: (v) => envDisplayValue(v), width: 160 },
      { id: "scope", header: t.env.colScope, cell: (v) => v.scope ?? "—", sortable: true, sortValue: (v) => v.scope ?? "", width: 110 },
      { id: "visibility", header: t.env.colVisibility, cell: (v) => <Pill label={v.visibility ?? "—"} kind={visibilityKind(v.visibility)} />, width: 130 },
      { id: "environments", header: t.env.colEnvironments, cell: (v) => (v.environments ?? []).join(", ") || "—", width: 170 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tokens],
  );
  const envRowActions: ServerRowAction[] = useMemo(
    () => [
      { id: "edit", label: t.env.edit, icon: <TablerEdit size={18} /> },
      { id: "delete", label: t.env.delete, icon: <TablerTrash size={18} />, danger: true },
    ],
    [t],
  );

  // Badges + filas de las tarjetas de credenciales, derivadas del estado del panel.
  const credCards = useMemo(() => {
    if (!storeCreds) return null;
    const g = storeCreds.google ?? {};
    const gKeys = g.cloudKeys ?? [];
    const gBadges: { label: string; kind: PillKind }[] = [];
    if (gKeys.length) gBadges.push({ label: formatMessage(t.credentials.cloudKeys, { n: gKeys.length }), kind: "ok" });
    if (g.projectFile) gBadges.push({ label: t.credentials.projectFileLabel, kind: "sky" });
    if (g.localFile) gBadges.push({ label: t.credentials.localStaged, kind: "amber" });
    if (!gBadges.length) gBadges.push({ label: t.credentials.none, kind: "neutral" });
    const gRows: { label: string; value: string }[] = [];
    gKeys.forEach((k) => {
      if (k.clientEmail) gRows.push({ label: t.credentials.clientEmail, value: k.clientEmail });
    });
    if (g.projectFile?.path) gRows.push({ label: t.credentials.pathLabel, value: g.projectFile.path });
    if (g.projectFile?.clientEmail) gRows.push({ label: t.credentials.clientEmail, value: g.projectFile.clientEmail });

    const a = storeCreds.apple ?? {};
    const aKeys = a.cloudKeys ?? [];
    const aBadges: { label: string; kind: PillKind }[] = [];
    if (aKeys.length) aBadges.push({ label: formatMessage(t.credentials.cloudKeys, { n: aKeys.length }), kind: "ok" });
    if (a.projectFile) aBadges.push({ label: t.credentials.projectFileLabel, kind: "sky" });
    if (a.localFile) aBadges.push({ label: t.credentials.localStaged, kind: "amber" });
    if (!aBadges.length) aBadges.push({ label: t.credentials.none, kind: "neutral" });
    const aRows: { label: string; value: string }[] = [];
    aKeys.forEach((k) => {
      if (k.name) aRows.push({ label: t.credentials.nameLabel, value: k.name });
      if (k.keyIdentifier) aRows.push({ label: t.credentials.keyIdLabel, value: k.keyIdentifier });
      if (k.issuerIdentifier) aRows.push({ label: t.credentials.issuerIdLabel, value: k.issuerIdentifier });
    });
    if (a.projectFile?.path) aRows.push({ label: t.credentials.pathLabel, value: a.projectFile.path });
    if (a.projectFile?.keyId) aRows.push({ label: t.credentials.keyIdLabel, value: a.projectFile.keyId });
    if (a.projectFile?.issuerId) aRows.push({ label: t.credentials.issuerIdLabel, value: a.projectFile.issuerId });

    return {
      google: { title: t.credentials.googleTitle, badges: gBadges, rows: gRows },
      apple: { title: t.credentials.appleTitle, badges: aBadges, rows: aRows },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeCreds, t]);

  const tabs = [

    { key: "projects", label: t.tabs.projects, icon: <TablerBrandReactNative size={16} /> },
    { key: "builds", label: t.tabs.builds, icon: <TablerRocket size={16} /> },
    { key: "env", label: t.tabs.env, icon: <TablerKey size={16} /> },
    { key: "credentials", label: t.tabs.credentials, icon: <IconShieldLock size={16} /> },
  ];

  const action =
    tab === "builds" && selected
      ? { label: t.newBuild, icon: <TablerRocket size={16} />, onPress: () => setBuildOpen(true) }
      : tab === "env" && selected
        ? { label: t.env.new, icon: <TablerPlus size={16} />, onPress: () => setEnvDialog({ mode: "create" }) }
        : null;

  const tokenSet = hasToken(config);

  return (
    <>
      <ServerModuleScreen
        settingsPages={[{key:"related",get label() { return nativeText("Relacionados"); },content:<RelatedModuleSettings modules={["files","assistant","repository-store"]}/>}]}
        title={t.pageTitle}
        subtitle={t.subtitle}
        onBack={onBack}
        action={selected ? {label:t.newBuild,onPress:()=>setBuildOpen(true)} : null}
        guardCode={guardCode}
        onRetry={onRefresh}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <ModuleGrid columns={3} breakpoint={1024}>
          <View style={{gap:12,padding:14,borderWidth:1,borderColor:tokens.border,borderRadius:12}}><Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{nativeText("Cuenta Expo")}</Text><Text style={{color:tokens.textSecondary}}>{tokenSet?t.config.tokenSet:t.config.tokenMissing}</Text><Button label={t.config.title} variant="secondary" onPress={()=>setSettingsOpen(true)}/><NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Cuenta")} readPath="/api/expo/account"/></View>
          <View style={{gap:12,padding:14,borderWidth:1,borderColor:tokens.border,borderRadius:12}}><Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{nativeText("Cuota de compilación")}</Text><NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Cuota")} path="/api/expo/quota" method="POST" toBody={()=>selected?{path:selected.path}:{}} actionLabel={nativeText("Actualizar cuota")}/></View>
          <View style={{gap:12,padding:14,borderWidth:1,borderColor:tokens.border,borderRadius:12}}><Text style={{color:tokens.textPrimary,fontWeight:"700"}}>{nativeText("Proyecto seleccionado")}</Text><Text style={{color:tokens.textSecondary}}>{selected?.name ?? selected?.path ?? t.builds.noProject}</Text><Button label={t.newBuild} disabled={!selected} onPress={()=>setBuildOpen(true)}/><Button label={t.lifecycle.devClient} variant="secondary" disabled={!selected} onPress={()=>setDevClientOpen(true)}/></View>
        </ModuleGrid>

          <ServerDataTable
            title={t.projects.title}
            columns={projectColumns}
            rows={projects}
            rowKey={(p) => p.path}
            rowActions={projectRowActions}
            loading={loading}
            onRowAction={(id, row) => {
              if (id === "use") {
                setSelected(row);

              }
            }}
            onRowPress={(row) => {
              setSelected(row);

            }}
          />

          <View style={{ gap: 12 }}>
            {selected ? (
              <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
                {formatMessage(t.builds.selectedProject, { name: selected.name ?? selected.path })}
              </Text>
            ) : (
              <InfoBox tone="info">{t.builds.noProject}</InfoBox>
            )}
            {selected ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button
                  label={t.lifecycle.submit}
                  variant="secondary"
                  size="sm"
                  icon={<TablerUpload size={16} />}
                  onPress={() => setSubmitOpen(true)}
                />
                <Button
                  label={t.lifecycle.ota}
                  variant="secondary"
                  size="sm"
                  icon={<IconCloudUpload size={16} />}
                  onPress={() => setOtaOpen(true)}
                />
                <Button
                  label={t.lifecycle.devClient}
                  variant="secondary"
                  size="sm"
                  icon={<IconDeviceMobile size={16} />}
                  onPress={() => setDevClientOpen(true)}
                />
              </View>
            ) : null}
              <ServerDataTable
                settingsId="builds" title={t.builds.title}
                columns={buildColumns}
                rows={builds}
                rowKey={(b) => b.id}
                rowActions={buildRowActions}
                loading={buildsLoading}
                onRowAction={(id, row) => {
                  if (id === "cancel") setConfirmCancel(row);
                }}
              />

          </View>
        <ModuleGrid columns={2} breakpoint={1024}>
          <View style={{ gap: 12 }}>
            {!selected ? (
              <InfoBox tone="info">{t.credentials.noProject}</InfoBox>
            ) : (
              <>
                <Text style={{ color: tokens.textSecondary, fontSize: 13 }}>
                  {formatMessage(t.builds.selectedProject, { name: selected.name ?? selected.path })}
                </Text>
                <InfoBox tone="info">{t.credentials.intro}</InfoBox>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button label={t.credentials.setGoogle} variant="secondary" size="sm" icon={<TablerUpload size={16} />} onPress={() => setGoogleOpen(true)} />
                  <Button label={t.credentials.setApple} variant="secondary" size="sm" icon={<TablerUpload size={16} />} onPress={() => setAppleOpen(true)} />
                  <Button label={t.credentials.webhookBtn} variant="secondary" size="sm" icon={<IconWebhook size={16} />} onPress={() => setWebhookOpen(true)} />
                  <Button label={t.credentials.deviceBtn} variant="secondary" size="sm" icon={<IconDeviceMobile size={16} />} onPress={() => setDeviceOpen(true)} />
                </View>
                <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.credentials.stateTitle}</Text>
                {storeCredsLoading ? (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <ActivityIndicator color={tokens.brand} />
                  </View>
                ) : storeCredsError ? (
                  <InfoBox tone="danger">{t.credentials.loadError}</InfoBox>
                ) : null}

              </>
            )}
            <ServerDataTable settingsId="stores" title={nativeText("Cuentas de tiendas")} rows={selected && credCards ? [{id:"google",...credCards.google},{id:"apple",...credCards.apple}] : []} rowKey={row=>row.id} columns={[{id:"title",get header() { return nativeText("Tienda"); },cell:row=>row.title,width:180},{id:"state",get header() { return nativeText("Estado"); },cell:row=><StoreCredCard title={row.title} badges={row.badges} rows={row.rows}/>,width:300}]}/>
          </View>
          <View style={{gap:12}}><Button label={t.env.new} disabled={!selected} onPress={()=>setEnvDialog({mode:"create"})}/>{selected ? <>
              <ServerDataTable
                title={t.env.title}
                columns={envColumns}
                rows={envVars}
                rowKey={(v) => v.id || v.name}
                rowActions={envRowActions}
                loading={envLoading}
                onRowAction={(id, row) => {
                  // Sólo las variables respaldadas por GraphQL (con id) son editables/eliminables.
                  if (!row.id) {
                    showToast(t.env.readOnly, true);
                    return;
                  }
                  if (id === "edit") setEnvDialog({ mode: "edit", row });
                  else if (id === "delete") setConfirmDelEnv(row);
                }}
              /></> : <InfoBox tone="info">{t.env.noProject}</InfoBox>}</View>
        </ModuleGrid>
      </ServerModuleScreen>
      <FormDrawer visible={settingsOpen} onClose={()=>setSettingsOpen(false)} title={t.config.title} language={language}>          <View style={{ gap: 12 }}>
            <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.config.title}</Text>
            <InfoBox tone={tokenSet ? "info" : "warn"}>
              {tokenSet ? `${t.config.tokenSet}${tokenPreview(config) ? `  ·  ${tokenPreview(config)}` : ""}` : t.config.tokenMissing}
            </InfoBox>
            <Field label={tokenSet ? t.config.replaceLabel : t.config.tokenLabel} hint={t.config.tokenHint}>
              <Input
                value={tokenInput}
                onChangeText={setTokenInput}
                placeholder={t.config.tokenPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                secureToggle
              />
            </Field>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label={t.config.save} icon={<TablerDeviceFloppy size={16} />} onPress={saveToken} loading={savingToken} disabled={!tokenInput.trim()} />
              </View>
              {tokenSet ? (
                <View style={{ flex: 1 }}>
                  <Button label={t.config.clear} variant="danger" icon={<TablerTrash size={16} />} onPress={() => setConfirmClear(true)} />
                </View>
              ) : null}
            </View>
          </View>

</FormDrawer>

      {buildOpen && selected ? (
        <BuildDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setBuildOpen(false)}
          onLaunched={() => {
            setBuildOpen(false);
            showToast(t.toasts.launched);
            void loadBuilds(selected.path);
          }}
          onError={() => showToast(t.toasts.error, true)}
        />
      ) : null}

      {submitOpen && selected ? (
        <SubmitDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setSubmitOpen(false)}
          onSubmitted={() => {
            setSubmitOpen(false);
            showToast(t.submitDialog.submitted);
          }}
          onToast={showToast}
        />
      ) : null}

      {otaOpen && selected ? (
        <OtaDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setOtaOpen(false)}
          onPublished={() => {
            setOtaOpen(false);
            showToast(t.ota.published);
          }}
          onToast={showToast}
        />
      ) : null}

      {devClientOpen && selected ? (
        <DevClientDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setDevClientOpen(false)}
          onToast={showToast}
        />
      ) : null}

      {googleOpen && selected ? (
        <GoogleCredDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setGoogleOpen(false)}
          onSaved={() => {
            setGoogleOpen(false);
            showToast(t.credentials.google.saved);
            if (selected) void loadStoreCreds(selected);
          }}
          onToast={showToast}
        />
      ) : null}

      {appleOpen && selected ? (
        <AppleCredDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setAppleOpen(false)}
          onSaved={() => {
            setAppleOpen(false);
            showToast(t.credentials.apple.saved);
            if (selected) void loadStoreCreds(selected);
          }}
          onToast={showToast}
        />
      ) : null}

      {webhookOpen && selected ? (
        <WebhookDialog
          panelId={panelId}
          token={token}
          path={selected.path}
          onClose={() => setWebhookOpen(false)}
          onSaved={() => {
            setWebhookOpen(false);
            showToast(t.credentials.webhook.saved);
          }}
          onToast={showToast}
        />
      ) : null}

      {deviceOpen && selected ? (
        <DeviceDialog panelId={panelId} token={token} path={selected.path} onClose={() => setDeviceOpen(false)} onToast={showToast} />
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          visible
          title={t.config.clearTitle}
          message={t.config.clearMessage}
          confirmLabel={t.config.clearConfirm}
          cancelLabel={t.config.cancel}
          submitting={confirmBusy}
          onConfirm={clearToken}
          onCancel={() => setConfirmClear(false)}
        />
      ) : null}

      {confirmCancel ? (
        <ConfirmDialog
          visible
          title={t.builds.confirmCancelTitle}
          message={t.builds.confirmCancel}
          confirmLabel={t.builds.cancel}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={cancelBuild}
          onCancel={() => setConfirmCancel(null)}
        />
      ) : null}

      {envDialog && selected ? (
        <EnvDialog
          panelId={panelId}
          token={token}
          project={selected}
          mode={envDialog.mode}
          row={envDialog.row}
          onClose={() => setEnvDialog(null)}
          onSaved={(updated) => {
            setEnvDialog(null);
            showToast(updated ? t.env.updated : t.env.saved);
            if (selected) void loadEnv(selected);
          }}
          onToast={showToast}
        />
      ) : null}

      {confirmDelEnv ? (
        <ConfirmDialog
          visible
          title={t.env.confirmDeleteTitle}
          message={formatMessage(t.env.confirmDelete, { name: confirmDelEnv.name })}
          confirmLabel={t.env.delete}
          cancelLabel={t.confirm.cancel}
          submitting={confirmBusy}
          onConfirm={deleteEnv}
          onCancel={() => setConfirmDelEnv(null)}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

