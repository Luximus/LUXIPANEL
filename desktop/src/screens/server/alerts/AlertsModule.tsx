/**
 * AlertsModule (desktop) — pantalla NATIVA del módulo Notificaciones
 * (server-alerts) de un servidor standalone (conexión DIRECTA por `serverApi`).
 * Port React DOM COMPLETO de `app/src/screens/server/alerts/ServerAlertsScreen.tsx`,
 * conservando estilos (Tailwind + daisyUI + lucide-react), i18n
 * (`getMessages(...).serverAlerts`) y contrato (`serverAlertsApi` + `callServerApi`,
 * token `""` en modo directo).
 *
 * Paridad con app: pestañas Preferencias / Programadas / Reglas; preferencias
 * (push owner + umbrales CPU/RAM/disco) con guardado; enviar notificación ad-hoc;
 * CRUD de notificaciones programadas (una vez / cron) y de reglas de métrica
 * (cpu/ram/disk/load/service-down) con confirmación de borrado y toasts.
 *
 * NOTA: el residuo MB (umbral `lowMbThreshold`) se retiró del modelo y NO se
 * porta aquí aunque la fuente de app aún lo declare.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BellRing, Plus, RefreshCw, Save, X } from "lucide-react";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableRowActionConfig,
} from "../../../components/DataTable";
import { useConfirm } from "../../../components/ConfirmDialog";
import { useToast } from "../../../components/ToastProvider";
import {
  serverAlertsApi,
  unwrap,
  withJob,
  type GatewayGuardCode,
  type GatewayResponse,
} from "../../../api/serverApi";
import { getMessages } from "../../../i18n";
import type { ModuleProps } from "../module-host";

const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];

// El campo MB (`lowMbThreshold`) se dejó fuera a propósito: el modelo lo retiró.
type Prefs = {
  enabled?: boolean;
  statusEnabled?: boolean;
  accessEnabled?: boolean;
  cpuPct?: number;
  ramPct?: number;
  diskPct?: number;
};
type Scheduled = { id: string; title: string; body: string; scheduleAt?: string | null; cron?: string | null; recurring?: boolean; enabled?: boolean };
type Rule = { id: string; name: string; metric: string; op: string; threshold?: number | null; service?: string | null; enabled?: boolean; cooldownMinutes?: number };

/** Filas planas para el DataTable de desktop (keys ordenables/filtrables). */
type SchedRow = { id: string; title: string; whenText: string; enabled: boolean };
type RuleRow = { id: string; name: string; metric: string; condition: string; enabled: boolean };

