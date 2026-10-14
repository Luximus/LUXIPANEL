import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Inbox, RefreshCw, ShieldAlert, UserCog } from "lucide-react-native";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { getLocaleRowDirection, getLocaleTextAlign, getMessages } from "../i18n";
import { FormSheet } from "./ui/FormSheet";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import {
  staffAssignTicket,
  staffListAgents,
  staffListSpam,
  staffListTickets,
  staffMarkNotSpam,
  staffRetriageTicket,
  updateTicketStatus,
} from "../api/client";
import type { StaffAgent, Ticket } from "../types/models";
import { styles } from "./StaffTicketsModal.styles";

// TODO(i18n): este módulo (admin de tickets / staff) usa etiquetas en español
// fijas a propósito; al cablear i18n mover estas cadenas a
// src/i18n/messages/screens/* sin tocar la lógica.
const STATUS_COLORS: Record<string, string> = {
  open: "#f472b6",
  in_progress: "#f43f5e",
  resolved: "#10b981",
  closed: "#94a3b8",
};

type StaffTab = "queue" | "spam";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

function agentLabel(agent: StaffAgent): string {
  const name = agent.name?.trim();
  const email = agent.email?.trim();
  const base = name || email || agent.id;
  const cases = typeof agent.activeCases === "number" ? ` (${agent.activeCases})` : "";
  const tag = agent.isAdmin ? " · admin" : "";
  return `${base}${tag}${cases}`;
}

