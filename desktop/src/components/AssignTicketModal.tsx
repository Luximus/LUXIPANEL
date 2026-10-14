import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { staffAssignTicket, staffListAgents, type StaffAgent, type StaffTicket } from "../api/client";
import { useToast } from "./ToastProvider";

// TODO(i18n): etiquetas en español embebidas; mover a i18n/messages cuando el
// otro agente añada las claves del admin de tickets de staff.

/**
 * Modal de reasignación de un ticket de staff. Carga el roster de agentes
 * (soporte + admins) y muestra para cada uno `nombre · email · casos activos`.
 */
export function AssignTicketModal({
  ticket,
  token,
  onClose,
  onAssigned,
}: {
  ticket: StaffTicket | null;
  token: string;
  onClose: () => void;
  onAssigned: (ticket: StaffTicket) => void;
}) {
  const toast = useToast();
  const [support, setSupport] = useState<StaffAgent[]>([]);
  const [admins, setAdmins] = useState<StaffAgent[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ticket) return;
    setAssigneeId(ticket.assignedAdminId ?? "");
    setError("");
    setLoading(true);
    void staffListAgents(token)
      .then((data) => {
        setSupport(data.support);
        setAdmins(data.admins);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los agentes"))
      .finally(() => setLoading(false));
  }, [ticket, token]);

  if (!ticket) return null;

  const renderOption = (agent: StaffAgent) => {
    const label = [agent.name || agent.email || agent.id, agent.email && agent.name ? agent.email : null]
      .filter(Boolean)
      .join(" · ");
    const cases = typeof agent.activeCases === "number" ? ` · ${agent.activeCases} casos` : "";
    return (
      <option key={agent.id} value={agent.id}>
        {label}{cases}
      </option>
    );
  };

  const submit = async () => {
    if (!assigneeId) { setError("Selecciona un agente"); return; }
    setSaving(true);
    setError("");
    try {
      const updated = await staffAssignTicket(ticket.id, assigneeId, token);
      if (updated) onAssigned(updated);
      else onAssigned({ ...ticket, assignedAdminId: assigneeId });
      toast.success("Ticket reasignado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reasignar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          {/* TODO(i18n) */}
          <h3 className="lp-modal-title">Reasignar ticket</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label="Cerrar" disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3 overflow-y-auto">
          <p className="text-sm opacity-70">{ticket.title}</p>

          <label className="lp-modal-label flex flex-col gap-1">
            {/* TODO(i18n) */}
            <span>Agente asignado</span>
            <select
              className="lp-modal-input"
              value={assigneeId}
              disabled={saving || loading}
              onChange={(e) => { setAssigneeId(e.target.value); setError(""); }}
            >
              <option value="">{loading ? "Cargando agentes…" : "Selecciona un agente"}</option>
              {support.length > 0 ? (
                <optgroup label="Soporte">
                  {support.map(renderOption)}
                </optgroup>
              ) : null}
              {admins.length > 0 ? (
                <optgroup label="Administradores">
                  {admins.map(renderOption)}
                </optgroup>
              ) : null}
            </select>
          </label>

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          {/* TODO(i18n) */}
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={saving || loading}>
            {saving ? "Guardando…" : "Reasignar"}
          </button>
        </div>
      </div>
    </div>
  );
}