/** Espejo del `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
async function runServerMutation(
  serverId: string,
  op: () => Promise<GatewayResponse>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await op();
    if (res.code && GUARDS.includes(res.code)) return { ok: false, error: res.code };
    if (!res.ok) {
      const panel = res.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: panel?.error ?? panel?.message ?? res.error };
    }
    await withJob(res, serverId, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

export function AlertsModule({ serverId, language }: ModuleProps) {
  const t = getMessages(language).serverAlerts;
  const c = getMessages(language).common;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [tab, setTab] = useState<"prefs" | "scheduled" | "rules">("prefs");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardCode, setGuardCode] = useState<GatewayGuardCode | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [schedDialog, setSchedDialog] = useState<{ mode: "create" | "edit"; row?: Scheduled } | null>(null);
  const [ruleDialog, setRuleDialog] = useState<{ mode: "create" | "edit"; row?: Rule } | null>(null);

  // ── Carga (mismo contrato/paths que app) ────────────────────────────────
  const load = useCallback(async () => {
    const [pr, sc, ru] = await Promise.all([
      serverAlertsApi.getPrefs(serverId, ""),
      serverAlertsApi.listScheduled(serverId, ""),
      serverAlertsApi.listRules(serverId, ""),
    ]);
    if (pr.code && GUARDS.includes(pr.code)) {
      setGuardCode(pr.code as GatewayGuardCode);
      return;
    }
    setGuardCode(null);
    setPrefs(unwrap<Prefs>(pr) ?? {});
    setScheduled((unwrap<Scheduled[]>(sc) ?? []).filter(Boolean));
    setRules((unwrap<Rule[]>(ru) ?? []).filter(Boolean));
  }, [serverId]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const savePrefs = useCallback(async () => {
    setSavingPrefs(true);
    const out = await runServerMutation(serverId, () => serverAlertsApi.setPrefs(serverId, "", prefs));
    setSavingPrefs(false);
    if (out.ok) toast.success(t.toasts.saved);
    else toast.error(out.error ?? t.toasts.error);
  }, [serverId, prefs, toast, t]);

  const confirmDelete = useCallback(
    async (kind: "scheduled" | "rule", id: string) => {
      const accepted = await confirm({
        title: t.confirm.deleteTitle,
        message: t.confirm.delete,
        confirmLabel: t.confirm.confirm,
        cancelLabel: t.confirm.cancel,
        danger: true,
      });
      if (!accepted) return;
      setDeleting(true);
      const op =
        kind === "scheduled"
          ? () => serverAlertsApi.deleteScheduled(serverId, "", id)
          : () => serverAlertsApi.deleteRule(serverId, "", id);
      const out = await runServerMutation(serverId, op);
      setDeleting(false);
      if (out.ok) {
        toast.success(t.toasts.deleted);
        void load();
      } else toast.error(out.error ?? t.toasts.error);
    },
    [confirm, serverId, toast, load, t],
  );

  // ── Tablas ───────────────────────────────────────────────────────────────
  const enabledPill = useCallback(
    (on: boolean): ReactNode => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-success/15 text-success" : "bg-base-300 text-base-content/50"}`}
      >
        {on ? t.scheduled.enabled : "—"}
      </span>
    ),
    [t],
  );

  const schedRows = useMemo<SchedRow[]>(
    () =>
      scheduled.map((r) => ({
        id: r.id,
        title: r.title,
        whenText: r.cron || (r.scheduleAt ? new Date(r.scheduleAt).toLocaleString() : "—"),
        enabled: r.enabled !== false,
      })),
    [scheduled],
  );
  const schedColumns = useMemo<DataTableColumnConfig<SchedRow>[]>(
    () => [
      { id: "title", header: t.scheduled.colTitle, accessorKey: "title" },
      { id: "when", header: t.scheduled.colWhen, accessorKey: "whenText", cell: (r) => <span className="font-mono text-xs">{r.whenText}</span> },
      { id: "enabled", header: t.scheduled.colEnabled, accessorKey: "enabled", cell: (r) => enabledPill(r.enabled) },
    ],
    [t, enabledPill],
  );

  const ruleRows = useMemo<RuleRow[]>(
    () =>
      rules.map((r) => ({
        id: r.id,
        name: r.name,
        metric: r.metric,
        condition: r.metric === "service-down" ? `${r.service ?? ""} down` : `${r.op} ${r.threshold ?? ""}`,
        enabled: r.enabled !== false,
      })),
    [rules],
  );
  const ruleColumns = useMemo<DataTableColumnConfig<RuleRow>[]>(
    () => [
      { id: "name", header: t.rules.colName, accessorKey: "name" },
      { id: "metric", header: t.rules.colMetric, accessorKey: "metric", cell: (r) => <span className="font-mono text-xs">{r.metric}</span> },
      { id: "cond", header: t.rules.colCondition, accessorKey: "condition", cell: (r) => <span className="font-mono text-xs">{r.condition}</span> },
      { id: "enabled", header: t.rules.colEnabled, accessorKey: "enabled", cell: (r) => enabledPill(r.enabled) },
    ],
    [t, enabledPill],
  );

  const schedActions = useMemo<DataTableRowActionConfig<SchedRow>[]>(
    () => [
      { id: "edit", label: c.edit },
      { id: "delete", label: c.delete, variant: "danger" },
    ],
    [c],
  );
  const ruleActions = useMemo<DataTableRowActionConfig<RuleRow>[]>(
    () => [
      { id: "edit", label: c.edit },
      { id: "delete", label: c.delete, variant: "danger" },
    ],
    [c],
  );

  // ── Render ──────────────────────────────────────────────────────────────
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
      </div>
    );
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "prefs", label: t.tabs.prefs },
    { key: "scheduled", label: t.tabs.scheduled },
    { key: "rules", label: t.tabs.rules },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera + enviar ahora + refrescar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-base font-semibold">{t.pageTitle}</h2>
          <p className="text-xs text-base-content/60">{t.subtitle}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => setSendOpen(true)}>
          <BellRing size={14} /> {t.sendNow}
        </button>
        <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => void onRefresh()} disabled={refreshing}>
          {refreshing ? <span className="loading loading-spinner loading-xs" /> : <RefreshCw size={14} />} {c.refresh}
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1.5">
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

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : tab === "prefs" ? (
        <div className="flex max-w-2xl flex-col gap-4 rounded-xl border border-base-300 bg-base-100 p-4">
          <ToggleRow label={t.prefs.enabled} checked={prefs.enabled !== false} onChange={(v) => setPrefs((p) => ({ ...p, enabled: v }))} />
          <ToggleRow label={t.prefs.statusEnabled} checked={!!prefs.statusEnabled} onChange={(v) => setPrefs((p) => ({ ...p, statusEnabled: v }))} />
          <ToggleRow label={t.prefs.accessEnabled} checked={!!prefs.accessEnabled} onChange={(v) => setPrefs((p) => ({ ...p, accessEnabled: v }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField label={t.prefs.cpuPct} value={prefs.cpuPct} onChange={(v) => setPrefs((p) => ({ ...p, cpuPct: v }))} />
            <NumberField label={t.prefs.ramPct} value={prefs.ramPct} onChange={(v) => setPrefs((p) => ({ ...p, ramPct: v }))} />
            <NumberField label={t.prefs.diskPct} value={prefs.diskPct} onChange={(v) => setPrefs((p) => ({ ...p, diskPct: v }))} />
          </div>
          <button type="button" className="btn btn-primary btn-sm w-fit gap-1.5" onClick={() => void savePrefs()} disabled={savingPrefs}>
            {savingPrefs ? <span className="loading loading-spinner loading-xs" /> : <Save size={14} />}
            {t.prefs.save}
          </button>
        </div>
      ) : tab === "scheduled" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => setSchedDialog({ mode: "create" })}>
              <Plus size={14} /> {t.scheduled.new}
            </button>
          </div>
          <DataTable<SchedRow>
            tableId="server-alerts-scheduled"
            title={t.tabs.scheduled}
            data={schedRows}
            columns={schedColumns}
            rowActions={schedActions}
            language={language}
            loading={deleting}
            onRowAction={(actionId, row) => {
              if (actionId === "edit") {
                const full = scheduled.find((s) => s.id === row.id);
                if (full) setSchedDialog({ mode: "edit", row: full });
              } else if (actionId === "delete") void confirmDelete("scheduled", row.id);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button type="button" className="btn btn-sm btn-outline gap-1" onClick={() => setRuleDialog({ mode: "create" })}>
              <Plus size={14} /> {t.rules.new}
            </button>
          </div>
          <DataTable<RuleRow>
            tableId="server-alerts-rules"
            title={t.tabs.rules}
            data={ruleRows}
            columns={ruleColumns}
            rowActions={ruleActions}
            language={language}
            loading={deleting}
            onRowAction={(actionId, row) => {
              if (actionId === "edit") {
                const full = rules.find((r) => r.id === row.id);
                if (full) setRuleDialog({ mode: "edit", row: full });
              } else if (actionId === "delete") void confirmDelete("rule", row.id);
            }}
          />
        </div>
      )}

      {sendOpen ? (
        <SendDialog
          serverId={serverId}
          language={language}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            setSendOpen(false);
            toast.success(t.toasts.sent);
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {schedDialog ? (
        <ScheduledDialog
          serverId={serverId}
          language={language}
          mode={schedDialog.mode}
          row={schedDialog.row}
          onClose={() => setSchedDialog(null)}
          onSaved={() => {
            setSchedDialog(null);
            toast.success(t.toasts.saved);
            void load();
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {ruleDialog ? (
        <RuleDialog
          serverId={serverId}
          language={language}
          mode={ruleDialog.mode}
          row={ruleDialog.row}
          onClose={() => setRuleDialog(null)}
          onSaved={() => {
            setRuleDialog(null);
            toast.success(t.toasts.saved);
            void load();
          }}
          onError={(e) => toast.error(e ?? t.toasts.error)}
        />
      ) : null}

      {dialog}
    </div>
  );
}

// ── Subcomponentes de formulario ─────────────────────────────────────────────

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      <input
        type="number"
        className="input input-bordered input-sm"
        value={value != null ? String(value) : ""}
        placeholder="0"
        min={0}
        max={100}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

/** Cascarón de modal reutilizable (mismas clases `lp-modal-*` del resto de desktop). */
function ModalShell({
  title,
  onClose,
  closeLabel,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
      <div className={`lp-modal-card flex max-h-full w-full ${maxWidth} flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{title}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-modal-body flex flex-col gap-3">{children}</div>
        <div className="lp-modal-footer">{footer}</div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-base-content/70">{label}</span>
      {multiline ? (
        <textarea className="textarea textarea-bordered w-full" rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className="input input-bordered input-sm w-full" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function SendDialog({
  serverId,
  language,
  onClose,
  onSent,
  onError,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSent: () => void;
  onError: (e?: string) => void;
}) {
  const t = getMessages(language).serverAlerts;
  const c = getMessages(language).common;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const out = await runServerMutation(serverId, () => serverAlertsApi.send(serverId, "", { title, body }));
    setBusy(false);
    if (out.ok) onSent();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={t.sendDialog.title}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.sendDialog.cancel}
          </button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : t.sendDialog.send}
          </button>
        </>
      }
    >
      <TextField label={t.sendDialog.labelTitle} value={title} onChange={setTitle} />
      <TextField label={t.sendDialog.labelBody} value={body} onChange={setBody} multiline />
    </ModalShell>
  );
}

function ScheduledDialog({
  serverId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  mode: "create" | "edit";
  row?: Scheduled;
  onClose: () => void;
  onSaved: () => void;
  onError: (e?: string) => void;
}) {
  const t = getMessages(language).serverAlerts;
  const c = getMessages(language).common;
  const [title, setTitle] = useState(row?.title ?? "");
  const [body, setBody] = useState(row?.body ?? "");
  const [recurring, setRecurring] = useState(!!row?.cron);
  const [date, setDate] = useState(row?.scheduleAt ?? "");
  const [cron, setCron] = useState(row?.cron ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const payload = { title, body, enabled, ...(recurring ? { cron, recurring: true, scheduleAt: null } : { scheduleAt: date, recurring: false, cron: null }) };
    const op = mode === "edit" && row ? () => serverAlertsApi.updateScheduled(serverId, "", row.id, payload) : () => serverAlertsApi.createScheduled(serverId, "", payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={t.scheduled.dialogTitle}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.scheduled.cancel}
          </button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : t.scheduled.save}
          </button>
        </>
      }
    >
      <TextField label={t.scheduled.labelTitle} value={title} onChange={setTitle} />
      <TextField label={t.scheduled.labelBody} value={body} onChange={setBody} multiline />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-base-content/70">{t.scheduled.labelMode}</span>
        <select className="select select-bordered select-sm w-full" value={recurring ? "cron" : "once"} onChange={(e) => setRecurring(e.target.value === "cron")}>
          <option value="once">{t.scheduled.modeOnce}</option>
          <option value="cron">{t.scheduled.modeCron}</option>
        </select>
      </label>
      {recurring ? (
        <TextField label={t.scheduled.labelCron} value={cron} onChange={setCron} placeholder={t.scheduled.placeholderCron} />
      ) : (
        <TextField label={t.scheduled.labelDate} value={date} onChange={setDate} placeholder="2026-06-30T09:00:00Z" />
      )}
      <ToggleRow label={t.scheduled.enabled} checked={enabled} onChange={setEnabled} />
    </ModalShell>
  );
}

function RuleDialog({
  serverId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  mode: "create" | "edit";
  row?: Rule;
  onClose: () => void;
  onSaved: () => void;
  onError: (e?: string) => void;
}) {
  const t = getMessages(language).serverAlerts;
  const c = getMessages(language).common;
  const [name, setName] = useState(row?.name ?? "");
  const [metric, setMetric] = useState(row?.metric ?? "cpu");
  const [op, setOp] = useState(row?.op ?? ">=");
  const [threshold, setThreshold] = useState(row?.threshold != null ? String(row.threshold) : "");
  const [service, setService] = useState(row?.service ?? "");
  const [cooldown, setCooldown] = useState(String(row?.cooldownMinutes ?? 30));
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);
  const isServiceDown = metric === "service-down";
  const submit = async () => {
    setBusy(true);
    const payload = {
      name,
      metric,
      op: isServiceDown ? "down" : op,
      threshold: isServiceDown ? null : Number(threshold) || 0,
      service: isServiceDown ? service : null,
      cooldownMinutes: Number(cooldown) || 30,
      enabled,
    };
    const opFn = mode === "edit" && row ? () => serverAlertsApi.updateRule(serverId, "", row.id, payload) : () => serverAlertsApi.createRule(serverId, "", payload);
    const out = await runServerMutation(serverId, opFn);
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };
  return (
    <ModalShell
      title={t.rules.dialogTitle}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {t.rules.cancel}
          </button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy} onClick={() => void submit()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : t.rules.save}
          </button>
        </>
      }
    >
      <TextField label={t.rules.labelName} value={name} onChange={setName} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-base-content/70">{t.rules.labelMetric}</span>
        <select className="select select-bordered select-sm w-full" value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="cpu">{t.rules.metricCpu}</option>
          <option value="ram">{t.rules.metricRam}</option>
          <option value="disk">{t.rules.metricDisk}</option>
          <option value="load">{t.rules.metricLoad}</option>
          <option value="service-down">{t.rules.metricServiceDown}</option>
        </select>
      </label>
      {isServiceDown ? (
        <TextField label={t.rules.labelService} value={service} onChange={setService} placeholder="nginx" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-base-content/70">{t.rules.labelOp}</span>
            <select className="select select-bordered select-sm w-full" value={op} onChange={(e) => setOp(e.target.value)}>
              <option value=">=">≥</option>
              <option value="<=">≤</option>
              <option value="==">=</option>
            </select>
          </label>
          <TextField label={t.rules.labelThreshold} value={threshold} onChange={setThreshold} type="number" />
        </div>
      )}
      <TextField label={t.rules.labelCooldown} value={cooldown} onChange={setCooldown} type="number" />
      <ToggleRow label={t.rules.enabled} checked={enabled} onChange={setEnabled} />
    </ModalShell>
  );
}
