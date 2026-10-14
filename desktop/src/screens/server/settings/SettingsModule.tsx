/**
 * SettingsModule (desktop) — pantalla NATIVA del módulo Ajustes de un servidor
 * standalone (conexión DIRECTA por `serverApi`, token `""`). Port React DOM
 * COMPLETO de `app/src/screens/server/settings/SettingsViewScreen.tsx` (+ sus
 * hermanos `settings-types`/`settings-connectors`/`settings-dialogs`),
 * conservando estilos (Tailwind + daisyUI + lucide-react), i18n
 * (`getMessages(...).serverSettings`) y contrato (endpoints EXACTOS de la app).
 *
 * Paridad con app (6 tabs):
 *  - General: editor clave/valor de `/api/settings`.
 *  - Apariencia: identidad (panel_name/site_name → general) + claves de diseño
 *    (layout_*) + biblioteca de imágenes (subir logo + asignar a logo/favicon).
 *  - Seguridad: estado 2FA (+ alta TOTP), passkeys, códigos de recuperación.
 *  - Credenciales: tokens por módulo (gateados por módulo instalado) +
 *    almacenamiento de backups (R2/S3).
 *  - Reportes: formulario de ticket a soporte + lista de tickets + detalle/hilo.
 *  - Sistema: info del servidor, herramientas (reiniciar servicio / regenerar
 *    mapas) y uso de datos SSH.
 * Diálogos (TOTP / token / storage / ticket / asignar imagen) y confirmaciones
 * (borrar credencial / herramientas / cerrar ticket) portados 1:1.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cpu,
  Image as ImageIcon,
  LifeBuoy,
  Mail,
  Palette,
  RefreshCw,
  Save,
  Send,
  Server,
  ShieldCheck,
  Tag,
  Ticket,
  Trash2,
  Upload,
} from "lucide-react";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverModulesViewApi,
  serverSettingsApi,
  unwrap,
  uploadServerFile,
  type GatewayGuardCode,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
// Tipos, catálogos de conectores, helpers puros y subcomponentes →
// `./settings-shared`; diálogos → `./settings-dialogs` (reparto espejo de la
// app). El tipo `Ticket` se importa con alias para no chocar con el icono
// `Ticket` de lucide-react.
import {
  Field,
  flattenSettings,
  fmtBytes,
  fmtDate,
  fmtUptime,
  GUARDS,
  InfoRow,
  pillClass,
  RESTART_SERVICES,
  runServerMutation,
  SecurityRow,
  settingsRowsToKv,
  statusKind,
  statusLabel,
  STORAGE_CONNECTORS,
  TOKEN_CONNECTORS,
  type ConnState,
  type ImageEntry,
  type KV,
  type StorageCred,
  type SysInfo,
  type Ticket as TicketItem,
  type TokenConnector,
} from "./settings-shared";
import {
  AssignImageDialog,
  StorageCredDialog,
  TicketDetailModal,
  TokenCredDialog,
  TotpSetupDialog,
} from "./settings-dialogs";

export function SettingsModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverSettings;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState("general");
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

  // ── Reportes ──
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportSubtab, setReportSubtab] = useState("report");
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketsError, setTicketsError] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDesc, setRDesc] = useState("");
  const [rPriority, setRPriority] = useState("medium");
  const [rBusy, setRBusy] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  // ── Sistema ──
  const [sysLoaded, setSysLoaded] = useState(false);
  const [sysInfo, setSysInfo] = useState<SysInfo | null>(null);
  const [restartService, setRestartService] = useState(RESTART_SERVICES[0]);
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
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const [s, tf, pk, rc] = await Promise.all([
      serverSettingsApi.getAll(serverId, ""),
      serverSettingsApi.totpStatus(serverId, ""),
      serverSettingsApi.listPasskeys(serverId, ""),
      serverSettingsApi.recoveryStatus(serverId, ""),
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
  }, [serverId]);

  const loadCreds = useCallback(async () => {
    const batch = await callServerApi(serverId, "", "GET", "/api/settings/connector-status");
    const snapshot = unwrap<{ enabledModules: string[]; statuses: Record<string, unknown> }>(batch);
    const inst = snapshot ? { ok: true, data: snapshot.enabledModules.map(id => ({ id, enabled: true })) } : await serverModulesViewApi.installed(serverId, "");
    const list = unwrap<{ id?: string; enabled?: boolean }[]>(inst);
    const enabled = new Set((Array.isArray(list) ? list : []).filter((m) => m && m.enabled !== false && m.id).map((m) => m.id as string));
    setEnabledModules(enabled);

    const visibleTokens = TOKEN_CONNECTORS.filter((cn) => !cn.gate || enabled.has(cn.gate));
    const states: Record<string, ConnState> = {};
    await Promise.all(
      visibleTokens.map(async (cn) => {
        const dataFromBatch = snapshot?.statuses[cn.base];
        const res = dataFromBatch ? { ok: true, data: dataFromBatch } : await callServerApi(serverId, "", "GET", cn.base);
        const data = unwrap<Record<string, unknown>>(res) ?? {};
        states[cn.id] = {
          configured: Boolean(data[cn.setField]),
          preview: cn.previewField && typeof data[cn.previewField] === "string" ? (data[cn.previewField] as string) : undefined,
        };
      }),
    );
    setConnState(states);

    if (enabled.has("backups")) {
      const dataFromBatch = snapshot?.statuses["/api/backups/provider-creds"];
      const res = dataFromBatch ? { ok: true, data: dataFromBatch } : await callServerApi(serverId, "", "GET", "/api/backups/provider-creds");
      const arr = unwrap<StorageCred[]>(res);
      const map: Record<string, StorageCred> = {};
      for (const sc of Array.isArray(arr) ? arr : []) if (sc?.provider) map[sc.provider] = sc;
      setStorageCreds(map);
    } else {
      setStorageCreds({});
    }
  }, [serverId]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    const res = await callServerApi(serverId, "", "GET", "/api/report/tickets");
    const arr = unwrap<TicketItem[]>(res);
    if (!res.ok && !arr) {
      setTicketsError(true);
      setTickets([]);
    } else {
      setTicketsError(false);
      setTickets(Array.isArray(arr) ? arr : []);
    }
    setTicketsLoading(false);
  }, [serverId]);

  const loadSystem = useCallback(async () => {
    const si = await callServerApi(serverId, "", "GET", "/api/admin/system/info");
    setSysInfo(unwrap<SysInfo>(si));
  }, [serverId]);

  const loadAppearance = useCallback(async () => {
    setAppearanceLoading(true);
    const [lay, gen, img] = await Promise.all([
      serverSettingsApi.getCategory(serverId, "", "layout"),
      serverSettingsApi.getCategory(serverId, "", "general"),
      callServerApi(serverId, "", "GET", "/api/admin/branding/images"),
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
  }, [serverId]);

  // Subida de logo/branding: elige una imagen del dispositivo y la sube como raw
  // (octet-stream) a POST /api/admin/branding/upload; al terminar recarga la
  // biblioteca de imágenes. Errores (tamaño/tipo/ruta) → toast.
  const onLogoPicked = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploadingLogo(true);
      try {
        const res = await uploadServerFile(serverId, "", "/api/admin/branding/upload", file, file.name);
        if (res.ok) {
          toast.success(t.appearance.uploadedToast);
          await loadAppearance();
        } else {
          const panelErr = res.data && typeof res.data === "object" && "error" in res.data ? String((res.data as { error?: unknown }).error ?? "") : "";
          toast.error(panelErr || res.error || t.appearance.uploadError);
        }
      } catch {
        toast.error(t.appearance.uploadError);
      } finally {
        setUploadingLogo(false);
      }
    },
    [serverId, toast, loadAppearance, t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  // Carga perezosa de cada tab nuevo al abrirlo por primera vez.
  useEffect(() => {
    if (tab === "credentials" && !credLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
      setCredLoaded(true);
      void loadCreds();
    } else if (tab === "report" && !reportLoaded) {
      setReportLoaded(true);
      void loadTickets();
    } else if (tab === "system" && !sysLoaded) {
      setSysLoaded(true);
      void loadSystem();
    } else if (tab === "appearance" && !appearanceLoaded) {
      setAppearanceLoaded(true);
      void loadAppearance();
    }
  }, [tab, credLoaded, reportLoaded, sysLoaded, appearanceLoaded, loadCreds, loadTickets, loadSystem, loadAppearance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (tab === "credentials") await loadCreds();
    else if (tab === "report") await loadTickets();
    else if (tab === "system") await loadSystem();
    else if (tab === "appearance") await loadAppearance();
    setRefreshing(false);
  }, [load, tab, loadCreds, loadTickets, loadSystem, loadAppearance]);

  const saveKey = useCallback(
    async (key: string) => {
      const value = edited[key];
      if (value === undefined) return;
      const out = await runServerMutation(serverId, () => serverSettingsApi.set(serverId, "", { key, value }));
      if (out.ok) toast.success(t.general.savedToast);
      else toast.error(out.error ?? t.toasts.error);
    },
    [edited, serverId, toast, t],
  );

  const saveAppearanceKey = useCallback(
    async (key: string, category: string) => {
      const value = layoutEdited[key];
      if (value === undefined) return;
      const out = await runServerMutation(serverId, () => serverSettingsApi.set(serverId, "", { key, value, category }));
      if (out.ok) {
        toast.success(t.appearance.savedToast);
        setLayoutEdited((ed) => {
          const n = { ...ed };
          delete n[key];
          return n;
        });
        if (category === "general") setIdentityRows((rows) => rows.map((r) => (r.key === key ? { ...r, value } : r)));
        else setLayoutSettings((rows) => rows.map((r) => (r.key === key ? { ...r, value } : r)));
      } else toast.error(out.error ?? t.toasts.error);
    },
    [layoutEdited, serverId, toast, t],
  );

  const openSetup = useCallback(async () => {
    const res = await serverSettingsApi.totpSetup(serverId, "");
    const data = unwrap<{ secret?: string; otpauthUrl?: string }>(res);
    setSetupOpen({ secret: data?.secret });
  }, [serverId]);

  const testConnector = useCallback(
    async (cn: TokenConnector) => {
      if (!cn.test) return;
      const res = await callServerApi(serverId, "", "POST", cn.test);
      const data = unwrap<{ ok?: boolean; valid?: boolean; message?: string }>(res);
      const ok = Boolean(data?.ok ?? data?.valid);
      if (ok) toast.success(t.credentials.testOk);
      else toast.error(data?.message ?? t.credentials.testFail);
    },
    [serverId, toast, t],
  );

  const deleteCred = useCallback(
    async (del: string, name: string) => {
      const accepted = await confirm({
        title: t.credentials.deleteTitle,
        danger: true,
        confirmLabel: t.credentials.clear,
        cancelLabel: t.credentials.cancel,
        message: formatMessage(t.credentials.deleteConfirm, { name }),
      });
      if (!accepted) return;
      const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "DELETE", del));
      if (out.ok) {
        toast.success(t.credentials.clearedToast);
        void loadCreds();
      } else toast.error(out.error ?? t.toasts.error);
    },
    [confirm, serverId, toast, loadCreds, t],
  );

  const submitReport = useCallback(async () => {
    if (rTitle.trim().length < 5) {
      toast.error(t.report.subjectPlaceholder);
      return;
    }
    setRBusy(true);
    const out = await runServerMutation(serverId, () =>
      callServerApi(serverId, "", "POST", "/api/report/tickets", { title: rTitle.trim(), description: rDesc.trim(), priority: rPriority }),
    );
    setRBusy(false);
    if (out.ok) {
      toast.success(t.report.sentToast);
      setRTitle("");
      setRDesc("");
      setRPriority("medium");
      setReportSubtab("tickets");
      void loadTickets();
    } else toast.error(out.error ?? t.toasts.error);
  }, [rTitle, rDesc, rPriority, serverId, toast, loadTickets, t]);

  const runTool = useCallback(
    async (kind: "restart" | "rebuild") => {
      const accepted = await confirm({
        title: kind === "restart" ? t.system.restartConfirmTitle : t.system.rebuildConfirmTitle,
        confirmLabel: t.system.confirm,
        cancelLabel: t.system.cancel,
        message: kind === "restart" ? formatMessage(t.system.restartConfirm, { service: restartService }) : t.system.rebuildConfirm,
      });
      if (!accepted) return;
      setToolBusy(true);
      const op =
        kind === "restart"
          ? () => callServerApi(serverId, "", "POST", "/api/admin/tools/restart-service", { service: restartService })
          : () => callServerApi(serverId, "", "POST", "/api/admin/tools/rebuild-maps");
      const out = await runServerMutation(serverId, op);
      setToolBusy(false);
      if (out.ok) toast.success(kind === "restart" ? t.system.restartedToast : t.system.rebuiltToast);
      else toast.error(out.error ?? t.toasts.error);
    },
    [confirm, serverId, restartService, toast, t],
  );

  const tabs = [
    { key: "general", label: t.tabs.general },
    { key: "appearance", label: t.tabs.appearance },
    { key: "security", label: t.tabs.security },
    { key: "credentials", label: t.tabs.credentials },
    { key: "report", label: t.tabs.report },
    { key: "system", label: t.tabs.system },
  ];

  const visibleTokenConnectors = TOKEN_CONNECTORS.filter((cn) => !cn.gate || enabledModules === null || enabledModules.has(cn.gate));
  const showStorage = enabledModules === null || enabledModules.has("backups");

  const statusBadge = (on?: boolean) => (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${pillClass(on ? "ok" : "neutral")}`}>
      {on ? t.credentials.configured : t.credentials.notConfigured}
    </span>
  );

  // Fila clave/valor editable reutilizada por Identidad (general) y Diseño (layout).
  const kvRow = (kv: KV, category: string, labelOverride?: string) => (
    <div key={kv.key} className="flex flex-col gap-1.5 rounded-lg border border-base-300 bg-base-100 p-3">
      <span className="text-[11px] font-semibold text-base-content/60">{labelOverride ?? kv.key}</span>
      <div className="flex items-center gap-2">
        <input
          className="input input-bordered input-sm flex-1"
          value={layoutEdited[kv.key] ?? kv.value}
          onChange={(e) => setLayoutEdited((ed) => ({ ...ed, [kv.key]: e.target.value }))}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn-sm btn-outline"
          disabled={layoutEdited[kv.key] === undefined}
          onClick={() => void saveAppearanceKey(kv.key, category)}
        >
          {t.appearance.save}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {guardCode ? (
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.toasts.error}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                className={`btn btn-sm ${tab === tb.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
                onClick={() => setTab(tb.key)}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "general" ? (
            loading ? (
              <div className="flex justify-center py-10">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            ) : settings.length === 0 ? (
              <p className="py-6 text-center text-sm text-base-content/50">{t.general.empty}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {settings.map((kv) => (
                  <div key={kv.key} className="flex flex-col gap-1.5 rounded-lg border border-base-300 bg-base-100 p-3">
                    <span className="text-[11px] font-semibold text-base-content/60">{kv.key}</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="input input-bordered input-sm flex-1"
                        value={edited[kv.key] ?? kv.value}
                        onChange={(e) => setEdited((ed) => ({ ...ed, [kv.key]: e.target.value }))}
                        autoCapitalize="off"
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={edited[kv.key] === undefined}
                        onClick={() => void saveKey(kv.key)}
                      >
                        {t.general.save}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : tab === "appearance" ? (
            <div className="flex flex-col gap-3">
              {/* Identidad del panel (panel_name / site_name → general) */}
              <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                <div className="flex items-center gap-2">
                  <Tag size={18} className="text-base-content/70" />
                  <h3 className="text-sm font-bold">{t.appearance.identityTitle}</h3>
                </div>
                {identityRows.map((r) => kvRow(r, "general", r.key === "panel_name" ? t.appearance.panelNameLabel : t.appearance.siteNameLabel))}
              </div>

              {/* Editor de claves de diseño (layout_*) */}
              <div className="mt-1 flex items-center gap-2">
                <Palette size={18} className="text-base-content/70" />
                <h3 className="text-sm font-bold">{t.appearance.layoutTitle}</h3>
              </div>
              <p className="text-xs text-base-content/60">{t.appearance.layoutHint}</p>
              {appearanceLoading && layoutSettings.length === 0 ? (
                <p className="py-4 text-center text-sm text-base-content/50">{t.report.loading}</p>
              ) : layoutSettings.length === 0 ? (
                <p className="py-4 text-center text-sm text-base-content/50">{t.appearance.empty}</p>
              ) : (
                <div className="flex flex-col gap-2">{layoutSettings.map((kv) => kvRow(kv, "layout"))}</div>
              )}

              {/* Biblioteca de imágenes */}
              <div className="mt-1 flex items-center gap-2">
                <ImageIcon size={18} className="text-base-content/70" />
                <h3 className="text-sm font-bold">{t.appearance.imagesTitle}</h3>
              </div>
              <p className="text-xs text-base-content/60">{t.appearance.imagesHint}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <span className="loading loading-spinner loading-xs" /> : <Upload size={15} />} {t.appearance.uploadBtn}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onLogoPicked(e)} />
              </div>
              <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">{t.appearance.uploadInfo}</div>
              {imagesError ? (
                <p className="py-4 text-center text-sm text-error">{t.appearance.imagesError}</p>
              ) : brandingImages.length === 0 ? (
                <p className="py-4 text-center text-sm text-base-content/50">{t.appearance.imagesEmpty}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                  {brandingImages.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      className="flex flex-col gap-1.5 rounded-lg border border-base-300 bg-base-100 p-2.5 text-left hover:border-primary/50"
                      onClick={() => setAssignImage({ url: img.url, name: img.name })}
                    >
                      <span className="grid h-16 place-items-center rounded-md bg-base-200">
                        <ImageIcon size={26} className="text-base-content/40" />
                      </span>
                      <span className="truncate text-xs font-semibold">{img.name}</span>
                      <span className="truncate font-mono text-[10px] text-base-content/50">{img.url}</span>
                      {img.size != null ? <span className="text-[10px] text-base-content/50">{fmtBytes(img.size)}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : tab === "security" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 rounded-xl border border-base-300 bg-base-100 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className={twoFa.enabled ? "text-success" : "text-base-content/50"} />
                  <h3 className="min-w-0 flex-1 text-sm font-bold">{t.security.twoFaTitle}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${twoFa.enabled ? "bg-success/15 text-success" : "bg-base-300 text-base-content/50"}`}>
                    {twoFa.enabled ? t.security.twoFaEnabled : t.security.twoFaDisabled}
                  </span>
                </div>
                {!twoFa.enabled ? (
                  <button type="button" className="btn btn-primary btn-sm w-fit" onClick={() => void openSetup()}>
                    {t.security.setup}
                  </button>
                ) : null}
              </div>
              <SecurityRow label={t.security.passkeysLabel} value={passkeys != null ? formatMessage(t.security.count, { count: passkeys }) : t.security.notConfigured} />
              <SecurityRow label={t.security.recoveryLabel} value={recovery ? t.security.configured : t.security.notConfigured} />
            </div>
          ) : tab === "credentials" ? (
            <div className="flex flex-col gap-3">
              {visibleTokenConnectors.length === 0 && !showStorage ? (
                <p className="py-6 text-center text-sm text-base-content/50">{t.credentials.empty}</p>
              ) : null}
              {visibleTokenConnectors.map((cn) => {
                const state = connState[cn.id];
                return (
                  <div key={cn.id} className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base-content/70">{cn.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{cn.label}</p>
                        {state?.preview ? <p className="truncate font-mono text-[11px] text-base-content/50">{state.preview}</p> : null}
                      </div>
                      {statusBadge(state?.configured)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setTokenDialog(cn)}>
                        <Save size={15} /> {t.credentials.save}
                      </button>
                      {cn.test ? (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void testConnector(cn)}>
                          {t.credentials.test}
                        </button>
                      ) : null}
                      {state?.configured ? (
                        <button type="button" className="btn btn-sm btn-ghost gap-1.5 text-error" onClick={() => void deleteCred(cn.del, cn.label)}>
                          <Trash2 size={15} /> {t.credentials.clear}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {showStorage ? (
                <>
                  <p className="mt-1 text-xs font-semibold text-base-content/60">{t.credentials.storageTitle}</p>
                  {STORAGE_CONNECTORS.map((s) => {
                    const cred = storageCreds[s.provider];
                    return (
                      <div key={s.provider} className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base-content/70">{s.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">{s.label}</p>
                            {cred?.accessKeyId ? <p className="truncate font-mono text-[11px] text-base-content/50">{cred.accessKeyId}</p> : null}
                          </div>
                          {statusBadge(cred?.configured)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setStorageDialog({ provider: s.provider, label: s.label })}>
                            <Save size={15} /> {t.credentials.save}
                          </button>
                          {cred?.configured ? (
                            <button type="button" className="btn btn-sm btn-ghost gap-1.5 text-error" onClick={() => void deleteCred(`/api/backups/provider-creds/${s.provider}`, s.label)}>
                              <Trash2 size={15} /> {t.credentials.clear}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : null}
            </div>
          ) : tab === "report" ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button type="button" className={`btn btn-sm gap-1.5 ${reportSubtab === "report" ? "btn-primary" : "btn-ghost border border-base-300"}`} onClick={() => setReportSubtab("report")}>
                  <LifeBuoy size={15} /> {t.report.subtabReport}
                </button>
                <button type="button" className={`btn btn-sm gap-1.5 ${reportSubtab === "tickets" ? "btn-primary" : "btn-ghost border border-base-300"}`} onClick={() => setReportSubtab("tickets")}>
                  <Ticket size={15} /> {t.report.subtabTickets}
                </button>
              </div>

              {reportSubtab === "report" ? (
                <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                  <h3 className="text-sm font-bold">{t.report.formTitle}</h3>
                  <p className="text-xs text-base-content/60">{t.report.formSubtitle}</p>
                  <Field label={t.report.subjectLabel}>
                    <input className="input input-bordered input-sm w-full" value={rTitle} onChange={(e) => setRTitle(e.target.value)} placeholder={t.report.subjectPlaceholder} maxLength={200} />
                  </Field>
                  <Field label={t.report.messageLabel}>
                    <textarea className="textarea textarea-bordered w-full" rows={5} value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder={t.report.messagePlaceholder} maxLength={5000} />
                  </Field>
                  <Field label={t.report.priorityLabel}>
                    <select className="select select-bordered select-sm w-full max-w-xs" value={rPriority} onChange={(e) => setRPriority(e.target.value)}>
                      <option value="low">{t.report.priorityLow}</option>
                      <option value="medium">{t.report.priorityMedium}</option>
                      <option value="high">{t.report.priorityHigh}</option>
                      <option value="critical">{t.report.priorityCritical}</option>
                    </select>
                  </Field>
                  <button type="button" className="btn btn-primary btn-sm w-fit gap-1.5" onClick={() => void submitReport()} disabled={rBusy}>
                    {rBusy ? <span className="loading loading-spinner loading-xs" /> : <Send size={16} />} {t.report.submit}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {ticketsLoading ? (
                    <p className="py-6 text-center text-sm text-base-content/50">{t.report.loading}</p>
                  ) : ticketsError ? (
                    <p className="py-6 text-center text-sm text-error">{t.report.loadError}</p>
                  ) : tickets.length === 0 ? (
                    <p className="py-6 text-center text-sm text-base-content/50">{t.report.empty}</p>
                  ) : (
                    tickets.map((tk) => (
                      <div key={tk.id} className="flex flex-col gap-2 rounded-xl border border-base-300 bg-base-100 p-3">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tk.title ?? "—"}</span>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${pillClass(statusKind(tk.status))}`}>{statusLabel(t, tk.status)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-base-content/50">{fmtDate(tk.createdAt)}</span>
                          <button type="button" className="btn btn-xs btn-ghost" onClick={() => setOpenTicketId(tk.id)}>
                            {t.report.subtabTickets}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            // ── Sistema ──
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                <div className="flex items-center gap-2">
                  <Server size={18} className="text-base-content/70" />
                  <h3 className="text-sm font-bold">{t.system.infoTitle}</h3>
                </div>
                {sysInfo ? (
                  <div className="flex flex-col gap-1.5">
                    <InfoRow label={t.system.hostname} value={sysInfo.hostname ?? "—"} />
                    <InfoRow label={t.system.os} value={`${sysInfo.platform ?? ""} ${sysInfo.release ?? ""} ${sysInfo.arch ?? ""}`.trim() || "—"} />
                    <InfoRow label={t.system.cpu} value={sysInfo.cpu?.model ?? "—"} />
                    <InfoRow label={t.system.cores} value={String(sysInfo.cpu?.cores ?? "—")} />
                    <InfoRow label={t.system.load} value={String(sysInfo.cpu?.loadAvg?.["1m"] ?? "—")} />
                    <InfoRow label={t.system.memory} value={`${fmtBytes(sysInfo.memory?.used)} / ${fmtBytes(sysInfo.memory?.total)} (${sysInfo.memory?.usagePercent ?? "0"}%)`} />
                    <InfoRow label={t.system.disk} value={`${fmtBytes(sysInfo.disk?.used)} / ${fmtBytes(sysInfo.disk?.total)} (${sysInfo.disk?.percent ?? "0"}%)`} />
                    <InfoRow label={t.system.uptime} value={fmtUptime(sysInfo.uptime)} />
                  </div>
                ) : (
                  <p className="text-xs text-base-content/60">{t.report.loading}</p>
                )}
              </div>

              <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-base-content/70" />
                  <h3 className="text-sm font-bold">{t.system.toolsTitle}</h3>
                </div>
                <Field label={t.system.restartService}>
                  <select className="select select-bordered select-sm w-full max-w-xs" value={restartService} onChange={(e) => setRestartService(e.target.value)}>
                    {RESTART_SERVICES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <button type="button" className="btn btn-sm btn-outline w-fit gap-1.5" onClick={() => void runTool("restart")} disabled={toolBusy}>
                  <RefreshCw size={15} /> {t.system.run}
                </button>
                <div className="my-1 h-px bg-base-300" />
                <p className="text-xs text-base-content/60">{t.system.rebuildHint}</p>
                <button type="button" className="btn btn-sm btn-outline w-fit gap-1.5" onClick={() => void runTool("rebuild")} disabled={toolBusy}>
                  <Mail size={15} /> {t.system.rebuild}
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {/* ── Diálogos ── */}
      {setupOpen ? (
        <TotpSetupDialog
          serverId={serverId}
          t={t}
          closeLabel={c.close}
          secret={setupOpen.secret}
          onClose={() => setSetupOpen(null)}
          onDone={() => {
            setSetupOpen(null);
            toast.success(t.security.enabledToast);
            void load();
          }}
          onError={() => toast.error(t.toasts.error)}
        />
      ) : null}

      {tokenDialog ? (
        <TokenCredDialog
          serverId={serverId}
          t={t}
          closeLabel={c.close}
          connector={tokenDialog}
          onClose={() => setTokenDialog(null)}
          onSaved={() => {
            setTokenDialog(null);
            toast.success(t.credentials.savedToast);
            void loadCreds();
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {storageDialog ? (
        <StorageCredDialog
          serverId={serverId}
          t={t}
          closeLabel={c.close}
          provider={storageDialog.provider}
          label={storageDialog.label}
          existing={storageCreds[storageDialog.provider]}
          onClose={() => setStorageDialog(null)}
          onSaved={() => {
            setStorageDialog(null);
            toast.success(t.credentials.savedToast);
            void loadCreds();
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {openTicketId ? (
        <TicketDetailModal
          serverId={serverId}
          t={t}
          closeLabel={c.close}
          confirm={confirm}
          ticketId={openTicketId}
          onClose={() => setOpenTicketId(null)}
          onToast={(m, err) => (err ? toast.error(m) : toast.success(m))}
          onChanged={() => void loadTickets()}
        />
      ) : null}

      {assignImage ? (
        <AssignImageDialog
          serverId={serverId}
          t={t}
          closeLabel={c.close}
          image={assignImage}
          onClose={() => setAssignImage(null)}
          onAssigned={() => {
            setAssignImage(null);
            toast.success(t.appearance.assignedToast);
            void loadAppearance();
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {dialog}
    </div>
  );
}
