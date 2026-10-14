import { useEffect, useState } from "react";
import PanelCardGrid from "../components/PanelCardGrid";
import { ServersConfigPanel } from "../components/ServersConfigPanel";
import { ImportExportModal } from "../components/ImportExportModal";
import { AuditModal } from "../components/AuditModal";
import { ServerSharingModal } from "../components/ServerSharingModal";
import type { DataTableQuickActionConfig } from "../components/DataTable";
import { Code2, Download, Newspaper, Plus, ServerCog, Store, Upload } from "lucide-react";
import {
  getPanelFilters,
  getPanelRowActions,
} from "../features/app/tableConfig";
import type { PanelRow, ServerMetricsState } from "../features/app/viewModels";
import type { NavAction } from "../features/app/types";
import type { PanelInvitation } from "../types/models";
import type { PanelTaxonomy, SshKeySummary } from "../api/client";
import { getTokenBalance, type TokenBalance } from "../api/billing";
import { getMessages } from "../i18n";
import { useEnterAnimation } from "../hooks/useEnterAnimation";

/** Tarjeta de saldo como `stat` dentro de un `join` (mismo estilo que la fila de
 *  info del panel/servidor, clase `server-info-stats`). */
function StatCard({ label, value, meta }: { label: string; value: string | number; meta?: string }) {
  return (
    <div className="stat join-item">
      <div className="stat-title">{label}</div>
      <div className="stat-value">{value}</div>
      {meta ? <div className="stat-desc">{meta}</div> : null}
    </div>
  );
}

