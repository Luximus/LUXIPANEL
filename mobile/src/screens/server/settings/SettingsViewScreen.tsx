import { ModuleLoading } from "../../../components/server/ModuleLoading";
import { useWorkspaceModuleTab } from "../../main/use-workspace-module-tab";
/** SettingsViewScreen — réplica nativa de la vista Ajustes: General (editor
 *  clave/valor) + Seguridad (estado 2FA + passkeys) + Credenciales
 *  (tokens por módulo + almacenamiento de backups) + Sistema (info del servidor, herramientas y uso de datos SSH).
 *  Iconos, tipos/helpers, conectores y diálogos viven en archivos co-localizados
 *  (`settings-icons`, `settings-types`, `settings-connectors`, `settings-dialogs`). */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PanelText as Text } from "../../../components/ui/PanelText";
import { Image, Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "../../../hooks/useTheme";
import { getThemeTokens, withAlpha } from "../../../theme/colors";
import { getMessages, formatMessage } from "../../../i18n";
import { loadSessionState } from "../../../lib/session-state";
import { ServerModuleScreen } from "../../../components/server/ServerModuleScreen";
import { Field, InfoBox, ConfirmDialog } from "../../../components/server/Form";
import { pillColors } from "../../../components/server/badges";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Toast, type ToastVariant } from "../../../components/ui/Toast";
import {
  TablerShieldLock,
  TablerDeviceFloppy,
  TablerTrash,
  TablerRefresh,
  TablerServer,
  TablerCpu,
  TablerMail,
} from "../../../features/app/tabler-icons";
import { serverSettingsApi, serverModulesViewApi, unwrap, callServerApi, uploadServerFile, getDirect } from "../../../api/serverApi";
import { runServerMutation } from "../../../hooks/useServerApi";
import type { GatewayGuardCode } from "../../../api/serverApi";
import { TablerLifebuoy, TablerTicket, TablerSend, TablerPhoto, TablerPalette, TablerTag, TablerUpload } from "./settings-icons";
import { TOKEN_CONNECTORS, STORAGE_CONNECTORS } from "./settings-connectors";
import { TotpSetupDialog, TokenCredDialog, StorageCredDialog, AssignImageDialog } from "./settings-dialogs";
import {
  type ConnState,
  type ImageEntry,
  type KV,
  type StorageCred,
  type SysInfo,
  type Ticket,
  type TokenConnector,
  GUARDS,
  RESTART_SERVICES,
  fmtBytes,
  fmtDate,
  fmtUptime,
  flattenSettings,
  settingsRowsToKv,
  statusKind,
  statusLabel,
} from "./settings-types";

