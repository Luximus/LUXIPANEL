/**
 * ExpoModule (desktop) — pantalla NATIVA del módulo Expo (EAS builds) de un
 * servidor standalone (conexión DIRECTA por `serverApi`). Port React DOM COMPLETO
 * de `app/src/screens/server/expo/*` (ExpoScreen + expo-dialogs + expo-types +
 * expo-icons), conservando estilos (Tailwind + daisyUI + lucide-react), i18n
 * (`getMessages(...).serverExpo`) y contrato (`serverExpoApi`/`callServerApi`,
 * token `""` en modo directo).
 *
 * Paridad con app: tabs Configuración / Proyectos / Builds / Variables /
 * Credenciales; guardado y borrado del Access Token; lista de proyectos
 * detectados en el servidor (al elegir uno alimenta Builds); historial de builds
 * con diálogo para lanzar/cancelar; ciclo de vida (submit a tienda, OTA,
 * dev-client); variables de entorno EAS (CRUD); y credenciales de tienda
 * (Google/Apple), webhooks y registro de dispositivo. Las mutaciones pasan por
 * la cola write-behind (`runServerMutation` + `withJob`); los endpoints que
 * DEVUELVEN datos (dev-client, device, store-credentials) usan `callServerApi`
 * directo + `unwrap`. Tablas con el DataTable de desktop; confirmaciones con
 * `useConfirm`; feedback con `useToast`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Boxes,
  CloudUpload,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  Webhook,
} from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  callServerApi,
  serverExpoApi,
  unwrap,
  type GatewayGuardCode,
} from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";
// Tipos, helpers puros y subcomponentes de presentación → `./expo-shared`;
// diálogos → `./expo-dialogs` (mismo reparto que la app móvil).
import {
  envDisplayValue,
  Field,
  fmtDate,
  GUARDS,
  hasToken,
  InfoBox,
  Pill,
  runServerMutation,
  statusKind,
  StoreCredCard,
  tokenPreview,
  visibilityKind,
  type ExpoBuild,
  type ExpoConfig,
  type ExpoEnvVar,
  type ExpoProject,
  type ExpoStoreCredentials,
  type PillKind,
} from "./expo-shared";
import {
  AppleCredDialog,
  BuildDialog,
  DeviceDialog,
  DevClientDialog,
  EnvDialog,
  GoogleCredDialog,
  OtaDialog,
  SubmitDialog,
  WebhookDialog,
} from "./expo-dialogs";

// ── Filas planas del DataTable de desktop ────────────────────────────────────
type ProjectRow = { id: string; app: string; path: string; projectId: string; linked: boolean };
type BuildRow = { id: string; buildId: string; status: string; platform: string; profile: string; date: string };
type EnvRow = { id: string; name: string; value: string; scope: string; visibility: string; environments: string; editable: boolean };

export function ExpoModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverExpo;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const showToast = useCallback(
    (message: string, err = false) => (err ? toast.error(message) : toast.success(message)),
    [toast],
  );

  const [tab, setTab] = useState<"config" | "projects" | "builds" | "env" | "credentials">("config");
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
  const [buildOpen, setBuildOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [otaOpen, setOtaOpen] = useState(false);
  const [devClientOpen, setDevClientOpen] = useState(false);

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

  // ── Carga (mismo contrato/paths que app) ──────────────────────────────────
  const load = useCallback(async () => {
    const [cfgRes, projRes] = await Promise.all([
      serverExpoApi.getConfig(serverId, ""),
      serverExpoApi.projects(serverId, ""),
    ]);
    if (cfgRes.code && GUARDS.includes(cfgRes.code)) {
      setGuardCode(cfgRes.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setConfig(unwrap<ExpoConfig>(cfgRes) ?? {});
    setProjects(unwrap<ExpoProject[]>(projRes) ?? []);
  }, [serverId]);

  const loadBuilds = useCallback(
    async (path: string) => {
      if (!path) {
        setBuilds([]);
        return;
      }
      setBuildsLoading(true);
      const res = await serverExpoApi.buildList(serverId, "", { path });
      setBuildsLoading(false);
      if (res.code && GUARDS.includes(res.code)) {
        setGuardCode(res.code as GatewayGuardCode);
        return;
      }
      setBuilds(unwrap<ExpoBuild[]>(res) ?? []);
    },
    [serverId],
  );

  const loadEnv = useCallback(
    async (project: ExpoProject) => {
      setEnvLoading(true);
      const res = await serverExpoApi.envList(serverId, "", {
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
    [serverId],
  );

  // Estado de credenciales de tienda: endpoint que DEVUELVE datos → callServerApi
  // directo + unwrap (no es una mutación).
  const loadStoreCreds = useCallback(
    async (project: ExpoProject) => {
      setStoreCredsLoading(true);
      setStoreCredsError(false);
      const res = await callServerApi(serverId, "", "POST", "/api/expo/store-credentials", {
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
    [serverId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (selected) void loadBuilds(selected.path);
    else setBuilds([]);
  }, [selected, loadBuilds]);

  useEffect(() => {
    if (tab !== "env") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    if (selected) void loadEnv(selected);
    else setEnvVars([]);
  }, [tab, selected, loadEnv]);

  useEffect(() => {
    if (tab !== "credentials") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
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

  // ── Configuración ──────────────────────────────────────────────────────────
  const saveToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    const out = await runServerMutation(serverId, () => serverExpoApi.setConfig(serverId, "", { token: tokenInput.trim() }));
    setSavingToken(false);
    if (out.ok) {
      setTokenInput("");
      showToast(t.toasts.saved);
      void load();
    } else showToast(out.error ?? t.toasts.error, true);
  }, [tokenInput, serverId, showToast, load, t.toasts]);

  const clearToken = useCallback(async () => {
    const accepted = await confirm({
      title: t.config.clearTitle,
      message: t.config.clearMessage,
      confirmLabel: t.config.clearConfirm,
      cancelLabel: t.config.cancel,
      danger: true,
    });
    if (!accepted) return;
    const out = await runServerMutation(serverId, () => serverExpoApi.deleteConfig(serverId, ""));
    if (out.ok) {
      showToast(t.toasts.cleared);
      void load();
    } else showToast(out.error ?? t.toasts.error, true);
  }, [confirm, serverId, showToast, load, t.config, t.toasts]);

  // ── Builds ─────────────────────────────────────────────────────────────────
  const cancelBuild = useCallback(
    async (buildId: string) => {
      if (!selected) return;
      const accepted = await confirm({
        title: t.builds.confirmCancelTitle,
        message: t.builds.confirmCancel,
        confirmLabel: t.builds.cancel,
        cancelLabel: t.confirm.cancel,
        danger: true,
      });
      if (!accepted) return;
      const out = await runServerMutation(serverId, () => serverExpoApi.buildCancel(serverId, "", { path: selected.path, buildId }));
      if (out.ok) {
        showToast(t.toasts.cancelled);
        void loadBuilds(selected.path);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [confirm, selected, serverId, showToast, loadBuilds, t.builds, t.confirm, t.toasts],
  );

  // ── Variables de entorno ─────────────────────────────────────────────────────
  const deleteEnv = useCallback(
    async (row: ExpoEnvVar) => {
      if (!selected || !row.id) return;
      const project = selected;
      const id = row.id;
      const accepted = await confirm({
        title: t.env.confirmDeleteTitle,
        message: formatMessage(t.env.confirmDelete, { name: row.name }),
        confirmLabel: t.env.delete,
        cancelLabel: t.confirm.cancel,
        danger: true,
      });
      if (!accepted) return;
      const out = await runServerMutation(serverId, () =>
        serverExpoApi.envDelete(serverId, "", {
          path: project.path,
          ...(project.projectId ? { projectId: project.projectId } : {}),
          id,
        }),
      );
      if (out.ok) {
        showToast(t.env.deleted);
        void loadEnv(project);
      } else showToast(out.error ?? t.toasts.error, true);
    },
    [confirm, selected, serverId, showToast, loadEnv, t.env, t.confirm, t.toasts],
  );

  // ── Filas + columnas de las tablas ───────────────────────────────────────────
  const projectRows = useMemo<ProjectRow[]>(
    () =>
      projects.map((p) => ({
        id: p.path,
        app: p.name ?? p.slug ?? "—",
        path: p.path,
        projectId: p.projectId ?? "—",
        linked: !!p.projectId,
      })),
    [projects],
  );
  const projectColumns = useMemo<DataTableColumnConfig<ProjectRow>[]>(
    () => [
      { id: "app", header: t.projects.colApp, accessorKey: "app" },
      { id: "path", header: t.projects.colPath, accessorKey: "path", cell: (p) => <span className="font-mono text-xs">{p.path}</span> },
      { id: "projectId", header: t.projects.colProjectId, accessorKey: "projectId", cell: (p) => <span className="font-mono text-xs">{p.projectId}</span> },
      {
        id: "status",
        header: t.projects.colStatus,
        accessorKey: "linked",
        cell: (p) => <Pill label={p.linked ? t.projects.linked : t.projects.unlinked} kind={p.linked ? "ok" : "neutral"} />,
      },
    ],
    [t],
  );
  const projectActions = useMemo<DataTableRowActionConfig<ProjectRow>[]>(
    () => [{ id: "use", label: t.projects.use }],
    [t],
  );

  const buildRows = useMemo<BuildRow[]>(
    () =>
      builds.map((b) => ({
        id: b.id,
        buildId: b.id.slice(0, 8),
        status: b.status ?? "—",
        platform: b.platform ?? "—",
        profile: b.profile ?? "—",
        date: fmtDate(b.createdAt),
      })),
    [builds],
  );
  const buildColumns = useMemo<DataTableColumnConfig<BuildRow>[]>(
    () => [
      { id: "id", header: t.builds.colId, accessorKey: "buildId", cell: (b) => <span className="font-mono text-xs">{b.buildId}</span> },
      { id: "status", header: t.builds.colStatus, accessorKey: "status", cell: (b) => <Pill label={b.status} kind={statusKind(b.status)} /> },
      { id: "platform", header: t.builds.colPlatform, accessorKey: "platform" },
      { id: "profile", header: t.builds.colProfile, accessorKey: "profile" },
      { id: "date", header: t.builds.colDate, accessorKey: "date" },
    ],
    [t],
  );
  const buildActions = useMemo<DataTableRowActionConfig<BuildRow>[]>(
    () => [{ id: "cancel", label: t.builds.cancel, variant: "danger" }],
    [t],
  );

  const envRows = useMemo<EnvRow[]>(
    () =>
      envVars.map((v) => ({
        id: v.id || v.name,
        name: v.name,
        value: envDisplayValue(v),
        scope: v.scope ?? "—",
        visibility: v.visibility ?? "—",
        environments: (v.environments ?? []).join(", ") || "—",
        editable: !!v.id,
      })),
    [envVars],
  );
  const envColumns = useMemo<DataTableColumnConfig<EnvRow>[]>(
    () => [
      { id: "name", header: t.env.colName, accessorKey: "name", cell: (v) => <span className="font-mono text-xs">{v.name}</span> },
      { id: "value", header: t.env.colValue, accessorKey: "value" },
      { id: "scope", header: t.env.colScope, accessorKey: "scope" },
      { id: "visibility", header: t.env.colVisibility, accessorKey: "visibility", cell: (v) => <Pill label={v.visibility} kind={visibilityKind(v.visibility)} /> },
      { id: "environments", header: t.env.colEnvironments, accessorKey: "environments" },
    ],
    [t],
  );
  const envActions = useMemo<DataTableRowActionConfig<EnvRow>[]>(
    () => [
      { id: "edit", label: t.env.edit },
      { id: "delete", label: t.env.delete, variant: "danger" },
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
  }, [storeCreds, t]);

  const tabs: { key: typeof tab; label: string; icon: ReactNode }[] = [
    { key: "config", label: t.tabs.config, icon: <Settings size={15} /> },
    { key: "projects", label: t.tabs.projects, icon: <Boxes size={15} /> },
    { key: "builds", label: t.tabs.builds, icon: <Rocket size={15} /> },
    { key: "env", label: t.tabs.env, icon: <KeyRound size={15} /> },
    { key: "credentials", label: t.tabs.credentials, icon: <ShieldCheck size={15} /> },
  ];

  const headerAction =
    tab === "builds" && selected ? (
      <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setBuildOpen(true)}>
        <Rocket size={14} /> {t.newBuild}
      </button>
    ) : tab === "env" && selected ? (
      <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setEnvDialog({ mode: "create" })}>
        <Plus size={14} /> {t.env.new}
      </button>
    ) : null;

  const tokenSet = hasToken(config);
  const selectedLabel = selected ? formatMessage(t.builds.selectedProject, { name: selected.name ?? selected.path }) : "";

  // ── Render ──────────────────────────────────────────────────────────────────
  if (guardCode) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.pageTitle}</h2>
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-base-300 bg-base-100 p-5">
          <p className="text-sm text-error">{t.toasts.error}</p>
          <p className="font-mono text-xs text-base-content/50">{guardCode}</p>
          <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => void onRefresh()}>
            <RefreshCw size={14} /> {c.refresh}
          </button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + refrescar + acción */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        {headerAction}
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            className={`btn btn-sm gap-1.5 ${tab === tb.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : tab === "config" ? (
        <div className="flex max-w-2xl flex-col gap-3">
          <h3 className="text-sm font-bold">{t.config.title}</h3>
          <InfoBox tone={tokenSet ? "info" : "warn"}>
            {tokenSet ? `${t.config.tokenSet}${tokenPreview(config) ? `  ·  ${tokenPreview(config)}` : ""}` : t.config.tokenMissing}
          </InfoBox>
          <Field label={tokenSet ? t.config.replaceLabel : t.config.tokenLabel} hint={t.config.tokenHint}>
            <input
              type="password"
              className="input input-bordered input-sm w-full"
              autoComplete="off"
              value={tokenInput}
              placeholder={t.config.tokenPlaceholder}
              onChange={(e) => setTokenInput(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm gap-1.5"
              onClick={() => void saveToken()}
              disabled={savingToken || !tokenInput.trim()}
            >
              {savingToken ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />} {t.config.save}
            </button>
            {tokenSet ? (
              <button type="button" className="btn btn-error btn-outline btn-sm gap-1.5" onClick={() => void clearToken()}>
                <Trash2 size={14} /> {t.config.clear}
              </button>
            ) : null}
          </div>
        </div>
      ) : tab === "projects" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
          <h3 className="text-sm font-bold">{t.projects.title}</h3>
          <DataTable<ProjectRow>
            tableId="server-expo-projects"
            title={t.projects.title}
            data={projectRows}
            columns={projectColumns}
            rowActions={projectActions}
            language={language}
            pageSizeOptions={[10, 25, 50]}
            onRowAction={(actionId, row) => {
              if (actionId === "use") {
                const project = projects.find((p) => p.path === row.id);
                if (project) {
                  setSelected(project);
                  setTab("builds");
                }
              }
            }}
          />
        </div>
      ) : tab === "builds" ? (
        <div className="flex flex-col gap-3">
          {selected ? (
            <p className="text-sm text-base-content/70">{selectedLabel}</p>
          ) : (
            <InfoBox tone="info">{t.builds.noProject}</InfoBox>
          )}
          {selected ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setSubmitOpen(true)}>
                <Upload size={14} /> {t.lifecycle.submit}
              </button>
              <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setOtaOpen(true)}>
                <CloudUpload size={14} /> {t.lifecycle.ota}
              </button>
              <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setDevClientOpen(true)}>
                <Smartphone size={14} /> {t.lifecycle.devClient}
              </button>
            </div>
          ) : null}
          {selected ? (
            <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
              <h3 className="text-sm font-bold">{t.builds.title}</h3>
              <DataTable<BuildRow>
                tableId="server-expo-builds"
                title={t.builds.title}
                data={buildRows}
                columns={buildColumns}
                rowActions={buildActions}
                language={language}
                loading={buildsLoading}
                pageSizeOptions={[10, 25, 50]}
                onRowAction={(actionId, row) => {
                  if (actionId === "cancel") void cancelBuild(row.id);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : tab === "env" ? (
        <div className="flex flex-col gap-3">
          {selected ? (
            <p className="text-sm text-base-content/70">{selectedLabel}</p>
          ) : (
            <InfoBox tone="info">{t.env.noProject}</InfoBox>
          )}
          {selected ? (
            <div className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4">
              <h3 className="text-sm font-bold">{t.env.title}</h3>
              <DataTable<EnvRow>
                tableId="server-expo-env"
                title={t.env.title}
                data={envRows}
                columns={envColumns}
                rowActions={envActions}
                language={language}
                loading={envLoading}
                pageSizeOptions={[10, 25, 50]}
                onRowAction={(actionId, row) => {
                  // Sólo las variables respaldadas por GraphQL (con id) son editables/eliminables.
                  if (!row.editable) {
                    showToast(t.env.readOnly, true);
                    return;
                  }
                  const original = envVars.find((v) => (v.id || v.name) === row.id);
                  if (!original) return;
                  if (actionId === "edit") setEnvDialog({ mode: "edit", row: original });
                  else if (actionId === "delete") void deleteEnv(original);
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!selected ? (
            <InfoBox tone="info">{t.credentials.noProject}</InfoBox>
          ) : (
            <>
              <p className="text-sm text-base-content/70">{selectedLabel}</p>
              <InfoBox tone="info">{t.credentials.intro}</InfoBox>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setGoogleOpen(true)}>
                  <Upload size={14} /> {t.credentials.setGoogle}
                </button>
                <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setAppleOpen(true)}>
                  <Upload size={14} /> {t.credentials.setApple}
                </button>
                <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setWebhookOpen(true)}>
                  <Webhook size={14} /> {t.credentials.webhookBtn}
                </button>
                <button type="button" className="btn btn-sm btn-outline gap-1.5" onClick={() => setDeviceOpen(true)}>
                  <Smartphone size={14} /> {t.credentials.deviceBtn}
                </button>
              </div>
              <h3 className="text-sm font-bold">{t.credentials.stateTitle}</h3>
              {storeCredsLoading ? (
                <div className="flex items-center gap-2 py-2 text-base-content/60">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : storeCredsError ? (
                <InfoBox tone="danger">{t.credentials.loadError}</InfoBox>
              ) : credCards ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <StoreCredCard title={credCards.google.title} badges={credCards.google.badges} rows={credCards.google.rows} />
                  <StoreCredCard title={credCards.apple.title} badges={credCards.apple.badges} rows={credCards.apple.rows} />
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* Diálogos */}
      {buildOpen && selected ? (
        <BuildDialog
          serverId={serverId}
          path={selected.path}
          language={language}
          onClose={() => setBuildOpen(false)}
          onLaunched={() => {
            setBuildOpen(false);
            showToast(t.toasts.launched);
            if (selected) void loadBuilds(selected.path);
          }}
          onError={() => showToast(t.toasts.error, true)}
        />
      ) : null}

      {submitOpen && selected ? (
        <SubmitDialog
          serverId={serverId}
          path={selected.path}
          language={language}
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
          serverId={serverId}
          path={selected.path}
          language={language}
          onClose={() => setOtaOpen(false)}
          onPublished={() => {
            setOtaOpen(false);
            showToast(t.ota.published);
          }}
          onToast={showToast}
        />
      ) : null}

      {devClientOpen && selected ? (
        <DevClientDialog serverId={serverId} path={selected.path} language={language} onClose={() => setDevClientOpen(false)} onToast={showToast} />
      ) : null}

      {googleOpen && selected ? (
        <GoogleCredDialog
          serverId={serverId}
          path={selected.path}
          language={language}
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
          serverId={serverId}
          path={selected.path}
          language={language}
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
          serverId={serverId}
          path={selected.path}
          language={language}
          onClose={() => setWebhookOpen(false)}
          onSaved={() => {
            setWebhookOpen(false);
            showToast(t.credentials.webhook.saved);
          }}
          onToast={showToast}
        />
      ) : null}

      {deviceOpen && selected ? (
        <DeviceDialog serverId={serverId} path={selected.path} language={language} onClose={() => setDeviceOpen(false)} onToast={showToast} />
      ) : null}

      {envDialog && selected ? (
        <EnvDialog
          serverId={serverId}
          project={selected}
          mode={envDialog.mode}
          row={envDialog.row}
          language={language}
          onClose={() => setEnvDialog(null)}
          onSaved={(updated) => {
            setEnvDialog(null);
            showToast(updated ? t.env.updated : t.env.saved);
            if (selected) void loadEnv(selected);
          }}
          onToast={showToast}
        />
      ) : null}

      {dialog}
    </div>
  );
}