export function DashboardScreen({
  isDark,
  language,
  licensedCount: _licensedCount,
  unlicensedCount: _unlicensedCount,
  busyPanels,
  panelRows,
  panelMetrics,
  onActiveServerPanelChange,
  refreshPanelMetrics,
  pendingFocusPanelId,
  clearPendingFocus,
  balancesVersion = 0,
  onPanelRowAction,
  onOpenCreatePanel,
  onOpenStandalone,
  onRefreshPanels,
  onGoSupport: _onGoSupport,
  onGoPayments: _onGoPayments,
  onGoSecurity: _onGoSecurity,
  onGoDevPortal,
  onGoModuleStore,
  onGoBlog,
  invitations,
  onRespondInvitation,
  token,
  taxonomy,
  sshKeys,
  refreshTaxonomy,
  refreshSshKeys,
  applyCategoryCreated,
  applyCategoryRenamed,
  applyCategoryDeleted,
  applyTagCreated,
  applyTagRenamed,
  applyTagDeleted,
  applySshKeyCreated,
  applySshKeyUpdated,
  applySshKeyDeleted,
  guestMode = false,
}: {
  isDark: boolean;
  language: string;
  licensedCount: number;
  unlicensedCount: number;
  busyPanels: boolean;
  panelRows: PanelRow[];
  panelMetrics?: Record<string, ServerMetricsState>;
  onActiveServerPanelChange?: (panelId: string | null) => void;
  refreshPanelMetrics?: (panelId: string) => Promise<void> | void;
  pendingFocusPanelId?: string | null;
  clearPendingFocus?: () => void;
  /** Contador que bumpea el controlador al cambiar los saldos (p. ej. compra
   *  aprobada): re-consulta wallet+tokens para la barra de saldo y el gating. */
  balancesVersion?: number;
  onPanelRowAction: (actionId: string, row: PanelRow) => void;
  onOpenCreatePanel: () => void;
  /** Abre el gestor de servidores STANDALONE (conexión directa, sin LP-LS). */
  onOpenStandalone?: () => void;
  onRefreshPanels: () => void;
  onGoSupport?: () => void;
  onGoPayments?: () => void;
  onGoSecurity?: () => void;
  onGoDevPortal?: () => void;
  onGoModuleStore?: () => void;
  onGoBlog?: () => void;
  invitations: PanelInvitation[];
  onRespondInvitation: (shareId: string, decision: "accepted" | "rejected", kind?: "panel_share" | "server_user_share" | "group") => void;
  token: string;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  refreshTaxonomy: () => Promise<void>;
  refreshSshKeys: () => Promise<void>;
  applyCategoryCreated: (category: { id: string; name: string }) => void;
  applyCategoryRenamed: (id: string, name: string) => void;
  applyCategoryDeleted: (id: string) => void;
  applyTagCreated: (categoryId: string, tag: { id: string; name: string }) => void;
  applyTagRenamed: (id: string, name: string) => void;
  applyTagDeleted: (id: string) => void;
  applySshKeyCreated: (key: SshKeySummary) => void;
  applySshKeyUpdated: (key: SshKeySummary) => void;
  applySshKeyDeleted: (id: string) => void;
  guestMode?: boolean;
}) {
  const t = getMessages(language);
  // El lateral derecho aloja la configuración (Categorías, Tags, SSH Keys,
  // Integraciones, API). Es fijo: siempre visible para usuarios autenticados,
  // sin opción de ocultar. En modo invitado no hay configuración → sin lateral.
  const [ioModal, setIoModal] = useState<{ open: boolean; mode: "import" | "export" }>({ open: false, mode: "export" });
  const [auditModal, setAuditModal] = useState<{ open: boolean; panelId: string | null; panelName: string }>({
    open: false,
    panelId: null,
    panelName: "",
  });
  const [shareModal, setShareModal] = useState<{ open: boolean; panelId: string | null; panelName: string }>({
    open: false,
    panelId: null,
    panelName: "",
  });
  const panelQuickActions: DataTableQuickActionConfig<PanelRow>[] = [];

  // Exportar (y el resto de acciones sensibles) ya NO se gatean aquí: el 2FA es
  // opt-in por acción (scope `export`) y lo pide el reintento central de `request`.

  // Saldo de datos (MB) y de tokens de la cuenta. Avisamos cuando los datos
  // están por agotarse (≤250 MB) y, dentro de ese aviso, mostramos las mismas
  // tarjetas de saldo que el modal de Pagos (tabs Datos y Tokens).
  // Saldo de TOKENS de la cuenta (marketplace IA). El modelo por datos (MB) fue
  // retirado: ya no hay wallet de datos ni gating "sin datos".
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  useEffect(() => {
    if (guestMode || !token) return;
    let cancelled = false;
    void getTokenBalance(token).then((tb) => { if (!cancelled) setTokenBalance(tb); }).catch(() => {});
    return () => { cancelled = true; };
    // `balancesVersion` se re-consulta tras una compra aprobada → actualiza el chip.
  }, [guestMode, token, balancesVersion]);

  // Acciones contextuales (antes publicadas al navbar superior, ya removido):
  // ahora se renderizan ENCIMA del buscador del panel (ver `aboveSearchActions`
  // en PanelCardGrid). Misma fila, orden y UI que la web (ServersDashboard):
  // Nueva conexión · Importar · Exportar · Consumo, todas con el MISMO estilo
  // neutro (outline). New siempre; Importar/Exportar/Consumo solo con sesión
  // real (no invitado). Exportar exige 2FA (entrega llaves privadas) vía el
  // reintento central; "Actualizar" vive como botón solo-icono en el panel.
  const dashActions: NavAction[] = [
    { id: "new", label: t.dashboard.newConnection, icon: <Plus size={16} />, onClick: onOpenCreatePanel },
  ];
  if (!guestMode) {
    dashActions.push({ id: "import", label: t.importExport.fab.import, icon: <Upload size={16} />, onClick: () => setIoModal({ open: true, mode: "import" }) });
    dashActions.push({ id: "export", label: t.importExport.fab.export, icon: <Download size={16} />, onClick: () => setIoModal({ open: true, mode: "export" }) });
    // Fase W — gaps de web nativos: portal de desarrollador, tienda de módulos, blog.
    if (onGoDevPortal) dashActions.push({ id: "dev-portal", label: t.devPortal.launcher, icon: <Code2 size={16} />, onClick: onGoDevPortal });
    if (onGoModuleStore) dashActions.push({ id: "module-store", label: t.moduleStore.launcher, icon: <Store size={16} />, onClick: onGoModuleStore });
    if (onGoBlog) dashActions.push({ id: "blog", label: t.blog.tab, icon: <Newspaper size={16} />, onClick: onGoBlog });
    if (onOpenStandalone) {
      // Servidor autohospedado: conexión DIRECTA a un box LUXIPANEL standalone.
      dashActions.push({ id: "standalone", label: t.serverStandalone.launcher, icon: <ServerCog size={16} />, onClick: onOpenStandalone });
    }
  }

  const animationRef = useEnterAnimation<HTMLElement>([
    { selector: ".panel-hero", from: { opacity: 0, y: 18 }, duration: 0.5 },
    { selector: ".glance-card", from: { opacity: 0, y: 14 }, duration: 0.4, stagger: 0.08, delay: "<0.15" },
    { selector: ".panel-section", from: { opacity: 0, y: 16 }, duration: 0.5, delay: "<0.1" },
  ]);

  // Datos para los tabs de configuración del lateral (antes alimentaban el modal
  // "Configurar", ahora removido). En invitado no hay token → sin configuración.
  const settingsAdvancedData = guestMode
    ? undefined
    : {
        token,
        taxonomy,
        sshKeys,
        panels: panelRows.map((row) => ({ id: row.id, label: `${row.nameLabel} · ${row.accessDomain}` })),
        refreshTaxonomy,
        refreshSshKeys,
        refreshPanels: onRefreshPanels,
        applyCategoryCreated,
        applyCategoryRenamed,
        applyCategoryDeleted,
        applyTagCreated,
        applyTagRenamed,
        applyTagDeleted,
        applySshKeyCreated,
        applySshKeyUpdated,
        applySshKeyDeleted,
      };

  // Contenido del drawer lateral derecho: SOLO la configuración. Las
  // invitaciones y el aviso de "cargando panel" se muestran en la columna
  // principal (ver `consumoHeader`), no escondidas tras el drawer.
  const configPanel = settingsAdvancedData ? (
    <ServersConfigPanel
      advanced={settingsAdvancedData}
      language={language}
    />
  ) : undefined;

  // Banners de invitaciones / "cargando panel": antes vivían en el lateral; con
  // el drawer pasan a la cabecera de la columna principal para que sigan
  // visibles sin abrir la configuración.
  const dashboardBanners = (
    <>
      {!guestMode && invitations.length > 0 ? (
        <div className="panel-invite-banner">
          <p className="panel-invite-banner__title">{t.dashboard.pendingInvitations}</p>
          <div>
            {invitations.map((invite) => (
              <div key={invite.id} className="panel-invite-banner__row">
                <span className="panel-invite-banner__label">
                  {invite.kind === "group"
                    ? `${t.sharing.groupPrefix}: ${invite.groupName || invite.panelName}`
                    : invite.kind === "server_user_share"
                      ? `${invite.panelName}${invite.linuxUsername ? ` · ${invite.linuxUsername}` : ""}`
                      : invite.panelName}
                  {" · "}{invite.owner.name || invite.owner.email || t.dashboard.invitationOwnerFallback}
                </span>
                <div className="flex gap-2">
                  <button className="btn btn-xs btn-success" onClick={() => onRespondInvitation(invite.id, "accepted", invite.kind)}>{t.common.accept}</button>
                  <button className="btn btn-xs btn-error" onClick={() => onRespondInvitation(invite.id, "rejected", invite.kind)}>{t.common.reject}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {busyPanels ? (
        <div className="flex items-center gap-2 rounded-xl border border-base-300/60 bg-base-100/60 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
          <span className="loading loading-spinner loading-sm text-primary"></span>
          <span className="text-sm text-base-content/70">{t.dashboard.loadingPanel}</span>
        </div>
      ) : null}
    </>
  );

  // Cabecera de la columna izquierda: barra de saldo (tarjetas Datos+Tokens,
  // estilo `join`/`server-info-stats`). El botón "Consumo" se movió a la fila de
  // acciones (`dashActions`) para igualar la web; aquí queda solo la barra. Es
  // SIEMPRE visible (no solo con saldo bajo): es información de cuenta que el
  // usuario quiere ver de continuo; cuando los datos están bajos (`lowData`) se
  // resalta el borde en ámbar a modo de aviso. Antes era una fila a ancho
  // completo SOBRE el split; ahora se apila dentro de la columna del listado
  // para que el lateral de tabs ocupe todo el alto a su derecha.
  // Acciones del dashboard (Nueva conexión / Importar / Exportar / Consumo) como
  // una tarjeta-fila de celdas con divisores (mismo estilo que las tarjetas de
  // saldo), en la MISMA fila que el saldo y a su izquierda.
  const dashActionsCard = (
    <div className="dashboard-actions-card">
      {dashActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="dashboard-action-cell"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.title ?? action.label}
        >
          {action.busy ? <span className="loading loading-spinner loading-sm" /> : action.icon}
          <span className="whitespace-nowrap">{action.label}</span>
        </button>
      ))}
    </div>
  );

  const consumoHeader = (
    <div className="flex shrink-0 flex-col gap-3">
      {dashboardBanners}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {dashActionsCard}
      {!guestMode && tokenBalance ? (
        <div className="join join-vertical sm:join-horizontal server-info-stats min-w-0 flex-1">
          <StatCard label={t.payments.tokenBalance} value={tokenBalance.available} meta={`$${tokenBalance.availableUsd.toFixed(2)}`} />
          <StatCard label={t.payments.tokenEarned} value={tokenBalance.earned} meta={`$${tokenBalance.earnedUsd.toFixed(2)}`} />
        </div>
      ) : null}
      </div>
    </div>
  );

  return (
    <main ref={animationRef} className="relative flex h-full w-full min-h-0 flex-col overflow-hidden p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper panel-wrapper--full min-h-0 flex-1">
        <PanelCardGrid
          data={panelRows}
          serversHeader={consumoHeader}
          metrics={panelMetrics}
          onActivePanelChange={onActiveServerPanelChange}
          onMetricsRefresh={refreshPanelMetrics}
          focusPanelId={pendingFocusPanelId}
          onFocusHandled={clearPendingFocus}
          token={token}
          noData={false}
          filters={guestMode ? [{ id: "search", label: t.panelTable.filters.search, accessorKey: "searchBlob", type: "text" }] : getPanelFilters(t)}
          rowActions={guestMode ? [{ id: "connect", label: t.panelTable.actions.connect }] : getPanelRowActions(t)}
          quickActions={panelQuickActions}
          language={language}
          onRowAction={(actionId, row) => {
            if (actionId === "audit") {
              setAuditModal({ open: true, panelId: row.id, panelName: row.nameLabel });
              return;
            }
            if (actionId === "manage_access") {
              setShareModal({ open: true, panelId: row.id, panelName: row.nameLabel });
              return;
            }
            onPanelRowAction(actionId, row);
          }}
          sidebarHeader={guestMode ? undefined : configPanel}
          loading={busyPanels}
          onCreateConnection={onOpenCreatePanel}
          isDark={isDark}
          onRefresh={onRefreshPanels}
          refreshing={busyPanels}
        />
      </div>

      {!guestMode ? <ImportExportModal
        open={ioModal.open}
        mode={ioModal.mode}
        token={token}
        language={language}
        onClose={() => setIoModal((prev) => ({ ...prev, open: false }))}
        onAfterImport={() => onRefreshPanels()}
      /> : null}

      {!guestMode ? <AuditModal
        open={auditModal.open}
        panelId={auditModal.panelId}
        panelName={auditModal.panelName}
        token={token}
        language={language}
        onClose={() => setAuditModal((prev) => ({ ...prev, open: false }))}
      /> : null}

      {!guestMode ? <ServerSharingModal
        open={shareModal.open}
        panelId={shareModal.panelId}
        panelName={shareModal.panelName}
        token={token}
        language={language}
        onClose={() => setShareModal((prev) => ({ ...prev, open: false }))}
      /> : null}

    </main>
  );
}