export function SettingsViewScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const t = getMessages(language).serverSettings;

  const [tab, setTab] = useWorkspaceModuleTab<string>("general");
  useEffect(() => { if (tab === "report") setTab("general"); }, [tab, setTab]);
  const [settings, setSettings] = useState<KV[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [twoFa, setTwoFa] = useState<{ enabled?: boolean }>({});
  const [passkeys, setPasskeys] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [setupOpen, setSetupOpen] = useState<{ secret?: string } | null>(null);

  // ── Credenciales ──
  const [credLoaded, setCredLoaded] = useState(false);
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null);
  const [connState, setConnState] = useState<Record<string, ConnState>>({});
  const [storageCreds, setStorageCreds] = useState<Record<string, StorageCred>>({});
  const [tokenDialog, setTokenDialog] = useState<TokenConnector | null>(null);
  const [storageDialog, setStorageDialog] = useState<{ provider: string; label: string } | null>(null);
  const [confirmDelCred, setConfirmDelCred] = useState<{ del: string; name: string } | null>(null);
  const [credDelBusy, setCredDelBusy] = useState(false);


  // ── Sistema ──
  const [sysLoaded, setSysLoaded] = useState(false);
  const [sysInfo, setSysInfo] = useState<SysInfo | null>(null);
  const [restartService, setRestartService] = useState(RESTART_SERVICES[0]);
  const [confirmTool, setConfirmTool] = useState<{ kind: "restart" | "rebuild" } | null>(null);
  const [toolBusy, setToolBusy] = useState(false);

  // ── Apariencia ──
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const [appearanceLoading, setAppearanceLoading] = useState(false);
  const [identityRows, setIdentityRows] = useState<KV[]>([]);
  const [layoutSettings, setLayoutSettings] = useState<KV[]>([]);
  const [layoutEdited, setLayoutEdited] = useState<Record<string, string>>({});
  const [brandingImages, setBrandingImages] = useState<ImageEntry[]>([]);
  const [imagesError, setImagesError] = useState(false);
  const [assignImage, setAssignImage] = useState<{ url: string; name: string } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [toast, setToast] = useState<{ visible: boolean; variant: ToastVariant; message: string; nonce: number }>({ visible: false, variant: "success", message: "", nonce: 0 });
  const showToast = useCallback((message: string, err = false) => setToast((p) => ({ visible: true, variant: err ? "error" : "success", message, nonce: p.nonce + 1 })), []);

  const load = useCallback(async () => {
    const [s, tf, pk, rc] = await Promise.all([
      serverSettingsApi.getAll(panelId, token),
      serverSettingsApi.totpStatus(panelId, token),
      serverSettingsApi.listPasskeys(panelId, token),
      serverSettingsApi.recoveryStatus(panelId, token),
    ]);
    if (s.code && GUARDS.includes(s.code)) {
      setGuardCode(s.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setSettings(flattenSettings(unwrap(s)));
    setEdited({});
    setTwoFa(unwrap<{ enabled?: boolean }>(tf) ?? {});
    const pkList = unwrap<unknown[]>(pk);
    setPasskeys(Array.isArray(pkList) ? pkList.length : null);
    const rcData = unwrap<{ configured?: boolean; generated?: boolean }>(rc);
    setRecovery(rcData ? !!(rcData.configured ?? rcData.generated) : null);

  }, [panelId, token]);

  const loadCreds = useCallback(async () => {
    const inst = await serverModulesViewApi.installed(panelId, token);
    const list = unwrap<{ id?: string; enabled?: boolean }[]>(inst);
    const enabled = new Set((Array.isArray(list) ? list : []).filter((m) => m && m.enabled !== false && m.id).map((m) => m.id as string));
    setEnabledModules(enabled);

    const visibleTokens = TOKEN_CONNECTORS.filter((c) => !c.gate || enabled.has(c.gate));
    const states: Record<string, ConnState> = {};
    await Promise.all(
      visibleTokens.map(async (c) => {
        const res = await callServerApi(panelId, token, "GET", c.base);
        const data = unwrap<Record<string, unknown>>(res) ?? {};
        states[c.id] = {
          configured: Boolean(data[c.setField]),
          preview: c.previewField && typeof data[c.previewField] === "string" ? (data[c.previewField] as string) : undefined,
        };
      }),
    );
    setConnState(states);

    if (enabled.has("backups")) {
      const res = await callServerApi(panelId, token, "GET", "/api/backups/provider-creds");
      const arr = unwrap<StorageCred[]>(res);
      const map: Record<string, StorageCred> = {};
      for (const sc of Array.isArray(arr) ? arr : []) if (sc?.provider) map[sc.provider] = sc;
      setStorageCreds(map);
    } else {
      setStorageCreds({});
    }
  }, [panelId, token]);

  const loadSystem = useCallback(async () => {
    const si = await callServerApi(panelId, token, "GET", "/api/admin/system/info");
    setSysInfo(unwrap<SysInfo>(si));
  }, [panelId, token]);

  const loadAppearance = useCallback(async () => {
    setAppearanceLoading(true);
    const [lay, gen, img] = await Promise.all([
      serverSettingsApi.getCategory(panelId, token, "layout"),
      serverSettingsApi.getCategory(panelId, token, "general"),
      callServerApi(panelId, token, "GET", "/api/admin/branding/images"),
    ]);
    setLayoutSettings(settingsRowsToKv(unwrap(lay)));
    const gRows = settingsRowsToKv(unwrap(gen));
    const find = (k: string) => gRows.find((r) => r.key === k)?.value ?? "";
    setIdentityRows([
      { key: "panel_name", value: find("panel_name") },
      { key: "site_name", value: find("site_name") },
    ]);
    const imgs = unwrap<ImageEntry[]>(img);
    setBrandingImages(Array.isArray(imgs) ? imgs : []);
    setImagesError(!img.ok && !Array.isArray(imgs));
    setLayoutEdited({});
    setAppearanceLoading(false);
  }, [panelId, token]);

  // Subida de logo/branding: elige una imagen del dispositivo y la sube como raw
  // (octet-stream) a POST /api/admin/branding/upload vía el gateway binario; al
  // terminar recarga la biblioteca de imágenes. Errores (tamaño/tipo/ruta) → toast.
  const uploadLogo = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });
      if (picked.canceled || !picked.assets?.[0]) return;
      const a = picked.assets[0];
      setUploadingLogo(true);
      const res = await uploadServerFile(panelId, token, "/api/admin/branding/upload", {
        uri: a.uri,
        name: a.name,
        type: a.mimeType ?? "application/octet-stream",
      });
      setUploadingLogo(false);
      if (res.ok) {
        showToast(t.appearance.uploadedToast);
        await loadAppearance();
      } else {
        const panelErr = res.data && typeof res.data === "object" && "error" in res.data ? String((res.data as { error?: unknown }).error ?? "") : "";
        showToast(panelErr || res.error || t.appearance.uploadError, true);
      }
    } catch {
      setUploadingLogo(false);
      showToast(t.appearance.uploadError, true);
    }
  }, [panelId, token, showToast, loadAppearance, t]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  // Carga perezosa de cada tab nuevo al abrirlo por primera vez.
  useEffect(() => {
    if (tab === "credentials" && !credLoaded) {
      setCredLoaded(true);
      void loadCreds();

    } else if (tab === "system" && !sysLoaded) {
      setSysLoaded(true);
      void loadSystem();
    } else if (tab === "appearance" && !appearanceLoaded) {
      setAppearanceLoaded(true);
      void loadAppearance();
    }
  }, [tab, credLoaded, sysLoaded, appearanceLoaded, loadCreds, loadSystem, loadAppearance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (tab === "credentials") await loadCreds();
    else if (tab === "system") await loadSystem();
    else if (tab === "appearance") await loadAppearance();
    setRefreshing(false);
  }, [load, tab, loadCreds, loadSystem, loadAppearance]);

  const saveKey = useCallback(
    async (key: string) => {
      const value = edited[key];
      if (value === undefined) return;
      const out = await runServerMutation(panelId, token, () => serverSettingsApi.set(panelId, token, { key, value }));
      if (out.ok) showToast(t.general.savedToast);
      else showToast(out.error ?? t.toasts.error, true);
    },
    [edited, panelId, token, showToast, t],
  );

  const saveAppearanceKey = useCallback(
    async (key: string, category: string) => {
      const value = layoutEdited[key];
      if (value === undefined) return;
      const out = await runServerMutation(panelId, token, () => serverSettingsApi.set(panelId, token, { key, value, category }));
      if (out.ok) {
        showToast(t.appearance.savedToast);
        setLayoutEdited((e) => {
          const n = { ...e };
          delete n[key];
          return n;
        });
        if (category === "general") setIdentityRows((rows) => rows.map((r) => (r.key === key ? { ...r, value } : r)));
        else setLayoutSettings((rows) => rows.map((r) => (r.key === key ? { ...r, value } : r)));
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [layoutEdited, panelId, token, showToast, t],
  );

  const openSetup = useCallback(async () => {
    const res = await serverSettingsApi.totpSetup(panelId, token);
    const data = unwrap<{ secret?: string; otpauthUrl?: string }>(res);
    setSetupOpen({ secret: data?.secret });
  }, [panelId, token]);

  const testConnector = useCallback(
    async (c: TokenConnector) => {
      if (!c.test) return;
      const res = await callServerApi(panelId, token, "POST", c.test);
      const data = unwrap<{ ok?: boolean; valid?: boolean; message?: string }>(res);
      const ok = Boolean(data?.ok ?? data?.valid);
      showToast(ok ? t.credentials.testOk : data?.message ?? t.credentials.testFail, !ok);
    },
    [panelId, token, showToast, t],
  );

  const doDeleteCred = useCallback(async () => {
    if (!confirmDelCred) return;
    setCredDelBusy(true);
    try {
    const out = await runServerMutation(panelId, token, () => callServerApi(panelId, token, "DELETE", confirmDelCred.del));
    if (out.ok) {
      showToast(t.credentials.clearedToast);
      void loadCreds();
    } else throw new Error(out.error ?? t.toasts.error);
    setConfirmDelCred(null);
    } finally { setCredDelBusy(false); }
  }, [confirmDelCred, panelId, token, showToast, loadCreds, t]);

  const runTool = useCallback(async () => {
    if (!confirmTool) return;
    setToolBusy(true);
    try {
    const op =
      confirmTool.kind === "restart"
        ? () => callServerApi(panelId, token, "POST", "/api/admin/tools/restart-service", { service: restartService })
        : () => callServerApi(panelId, token, "POST", "/api/admin/tools/rebuild-maps");
    const out = await runServerMutation(panelId, token, op);
    if (out.ok) showToast(confirmTool.kind === "restart" ? t.system.restartedToast : t.system.rebuiltToast);
    else throw new Error(out.error ?? t.toasts.error);
    setConfirmTool(null);
    } finally { setToolBusy(false); }
  }, [confirmTool, panelId, token, restartService, showToast, t]);

  const tabs = [
    { key: "general", label: t.tabs.general },
    { key: "appearance", label: t.tabs.appearance },
    { key: "security", label: t.tabs.security },
    { key: "credentials", label: t.tabs.credentials },
    { key: "system", label: t.tabs.system },
  ];

  const settingsView = useMemo(() => settings, [settings]);

  const statusBadge = (on?: boolean) => {
    const c = pillColors(tokens, on ? "ok" : "neutral");
    return (
      <View style={{ borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.bg, borderColor: c.border }}>
        <Text style={{ color: c.text, fontSize: 11 }}>{on ? t.credentials.configured : t.credentials.notConfigured}</Text>
      </View>
    );
  };

  const visibleTokenConnectors = TOKEN_CONNECTORS.filter((c) => !c.gate || enabledModules === null || enabledModules.has(c.gate));
  const showStorage = enabledModules === null || enabledModules.has("backups");

  const card = { borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 14, gap: 12 } as const;

  // Fila clave/valor editable reutilizada por Identidad (general) y Diseño (layout).
  const kvRow = (kv: KV, category: string, labelOverride?: string) => (
    <View key={kv.key} style={{ borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 12, gap: 6 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "600" }}>{labelOverride ?? kv.key}</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Input value={layoutEdited[kv.key] ?? kv.value} onChangeText={(v) => setLayoutEdited((e) => ({ ...e, [kv.key]: v }))} autoCapitalize="none" autoCorrect={false} />
        </View>
        <Button label={t.appearance.save} size="sm" variant="secondary" disabled={layoutEdited[kv.key] === undefined} onPress={() => saveAppearanceKey(kv.key, category)} />
      </View>
    </View>
  );

  return (
    <>
      <ServerModuleScreen title={t.pageTitle} subtitle={t.subtitle} onBack={onBack} tabs={tabs} activeTab={tab} onTabChange={setTab} guardCode={guardCode} onRetry={onRefresh} refreshing={refreshing} onRefresh={onRefresh}>
        {tab === "general" ? (
          loading ? null : settingsView.length === 0 ? (
            <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>{t.general.empty}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {settingsView.map((kv) => (
                <View key={kv.key} style={{ borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 12, gap: 6 }}>
                  <Text style={{ color: tokens.textMuted, fontSize: 11, fontWeight: "600" }}>{kv.key}</Text>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Input value={edited[kv.key] ?? kv.value} onChangeText={(v) => setEdited((e) => ({ ...e, [kv.key]: v }))} autoCapitalize="none" />
                    </View>
                    <Button label={t.general.save} size="sm" variant="secondary" disabled={edited[kv.key] === undefined} onPress={() => saveKey(kv.key)} />
                  </View>
                </View>
              ))}
            </View>
          )
        ) : tab === "appearance" ? (
          <View style={{ gap: 12 }}>
            {/* Identidad del panel (panel_name / site_name → general) */}
            <View style={card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TablerTag size={18} color={tokens.textSecondary} />
                <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.appearance.identityTitle}</Text>
              </View>
              {identityRows.map((r) => kvRow(r, "general", r.key === "panel_name" ? t.appearance.panelNameLabel : t.appearance.siteNameLabel))}
            </View>

            {/* Editor de claves de diseño (layout_*) */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <TablerPalette size={18} color={tokens.textSecondary} />
              <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.appearance.layoutTitle}</Text>
            </View>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.appearance.layoutHint}</Text>
            {appearanceLoading && layoutSettings.length === 0 ? (
              <ModuleLoading label={t.report.loading} />
            ) : layoutSettings.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>{t.appearance.empty}</Text>
            ) : (
              <View style={{ gap: 8 }}>{layoutSettings.map((kv) => kvRow(kv, "layout"))}</View>
            )}

            {/* Biblioteca de imágenes (listar + seleccionar para asignar a un logo/favicon) */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <TablerPhoto size={18} color={tokens.textSecondary} />
              <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.appearance.imagesTitle}</Text>
            </View>
            <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.appearance.imagesHint}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Button label={t.appearance.uploadBtn} size="sm" variant="secondary" icon={<TablerUpload size={15} />} onPress={uploadLogo} loading={uploadingLogo} />
            </View>
            <InfoBox tone="info">{t.appearance.uploadInfo}</InfoBox>
            {imagesError ? (
              <Text style={{ color: tokens.danger, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>{t.appearance.imagesError}</Text>
            ) : brandingImages.length === 0 ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 16 }}>{t.appearance.imagesEmpty}</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {brandingImages.map((img) => (
                  <Pressable key={img.url} onPress={() => setAssignImage({ url: img.url, name: img.name })} style={{ width: "47%", borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 10, gap: 6 }}>
                    <View style={{ height: 64, borderRadius: 8, backgroundColor: withAlpha(tokens.textMuted, 0.08), alignItems: "center", justifyContent: "center" }}>
                      <Image source={{uri: `${getDirect(panelId)?.baseUrl ?? ""}${img.previewUrl ?? img.url}`, headers: {Authorization: `Bearer ${getDirect(panelId)?.jwt ?? ""}`, ...(getDirect(panelId)?.bridgeSessionId ? {"X-Bridge-Session-Id":getDirect(panelId)!.bridgeSessionId!} : {})}}} resizeMode="contain" style={{width:"100%",height:64}} accessibilityLabel={img.name} />
                    </View>
                    <Text numberOfLines={1} style={{ color: tokens.textPrimary, fontSize: 12, fontWeight: "600" }}>{img.name}</Text>
                    <Text numberOfLines={1} style={{ color: tokens.textMuted, fontSize: 10, fontFamily: "monospace" }}>{img.url}</Text>
                    {img.size != null ? <Text style={{ color: tokens.textMuted, fontSize: 10 }}>{fmtBytes(img.size)}</Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : tab === "security" ? (
          <View style={{ gap: 12 }}>
            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TablerShieldLock size={18} color={twoFa.enabled ? tokens.success : tokens.textMuted} />
                <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700", flex: 1 }}>{t.security.twoFaTitle}</Text>
                <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: withAlpha(twoFa.enabled ? tokens.success : tokens.textMuted, 0.12) }}>
                  <Text style={{ color: twoFa.enabled ? tokens.success : tokens.textMuted, fontSize: 11 }}>{twoFa.enabled ? t.security.twoFaEnabled : t.security.twoFaDisabled}</Text>
                </View>
              </View>
              {!twoFa.enabled ? <Button label={t.security.setup} onPress={openSetup} /> : null}
            </View>

            <Row label={t.security.passkeysLabel} value={passkeys != null ? formatMessage(t.security.count, { count: passkeys }) : t.security.notConfigured} tokens={tokens} />
            <Row label={t.security.recoveryLabel} value={recovery ? t.security.configured : t.security.notConfigured} tokens={tokens} />
          </View>
        ) : tab === "credentials" ? (
          <View style={{ gap: 12 }}>
            {visibleTokenConnectors.length === 0 && !showStorage ? (
              <Text style={{ color: tokens.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 24 }}>{t.credentials.empty}</Text>
            ) : null}
            {visibleTokenConnectors.map((c) => {
              const state = connState[c.id];
              return (
                <View key={c.id} style={card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {React.isValidElement(c.icon)
                      ? React.cloneElement(c.icon as React.ReactElement<{ color?: string }>, { color: tokens.textSecondary })
                      : null}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "700" }}>{c.label}</Text>
                      {state?.preview ? <Text style={{ color: tokens.textMuted, fontSize: 11, fontFamily: "monospace" }}>{state.preview}</Text> : null}
                    </View>
                    {statusBadge(state?.configured)}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Button label={t.credentials.save} size="sm" variant="secondary" icon={<TablerDeviceFloppy size={15} />} onPress={() => setTokenDialog(c)} />
                    {c.test ? <Button label={t.credentials.test} size="sm" variant="ghost" onPress={() => testConnector(c)} /> : null}
                    {state?.configured ? <Button label={t.credentials.clear} size="sm" variant="ghost" icon={<TablerTrash size={15} />} onPress={() => setConfirmDelCred({ del: c.del, name: c.label })} /> : null}
                  </View>
                </View>
              );
            })}

            {showStorage ? (
              <>
                <Text style={{ color: tokens.textMuted, fontSize: 12, fontWeight: "600", marginTop: 4 }}>{t.credentials.storageTitle}</Text>
                {STORAGE_CONNECTORS.map((s) => {
                  const cred = storageCreds[s.provider];
                  return (
                    <View key={s.provider} style={card}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        {React.cloneElement(s.icon as React.ReactElement<{ color?: string }>, { color: tokens.textSecondary })}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: tokens.textPrimary, fontSize: 14, fontWeight: "700" }}>{s.label}</Text>
                          {cred?.accessKeyId ? <Text style={{ color: tokens.textMuted, fontSize: 11, fontFamily: "monospace" }}>{cred.accessKeyId}</Text> : null}
                        </View>
                        {statusBadge(cred?.configured)}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        <Button label={t.credentials.save} size="sm" variant="secondary" icon={<TablerDeviceFloppy size={15} />} onPress={() => setStorageDialog({ provider: s.provider, label: s.label })} />
                        {cred?.configured ? <Button label={t.credentials.clear} size="sm" variant="ghost" icon={<TablerTrash size={15} />} onPress={() => setConfirmDelCred({ del: `/api/backups/provider-creds/${s.provider}`, name: s.label })} /> : null}
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
          </View>
        ) : (
          // ── Sistema ──
          <View style={{ gap: 12 }}>
            <View style={card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TablerServer size={18} color={tokens.textSecondary} />
                <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.system.infoTitle}</Text>
              </View>
              {sysInfo ? (
                <View style={{ gap: 6 }}>
                  <InfoRow label={t.system.hostname} value={sysInfo.hostname ?? "—"} tokens={tokens} />
                  <InfoRow label={t.system.os} value={`${sysInfo.platform ?? ""} ${sysInfo.release ?? ""} ${sysInfo.arch ?? ""}`.trim() || "—"} tokens={tokens} />
                  <InfoRow label={t.system.cpu} value={sysInfo.cpu?.model ?? "—"} tokens={tokens} />
                  <InfoRow label={t.system.cores} value={String(sysInfo.cpu?.cores ?? "—")} tokens={tokens} />
                  <InfoRow label={t.system.load} value={String(sysInfo.cpu?.loadAvg?.["1m"] ?? "—")} tokens={tokens} />
                  <InfoRow label={t.system.memory} value={`${fmtBytes(sysInfo.memory?.used)} / ${fmtBytes(sysInfo.memory?.total)} (${sysInfo.memory?.usagePercent ?? "0"}%)`} tokens={tokens} />
                  <InfoRow label={t.system.disk} value={`${fmtBytes(sysInfo.disk?.used)} / ${fmtBytes(sysInfo.disk?.total)} (${sysInfo.disk?.percent ?? "0"}%)`} tokens={tokens} />
                  <InfoRow label={t.system.uptime} value={fmtUptime(sysInfo.uptime)} tokens={tokens} />
                </View>
              ) : (
                <ModuleLoading label={t.report.loading} />
              )}
            </View>

            <View style={card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TablerCpu size={18} color={tokens.textSecondary} />
                <Text style={{ color: tokens.textPrimary, fontSize: 15, fontWeight: "700" }}>{t.system.toolsTitle}</Text>
              </View>
              <Field label={t.system.restartService}>
                <Select value={restartService} onChange={setRestartService} placeholder={t.system.selectService} options={RESTART_SERVICES.map((s) => ({ value: s, label: s }))} />
              </Field>
              <Button label={t.system.run} size="sm" variant="secondary" icon={<TablerRefresh size={15} />} onPress={() => setConfirmTool({ kind: "restart" })} />
              <View style={{ height: 1, backgroundColor: tokens.border, marginVertical: 4 }} />
              <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{t.system.rebuildHint}</Text>
              <Button label={t.system.rebuild} size="sm" variant="secondary" icon={<TablerMail size={15} />} onPress={() => setConfirmTool({ kind: "rebuild" })} />
            </View>
          </View>
        )}
      </ServerModuleScreen>

      {setupOpen ? <TotpSetupDialog panelId={panelId} token={token} secret={setupOpen.secret} onClose={() => setSetupOpen(null)} onDone={() => { setSetupOpen(null); showToast(t.security.enabledToast); void load(); }} onError={() => showToast(t.toasts.error, true)} /> : null}

      {tokenDialog ? (
        <TokenCredDialog
          panelId={panelId}
          token={token}
          connector={tokenDialog}
          onClose={() => setTokenDialog(null)}
          onSaved={() => { setTokenDialog(null); showToast(t.credentials.savedToast); void loadCreds(); }}
          onError={(e) => showToast(e ?? t.toasts.error, true)}
        />
      ) : null}

      {storageDialog ? (
        <StorageCredDialog
          panelId={panelId}
          token={token}
          provider={storageDialog.provider}
          label={storageDialog.label}
          existing={storageCreds[storageDialog.provider]}
          onClose={() => setStorageDialog(null)}
          onSaved={() => { setStorageDialog(null); showToast(t.credentials.savedToast); void loadCreds(); }}
          onError={(e) => showToast(e ?? t.toasts.error, true)}
        />
      ) : null}

      {confirmDelCred ? (
        <ConfirmDialog
          visible
          title={t.credentials.deleteTitle}
          message={formatMessage(t.credentials.deleteConfirm, { name: confirmDelCred.name })}
          confirmLabel={t.credentials.clear}
          cancelLabel={t.credentials.cancel}
          submitting={credDelBusy}
          onConfirm={doDeleteCred}
          onCancel={() => setConfirmDelCred(null)}
        />
      ) : null}

      {confirmTool ? (
        <ConfirmDialog
          visible
          title={confirmTool.kind === "restart" ? t.system.restartConfirmTitle : t.system.rebuildConfirmTitle}
          message={confirmTool.kind === "restart" ? formatMessage(t.system.restartConfirm, { service: restartService }) : t.system.rebuildConfirm}
          confirmLabel={t.system.confirm}
          cancelLabel={t.system.cancel}
          danger={false}
          submitting={toolBusy}
          onConfirm={runTool}
          onCancel={() => setConfirmTool(null)}
        />
      ) : null}

      {assignImage ? (
        <AssignImageDialog
          panelId={panelId}
          token={token}
          image={assignImage}
          onClose={() => setAssignImage(null)}
          onAssigned={() => { setAssignImage(null); showToast(t.appearance.assignedToast); void loadAppearance(); }}
          onError={(e) => showToast(e ?? t.toasts.error, true)}
        />
      ) : null}

      <Toast visible={toast.visible} variant={toast.variant} message={toast.message} nonce={toast.nonce} onHide={() => setToast((p) => ({ ...p, visible: false }))} />
    </>
  );
}

function Row({ label, value, tokens }: { label: string; value: string; tokens: { bgCardSolid: string; border: string; textPrimary: string; textMuted: string } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgCardSolid, padding: 14 }}>
      <Text style={{ color: tokens.textPrimary, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 13 }}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, tokens }: { label: string; value: string; tokens: { border: string; textSecondary: string; textMuted: string } }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: tokens.textSecondary, fontSize: 12, flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}


