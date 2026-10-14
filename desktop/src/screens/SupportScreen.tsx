import { useCallback, useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import { NavActions } from "../components/NavActions";
import { Plus, RefreshCw, Server, Settings } from "lucide-react";
import {
  getSupportRowActions,
  getTicketBadgeConfig,
  getTicketColumns,
  getTicketFilters,
} from "../features/app/tableConfig";
import type { TicketRow } from "../features/app/viewModels";
import type { NavAction } from "../features/app/types";
import { getMessages } from "../i18n";
import { useEnterAnimation } from "../hooks/useEnterAnimation";
import {
  staffListTickets,
  staffListSpam,
  staffMarkNotSpam,
  staffRetriageTicket,
  updateTicketStatus,
  type StaffTicket,
} from "../api/client";
import { AssignTicketModal } from "../components/AssignTicketModal";

// TODO(i18n): etiquetas del admin de tickets (staff) embebidas en español;
// se moverán a i18n/messages cuando el otro agente añada las claves.

// Estados de ticket que un admin puede fijar desde la vista de staff.
const STAFF_STATUSES: Array<{ value: "open" | "in_progress" | "resolved" | "closed"; label: string }> = [
  { value: "open", label: "Abierto" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resuelto" },
  { value: "closed", label: "Cerrado" },
];

export function SupportScreen({
  isDark: _isDark,
  language,
  token,
  isAdmin,
  openTicketsCount,
  totalTickets,
  busyTickets,
  ticketRows,
  onRefreshTickets,
  onTicketRowAction,
  onGoServers,
  onOpenNewTicket,
}: {
  isDark: boolean;
  language: string;
  token: string;
  isAdmin: boolean;
  openTicketsCount: number;
  totalTickets: number;
  busyTickets: boolean;
  ticketRows: TicketRow[];
  onRefreshTickets: () => void;
  onTicketRowAction: (actionId: string, row: TicketRow) => void;
  onGoServers: () => void;
  onOpenNewTicket: () => void;
}) {
  void _isDark;
  const t = getMessages(language);
  // El modal de ajustes de la tabla lo abre la acción "Configurar" del navbar.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Vista de staff (solo admin) ────────────────────────────────────────
  const [view, setView] = useState<"mine" | "staff">("mine");
  const [staffTickets, setStaffTickets] = useState<StaffTicket[]>([]);
  const [spamTickets, setSpamTickets] = useState<StaffTicket[]>([]);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<StaffTicket | null>(null);

  const loadStaff = useCallback(async () => {
    if (!isAdmin || !token) return;
    setStaffBusy(true);
    setStaffError("");
    try {
      const [tickets, spam] = await Promise.all([staffListTickets(token), staffListSpam(token)]);
      setStaffTickets(tickets);
      setSpamTickets(spam);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : "No se pudieron cargar los tickets de staff");
    } finally {
      setStaffBusy(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (view === "staff") void loadStaff();
  }, [view, loadStaff]);

  const handleStatusChange = useCallback(
    async (ticket: StaffTicket, status: "open" | "in_progress" | "resolved" | "closed") => {
      if (status === ticket.status) return;
      setBusyRow(ticket.id);
      try {
        await updateTicketStatus(ticket.id, status, token);
        setStaffTickets((prev) => prev.map((tk) => (tk.id === ticket.id ? { ...tk, status } : tk)));
      } catch (err) {
        setStaffError(err instanceof Error ? err.message : "No se pudo cambiar el estado");
      } finally {
        setBusyRow(null);
      }
    },
    [token],
  );

  const handleNotSpam = useCallback(
    async (ticket: StaffTicket, assign: boolean) => {
      setBusyRow(ticket.id);
      try {
        await staffMarkNotSpam(ticket.id, token, assign);
        setSpamTickets((prev) => prev.filter((tk) => tk.id !== ticket.id));
        void loadStaff();
      } catch (err) {
        setStaffError(err instanceof Error ? err.message : "No se pudo sacar de spam");
      } finally {
        setBusyRow(null);
      }
    },
    [token, loadStaff],
  );

  const handleRetriage = useCallback(
    async (ticket: StaffTicket) => {
      setBusyRow(ticket.id);
      try {
        await staffRetriageTicket(ticket.id, token);
        void loadStaff();
      } catch (err) {
        setStaffError(err instanceof Error ? err.message : "No se pudo re-evaluar");
      } finally {
        setBusyRow(null);
      }
    },
    [token, loadStaff],
  );

  const onAssigned = useCallback((updated: StaffTicket) => {
    setStaffTickets((prev) => prev.map((tk) => (tk.id === updated.id ? { ...tk, ...updated } : tk)));
    setAssignTarget(null);
  }, []);

  // Acciones contextuales de esta vista (antes publicadas al navbar superior, ya
  // removido): ahora se renderizan encima de la tabla, en la cabecera de la
  // sección "Mis tickets" (ver `<NavActions>` más abajo).
  const supportActions: NavAction[] = [
    { id: "new-ticket", label: t.support.newTicket, icon: <Plus size={16} />, onClick: onOpenNewTicket, variant: "primary" },
    { id: "refresh", label: t.support.refresh, icon: <RefreshCw size={16} />, onClick: onRefreshTickets, disabled: busyTickets, busy: busyTickets },
    { id: "configure", label: t.dataTable.configure, icon: <Settings size={16} />, onClick: () => setSettingsOpen(true), variant: "ghost" },
  ];

  const animationRef = useEnterAnimation<HTMLElement>([
    { selector: ".panel-hero", from: { opacity: 0, y: 18 }, duration: 0.5 },
    { selector: ".panel-hero__eyebrow", from: { opacity: 0, y: -8 }, duration: 0.35, delay: "<0.05" },
    { selector: ".panel-hero__title", from: { opacity: 0, y: 12, scale: 0.96 }, duration: 0.55, ease: "power3.out", delay: "<0.05" },
    { selector: ".panel-hero__subtitle", from: { opacity: 0, y: 10 }, duration: 0.4, delay: "<0.1" },
    { selector: ".panel-hero__actions > button", from: { opacity: 0, y: 10, scale: 0.95 }, duration: 0.4, stagger: 0.08, delay: "<0.05" },
    { selector: ".glance-card", from: { opacity: 0, y: 14 }, duration: 0.4, stagger: 0.08, delay: "<0.1" },
    { selector: ".panel-section", from: { opacity: 0, y: 16 }, duration: 0.5, delay: "<0.1" },
  ]);

  return (
    <main ref={animationRef} className="h-full w-full overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="panel-wrapper">
        <section className="panel-hero">
          <div className="panel-hero__grid">
            <div className="panel-hero__content">
              <span className="panel-hero__eyebrow">{t.support.eyebrow}</span>
              <h1 className="panel-hero__title">{t.support.title}</h1>
              <p className="panel-hero__subtitle">{t.support.subtitle}</p>
              <div className="panel-hero__actions">
                <button type="button" className="btn-panel-link btn-panel-link--primary" onClick={onOpenNewTicket}>
                  <Plus size={16} />
                  <span>{t.support.newTicket}</span>
                </button>
                <button type="button" className="btn-panel-link" onClick={onGoServers}>
                  <Server size={16} />
                  <span>{t.support.servers}</span>
                </button>
              </div>
            </div>
            <div className="panel-hero__glance">
              <div className="glance-card">
                <span className="glance-card__label">{t.support.openTickets}</span>
                <span className="glance-card__value">{openTicketsCount}</span>
                <span className="glance-card__meta">{t.support.unresolved}</span>
              </div>
              <div className="glance-card">
                <span className="glance-card__label">{t.support.totalTickets}</span>
                <span className="glance-card__value">{totalTickets}</span>
                <span className="glance-card__meta">{t.support.fromSystem}</span>
              </div>
            </div>
          </div>
        </section>

        {isAdmin ? (
          <div className="mb-4 flex gap-2">
            {/* TODO(i18n) */}
            <button
              type="button"
              className={`btn btn-sm lp-seg-tab ${view === "mine" ? "is-active" : "btn-outline"}`}
              onClick={() => setView("mine")}
            >
              Mis tickets
            </button>
            <button
              type="button"
              className={`btn btn-sm lp-seg-tab ${view === "staff" ? "is-active" : "btn-outline"}`}
              onClick={() => setView("staff")}
            >
              Soporte (staff)
            </button>
          </div>
        ) : null}

        {isAdmin && view === "staff" ? (
          <StaffSection
            staffTickets={staffTickets}
            spamTickets={spamTickets}
            busy={staffBusy}
            error={staffError}
            busyRow={busyRow}
            onRefresh={() => void loadStaff()}
            onStatusChange={handleStatusChange}
            onAssign={setAssignTarget}
            onNotSpam={handleNotSpam}
            onRetriage={handleRetriage}
          />
        ) : (
        <section className="panel-section">
          <div className="support-section">
            <div className="support-section__header">
              <div>
                <p className="support-section__title">{t.support.myTickets}</p>
                <p className="support-section__subtitle">{t.support.ticketsHistory}</p>
              </div>
              <NavActions actions={supportActions} />
            </div>

            {busyTickets ? (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-base-300/60 bg-base-100/60 dark:border-zinc-700 dark:bg-zinc-900/40">
                <table className="table">
                  <thead>
                    <tr>
                      {getTicketColumns(t).map((col) => (
                        <th key={col.id}>
                          <div className="skeleton h-4 w-24"></div>
                        </th>
                      ))}
                      <th>
                        <div className="skeleton h-4 w-16"></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`}>
                        {getTicketColumns(t).map((col) => (
                          <td key={col.id}>
                            <div className="skeleton h-4 w-full max-w-[180px]"></div>
                          </td>
                        ))}
                        <td>
                          <div className="skeleton h-7 w-16 rounded-md"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <DataTable
                tableId="portal-support-user-table"
                title={t.support.ticketsTableTitle}
                data={ticketRows}
                columns={getTicketColumns(t)}
                filters={getTicketFilters(t)}
                rowActions={getSupportRowActions(t)}
                valueBadges={getTicketBadgeConfig(t)}
                pageSizeOptions={[10, 20, 50]}
                language={language}
                onRowAction={onTicketRowAction}
                hideSettingsButton
                settingsOpen={settingsOpen}
                onSettingsOpenChange={setSettingsOpen}
              />
            )}
          </div>
        </section>
        )}
      </div>

      {assignTarget ? (
        <AssignTicketModal
          ticket={assignTarget}
          token={token}
          onClose={() => setAssignTarget(null)}
          onAssigned={onAssigned}
        />
      ) : null}
    </main>
  );
}

// ── Sección de admin de tickets (staff) ───────────────────────────────────
// UI propia del desktop (puede divergir del estilo web). Lista los tickets de
// staff y la cola de spam con acciones por fila: cambiar estado, reasignar y
// sacar de spam (o re-evaluar el triage).
function StaffSection({
  staffTickets,
  spamTickets,
  busy,
  error,
  busyRow,
  onRefresh,
  onStatusChange,
  onAssign,
  onNotSpam,
  onRetriage,
}: {
  staffTickets: StaffTicket[];
  spamTickets: StaffTicket[];
  busy: boolean;
  error: string;
  busyRow: string | null;
  onRefresh: () => void;
  onStatusChange: (ticket: StaffTicket, status: "open" | "in_progress" | "resolved" | "closed") => void;
  onAssign: (ticket: StaffTicket) => void;
  onNotSpam: (ticket: StaffTicket, assign: boolean) => void;
  onRetriage: (ticket: StaffTicket) => void;
}) {
  const assignee = (tk: StaffTicket) =>
    tk.assignedAdmin?.name || tk.assignedAdmin?.email || (tk.assignedAdminId ? "Asignado" : "Sin asignar");
  const customer = (tk: StaffTicket) => tk.customer?.name || tk.customer?.email || tk.customerId || "—";

  return (
    <section className="panel-section">
      <div className="support-section">
        <div className="support-section__header">
          <div>
            {/* TODO(i18n) */}
            <p className="support-section__title">Tickets de soporte (staff)</p>
            <p className="support-section__subtitle">Todos los tickets de los clientes</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={14} className={busy ? "animate-spin" : undefined} />
            <span>Actualizar</span>
          </button>
        </div>

        {error ? <p className="lp-modal-error mt-2">{error}</p> : null}

        <div className="mt-3 overflow-x-auto rounded-2xl border border-base-300/60 bg-base-100/60 dark:border-zinc-700 dark:bg-zinc-900/40">
          <table className="table">
            <thead>
              <tr>
                {/* TODO(i18n) */}
                <th>Título</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Asignado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {busy && staffTickets.length === 0 ? (
                <tr><td colSpan={5} className="opacity-60">Cargando…</td></tr>
              ) : staffTickets.length === 0 ? (
                <tr><td colSpan={5} className="opacity-60">Sin tickets</td></tr>
              ) : (
                staffTickets.map((tk) => (
                  <tr key={tk.id}>
                    <td>{tk.title}</td>
                    <td className="text-sm opacity-80">{customer(tk)}</td>
                    <td>
                      <select
                        className="lp-modal-input"
                        value={tk.status}
                        disabled={busyRow === tk.id}
                        onChange={(e) => onStatusChange(tk, e.target.value as StaffTicket["status"])}
                      >
                        {STAFF_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="text-sm opacity-80">{assignee(tk)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={busyRow === tk.id}
                        onClick={() => onAssign(tk)}
                      >
                        {/* TODO(i18n) */}
                        Reasignar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="support-section__header mt-6">
          <div>
            {/* TODO(i18n) */}
            <p className="support-section__title">Cola de spam / triage</p>
            <p className="support-section__subtitle">Tickets retenidos por la heurística</p>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-base-300/60 bg-base-100/60 dark:border-zinc-700 dark:bg-zinc-900/40">
          <table className="table">
            <thead>
              <tr>
                {/* TODO(i18n) */}
                <th>Título</th>
                <th>Cliente</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {spamTickets.length === 0 ? (
                <tr><td colSpan={4} className="opacity-60">Sin elementos en spam</td></tr>
              ) : (
                spamTickets.map((tk) => (
                  <tr key={tk.id}>
                    <td>{tk.title}</td>
                    <td className="text-sm opacity-80">{customer(tk)}</td>
                    <td className="text-sm opacity-70">{tk.triageReason || "—"}</td>
                    <td className="flex flex-wrap gap-1">
                      {/* TODO(i18n) */}
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={busyRow === tk.id}
                        onClick={() => onNotSpam(tk, false)}
                      >
                        No es spam
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        disabled={busyRow === tk.id}
                        onClick={() => onNotSpam(tk, true)}
                      >
                        No es spam y asignarme
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        disabled={busyRow === tk.id}
                        onClick={() => onRetriage(tk)}
                      >
                        Re-evaluar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