export function StaffTicketsModal({
  visible,
  onClose,
  token,
  language,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  token: string;
  language: string;
  /** Notifica al padre que cambió un ticket (para refrescar la vista del usuario). */
  onChanged?: () => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const t = getMessages(language);
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);

  const [tab, setTab] = useState<StaffTab>("queue");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [spam, setSpam] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<StaffAgent[]>([]);
  // Ticket cuya fila tiene una acción en curso (deshabilita esa fila).
  const [busyId, setBusyId] = useState<string | null>(null);

  // Drawer de formularios de reasignación.
  const [assignModal, setAssignModal] = useState<{ ticket: Ticket | null; assigneeId: string; saving: boolean; error: string }>({
    ticket: null,
    assigneeId: "",
    saving: false,
    error: "",
  });

  const statusOptions = useMemo(
    () => [
      { value: "open", label: (t.ticketTable.statusBadges as Record<string, string>).open ?? "open" },
      { value: "in_progress", label: (t.ticketTable.statusBadges as Record<string, string>).in_progress ?? "in_progress" },
      { value: "resolved", label: (t.ticketTable.statusBadges as Record<string, string>).resolved ?? "resolved" },
      { value: "closed", label: (t.ticketTable.statusBadges as Record<string, string>).closed ?? "closed" },
    ],
    [t],
  );

  const agentOptions = useMemo(
    () => agents.map((a) => ({ value: a.id, label: agentLabel(a) })),
    [agents],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [list, spamList, roster] = await Promise.all([
        staffListTickets(token),
        staffListSpam(token).catch(() => [] as Ticket[]),
        staffListAgents(token).catch(() => ({ support: [], admins: [] })),
      ]);
      setTickets(list);
      setSpam(spamList);
      setAgents([...roster.support, ...roster.admins]);
    } catch (e) {
      // TODO(i18n)
      setError(e instanceof Error ? e.message : "No se pudieron cargar los tickets de staff.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const replaceTicket = (updated: Ticket) => {
    setTickets((curr) => curr.map((tk) => (tk.id === updated.id ? { ...tk, ...updated } : tk)));
    setSpam((curr) => curr.filter((tk) => tk.id !== updated.id));
  };

  const handleStatusChange = async (ticket: Ticket, status: TicketStatus) => {
    if (status === ticket.status) return;
    setBusyId(ticket.id);
    setError("");
    try {
      const { ticket: updated } = await updateTicketStatus(ticket.id, status, token);
      replaceTicket(updated ?? { ...ticket, status });
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setBusyId(null);
    }
  };

  const handleNotSpam = async (ticket: Ticket) => {
    setBusyId(ticket.id);
    setError("");
    try {
      const { ticket: updated } = await staffMarkNotSpam(ticket.id, token);
      setSpam((curr) => curr.filter((tk) => tk.id !== ticket.id));
      if (updated) {
        setTickets((curr) => (curr.some((tk) => tk.id === updated.id) ? curr : [updated, ...curr]));
      }
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sacar de spam.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRetriage = async (ticket: Ticket) => {
    setBusyId(ticket.id);
    setError("");
    try {
      await staffRetriageTicket(ticket.id, token);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo re-clasificar.");
    } finally {
      setBusyId(null);
    }
  };

  const openAssign = (ticket: Ticket) => {
    setAssignModal({ ticket, assigneeId: ticket.assignedAdminId ?? "", saving: false, error: "" });
  };

  const confirmAssign = async () => {
    const ticket = assignModal.ticket;
    if (!ticket || !assignModal.assigneeId) return;
    setAssignModal((c) => ({ ...c, saving: true, error: "" }));
    try {
      const { ticket: updated } = await staffAssignTicket(ticket.id, assignModal.assigneeId, token);
      replaceTicket(updated ?? { ...ticket, assignedAdminId: assignModal.assigneeId });
      setAssignModal({ ticket: null, assigneeId: "", saving: false, error: "" });
      onChanged?.();
    } catch (e) {
      setAssignModal((c) => ({ ...c, saving: false, error: e instanceof Error ? e.message : "No se pudo reasignar." }));
    }
  };

  const rows = tab === "queue" ? tickets : spam;

  const renderTicket = (ticket: Ticket) => {
    const statusColor = STATUS_COLORS[ticket.status] ?? tokens.textMuted;
    const statusLabel = (t.ticketTable.statusBadges as Record<string, string>)[ticket.status] ?? ticket.status;
    const assignedName = ticket.assignedAdmin?.name || ticket.assignedAdmin?.email || null;
    const customerName = ticket.customer?.name || ticket.customer?.email || ticket.customerId || "—";
    const busy = busyId === ticket.id;

    return (
      <View key={ticket.id} style={[styles.ticketCard, { borderColor: tokens.border, backgroundColor: tokens.bgCard, opacity: busy ? 0.6 : 1 }]}>
        <Text numberOfLines={2} style={[styles.ticketTitle, { color: tokens.textPrimary, textAlign }]}>
          {ticket.title}
        </Text>
        {/* TODO(i18n): "Cliente" */}
        <Text style={[styles.ticketMeta, { color: tokens.textMuted, textAlign }]}>Cliente: {customerName}</Text>
        {/* TODO(i18n): "Asignado a" / "Sin asignar" */}
        <Text style={[styles.ticketMeta, { color: tokens.textMuted, textAlign }]}>
          Asignado a: {assignedName ?? "Sin asignar"}
        </Text>
        {tab === "spam" && ticket.triageReason ? (
          // TODO(i18n): "Motivo triage"
          <Text style={[styles.ticketMeta, { color: tokens.warning, textAlign }]}>Motivo triage: {ticket.triageReason}</Text>
        ) : null}

        <View style={[styles.statusRow, { flexDirection: rowDirection }]}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22`, flexDirection: rowDirection }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {tab === "queue" ? (
          <View style={styles.actionsCol}>
            <View style={styles.statusSelectWrap}>
              {/* TODO(i18n): "Estado" */}
              <Text style={[styles.fieldLabel, { color: tokens.textSecondary, textAlign }]}>Estado</Text>
              <Select
                value={ticket.status}
                options={statusOptions}
                onChange={(v) => void handleStatusChange(ticket, v as TicketStatus)}
              />
            </View>
            <Button
              label="Reasignar"
              variant="secondary"
              size="sm"
              icon={<UserCog size={14} />}
              disabled={busy}
              onPress={() => openAssign(ticket)}
            />
          </View>
        ) : (
          <View style={[styles.spamActions, { flexDirection: rowDirection }]}>
            <Button
              label="No es spam"
              variant="primary"
              size="sm"
              disabled={busy}
              onPress={() => void handleNotSpam(ticket)}
            />
            <Button
              label="Re-clasificar"
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              disabled={busy}
              onPress={() => void handleRetriage(ticket)}
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <FormSheet
        visible={visible}
        onClose={onClose}
        // TODO(i18n): "Soporte (staff)"
        title="Soporte (staff)"
        language={language}
        footer={(
          <Button label={t.common.close} variant="ghost" onPress={onClose} />
        )}
      >
        <View style={[styles.tabsRow, { flexDirection: rowDirection }]}>
          <Pressable
            onPress={() => setTab("queue")}
            style={[styles.tabBtn, { borderColor: tokens.border, backgroundColor: tab === "queue" ? tokens.brandDim : "transparent", flexDirection: rowDirection }]}
          >
            <Inbox size={15} color={tab === "queue" ? tokens.brand : tokens.textMuted} />
            {/* TODO(i18n): "Cola" */}
            <Text style={[styles.tabText, { color: tab === "queue" ? tokens.brand : tokens.textMuted }]}>Cola ({tickets.length})</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("spam")}
            style={[styles.tabBtn, { borderColor: tokens.border, backgroundColor: tab === "spam" ? tokens.brandDim : "transparent", flexDirection: rowDirection }]}
          >
            <ShieldAlert size={15} color={tab === "spam" ? tokens.brand : tokens.textMuted} />
            {/* TODO(i18n): "Spam" */}
            <Text style={[styles.tabText, { color: tab === "spam" ? tokens.brand : tokens.textMuted }]}>Spam ({spam.length})</Text>
          </Pressable>
          <Pressable
            onPress={() => void load()}
            disabled={loading}
            style={[styles.refreshBtn, { borderColor: tokens.border }]}
            accessibilityLabel={t.common.refresh}
          >
            {loading ? <ActivityIndicator size="small" color={tokens.brand} /> : <RefreshCw size={15} color={tokens.textMuted} />}
          </Pressable>
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: tokens.danger, textAlign }]}>{error}</Text>
        ) : null}

        {loading && rows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.brand} />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.center}>
            {/* TODO(i18n): "Sin tickets" */}
            <Text style={{ color: tokens.textMuted }}>Sin tickets.</Text>
          </View>
        ) : (
          <View style={styles.list}>{rows.map(renderTicket)}</View>
        )}
      </FormSheet>

      <FormSheet
        visible={assignModal.ticket !== null}
        onClose={() => { if (!assignModal.saving) setAssignModal({ ticket: null, assigneeId: "", saving: false, error: "" }); }}
        // TODO(i18n): "Reasignar ticket"
        title="Reasignar ticket"
        language={language}
        footer={(
          <>
            <Button
              label={t.common.cancel}
              variant="ghost"
              disabled={assignModal.saving}
              onPress={() => setAssignModal({ ticket: null, assigneeId: "", saving: false, error: "" })}
            />
            <Button
              label={t.common.save}
              variant="primary"
              loading={assignModal.saving}
              disabled={assignModal.saving || !assignModal.assigneeId}
              onPress={() => void confirmAssign()}
            />
          </>
        )}
      >
        {/* TODO(i18n): "Agente" */}
        <Text style={[styles.fieldLabel, { color: tokens.textSecondary, textAlign }]}>Agente</Text>
        <Select
          value={assignModal.assigneeId}
          options={agentOptions}
          // TODO(i18n): "Selecciona un agente"
          placeholder="Selecciona un agente"
          onChange={(v) => setAssignModal((c) => ({ ...c, assigneeId: v }))}
        />
        {assignModal.error ? (
          <Text style={[styles.errorText, { color: tokens.danger, textAlign }]}>{assignModal.error}</Text>
        ) : null}
      </FormSheet>
    </>
  );
}
