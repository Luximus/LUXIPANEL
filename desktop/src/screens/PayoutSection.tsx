import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, Pencil, Trash2, Star, Wallet } from "lucide-react";
import styles from "./PaymentsScreen.module.css";
import { getMessages, formatMessage } from "../i18n";
import {
  getPayoutConfig, getPayoutMethods, createPayoutMethod, updatePayoutMethod, deletePayoutMethod,
  requestPayout, getPayoutRequests, quoteTokensToUsd,
  type PayoutConfig, type PayoutMethodDTO, type PayoutRequestDTO, type PayoutMethodType, type PayoutRequestStatus,
} from "../api/payouts";

type Msgs = ReturnType<typeof getMessages>["payouts"];

const METHOD_TYPES: PayoutMethodType[] = ["paypal", "bank", "wompi", "binance", "other"];

// Campos sensibles (`details`) por tipo de método. La clave es la del payload
// que cifra el backend; el label es i18n.
function fieldsForType(p: Msgs, type: PayoutMethodType): Array<{ key: string; label: string; type?: string }> {
  switch (type) {
    case "paypal":
      return [{ key: "email", label: p.fieldPaypalEmail, type: "email" }];
    case "bank":
      return [
        { key: "holder", label: p.fieldBankHolder },
        { key: "bankName", label: p.fieldBankName },
        { key: "accountNumber", label: p.fieldBankAccount },
        { key: "accountType", label: p.fieldBankType },
        { key: "document", label: p.fieldBankDocument },
      ];
    case "wompi":
      return [{ key: "phone", label: p.fieldWompiPhone }];
    case "binance":
      return [
        { key: "binanceId", label: p.fieldBinanceId },
        { key: "network", label: p.fieldBinanceNetwork },
      ];
    case "other":
    default:
      return [{ key: "details", label: p.fieldOther }];
  }
}

function typeLabel(p: Msgs, type: string): string {
  switch (type) {
    case "paypal": return p.typePaypal;
    case "bank": return p.typeBank;
    case "wompi": return p.typeWompi;
    case "binance": return p.typeBinance;
    default: return p.typeOther;
  }
}

function statusLabel(p: Msgs, status: PayoutRequestStatus): string {
  switch (status) {
    case "requested": return p.statusRequested;
    case "approved": return p.statusApproved;
    case "rejected": return p.statusRejected;
    case "paid": return p.statusPaid;
    default: return status;
  }
}

function statusClass(status: PayoutRequestStatus): string {
  switch (status) {
    case "requested": return styles.statusRequested;
    case "approved": return styles.statusApproved;
    case "rejected": return styles.statusRejected;
    case "paid": return styles.statusPaid;
    default: return "";
  }
}

// Resumen no sensible del método (de `mask`) para mostrar en la fila.
function maskSummary(mask: Record<string, string>): string {
  const vals = Object.values(mask).filter(Boolean);
  return vals.join(" · ");
}

export function PayoutSection({ language, token }: { language: string; token: string }) {
  const t = getMessages(language);
  const p = t.payouts;
  const isEs = language.startsWith("es");
  const intlLocale = isEs ? "es-CO" : language;
  const intFmt = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale]);
  const usdFmt = useMemo(
    () => new Intl.NumberFormat(intlLocale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [intlLocale],
  );

  const [config, setConfig] = useState<PayoutConfig | null>(null);
  const [methods, setMethods] = useState<PayoutMethodDTO[]>([]);
  const [requests, setRequests] = useState<PayoutRequestDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Error específico del historial: no debe vaciar el resto de la pestaña.
  const [requestsError, setRequestsError] = useState("");

  // Conversor.
  const [convertTokens, setConvertTokens] = useState<string>("");

  // Formulario de método (crear/editar).
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<PayoutMethodType>("paypal");
  const [formLabel, setFormLabel] = useState("");
  const [formDetails, setFormDetails] = useState<Record<string, string>>({});
  const [formDefault, setFormDefault] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  // Solicitud de retiro.
  const [reqMethodId, setReqMethodId] = useState<string>("");
  const [reqAmount, setReqAmount] = useState<string>("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    setRequestsError("");
    // Cada sección carga de forma independiente (igual que el portal web): un
    // fallo en una (p.ej. el historial) no debe vaciar TODA la pestaña. Solo el
    // fallo de `config` (datos esenciales: balance + tasa) muestra error global.
    const [cfgR, msR, rsR] = await Promise.allSettled([
      getPayoutConfig(token),
      getPayoutMethods(token),
      getPayoutRequests(token),
    ]);
    if (cfgR.status === "fulfilled") {
      setConfig(cfgR.value);
    } else {
      setError(cfgR.reason instanceof Error ? cfgR.reason.message : p.loadError);
    }
    if (msR.status === "fulfilled") {
      setMethods(msR.value);
      // Predeterminado seleccionado por defecto en la solicitud.
      const def = msR.value.find((m) => m.isDefault) ?? msR.value[0];
      if (def) setReqMethodId((prev) => prev || def.id);
    }
    if (rsR.status === "fulfilled") {
      setRequests(rsR.value);
    } else {
      setRequests([]);
      setRequestsError(rsR.reason instanceof Error ? rsR.reason.message : p.loadError);
    }
    setBusy(false);
  }, [token, p.loadError]);

  useEffect(() => { void load(); }, [load]);

  const rate = config?.tokenUsdRate ?? 0;
  const minTokens = config?.minTokens ?? 0;
  const available = config?.balance.available ?? 0;

  const convertUsd = quoteTokensToUsd(Number(convertTokens) || 0, rate);

  const openCreate = () => {
    setEditingId(null);
    setFormType("paypal");
    setFormLabel("");
    setFormDetails({});
    setFormDefault(methods.length === 0);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (m: PayoutMethodDTO) => {
    setEditingId(m.id);
    setFormType((METHOD_TYPES as string[]).includes(m.type) ? (m.type as PayoutMethodType) : "other");
    setFormLabel(m.label);
    setFormDetails({}); // los detalles cifrados no se devuelven: se reescriben si se editan
    setFormDefault(m.isDefault);
    setFormError("");
    setFormOpen(true);
  };

  const submitForm = async () => {
    setFormError("");
    if (!formLabel.trim()) { setFormError(p.errorNoMethod); return; }
    setFormBusy(true);
    try {
      const details: Record<string, string> = {};
      for (const f of fieldsForType(p, formType)) {
        const v = formDetails[f.key]?.trim();
        if (v) details[f.key] = v;
      }
      if (editingId) {
        const payload: { label: string; isDefault: boolean; details?: Record<string, string> } = {
          label: formLabel.trim(),
          isDefault: formDefault,
        };
        // Solo reenvía details si el usuario los rellenó (evita borrar los cifrados).
        if (Object.keys(details).length > 0) payload.details = details;
        await updatePayoutMethod(editingId, payload, token);
      } else {
        await createPayoutMethod({ type: formType, label: formLabel.trim(), details, isDefault: formDefault }, token);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : p.loadError);
    } finally {
      setFormBusy(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const removeMethod = async (id: string) => {
    if (!window.confirm(p.deleteConfirm)) return;
    setDeletingId(id);
    try {
      await deletePayoutMethod(id, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : p.loadError);
    } finally {
      setDeletingId(null);
    }
  };

  const makeDefault = async (m: PayoutMethodDTO) => {
    try {
      await updatePayoutMethod(m.id, { isDefault: true }, token);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : p.loadError);
    }
  };

  const submitRequest = async () => {
    setReqError("");
    setReqSuccess("");
    const amount = Math.floor(Number(reqAmount) || 0);
    if (!reqMethodId) { setReqError(p.errorNoMethod); return; }
    if (amount < minTokens) { setReqError(formatMessage(p.errorMin, { min: intFmt.format(minTokens) })); return; }
    if (amount > available) { setReqError(p.errorInsufficient); return; }
    setReqBusy(true);
    try {
      await requestPayout({ methodId: reqMethodId, amountTokens: amount }, token);
      setReqSuccess(p.requestSuccess);
      setReqAmount("");
      await load();
    } catch (e) {
      setReqError(e instanceof Error ? e.message : p.loadError);
    } finally {
      setReqBusy(false);
    }
  };

  if (error && !config) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <p className="text-sm text-error">{error}</p>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => void load()}>{p.retry}</button>
      </div>
    );
  }

  if (busy && !config) {
    return <div className="mt-3 flex gap-4 flex-wrap">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 w-48 rounded-2xl" />)}</div>;
  }

  return (
    <div className="mt-3">
      {/* Balance + tasa */}
      <h3 className="mb-3 text-sm font-semibold opacity-70">{p.balanceTitle}</h3>
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="glance-card">
          <span className="glance-card__label">{p.available}</span>
          <span className="glance-card__value">{intFmt.format(available)}</span>
          <span className="glance-card__meta">{usdFmt.format(quoteTokensToUsd(available, rate))}</span>
        </div>
        <div className="glance-card">
          <span className="glance-card__label">{p.earned}</span>
          <span className="glance-card__value">{intFmt.format(config?.balance.earned ?? 0)}</span>
        </div>
        <div className="glance-card">
          <span className="glance-card__label">{p.pendingPayout}</span>
          <span className="glance-card__value">{intFmt.format(config?.balance.pendingPayout ?? 0)}</span>
        </div>
        <div className="glance-card">
          <span className="glance-card__label">{p.rate}</span>
          <span className="glance-card__value">{usdFmt.format(rate)}</span>
          <span className="glance-card__meta">{p.ratePerToken}</span>
        </div>
      </div>

      {/* Conversor */}
      <h3 className="mb-3 text-sm font-semibold opacity-70">{p.converterTitle}</h3>
      <div className={`${styles.converter} mb-6`}>
        <div className={styles.converterField}>
          <label htmlFor="payout-convert-tokens">{p.converterTokensLabel}</label>
          <input
            id="payout-convert-tokens"
            type="number"
            min={0}
            className="input input-sm input-bordered"
            value={convertTokens}
            onChange={(e) => setConvertTokens(e.target.value)}
            placeholder="0"
          />
        </div>
        <ArrowRight size={18} className={styles.converterArrow} />
        <div className={styles.converterField}>
          <label>{p.converterUsdLabel}</label>
          <span className={styles.converterUsd}>{usdFmt.format(convertUsd)}</span>
        </div>
        {minTokens > 0 ? (
          <p className={styles.converterMin}>{formatMessage(p.minHint, { min: intFmt.format(minTokens) })}</p>
        ) : null}
      </div>

      {/* Métodos */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold opacity-70">{p.methodsTitle}</h3>
        <button type="button" className="btn btn-sm btn-outline" onClick={openCreate}>
          <Plus size={15} /> {p.addMethod}
        </button>
      </div>

      {formOpen ? (
        <div className={`${styles.methodForm} mb-4`}>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label htmlFor="payout-form-type">{p.methodType}</label>
              <select
                id="payout-form-type"
                className="select select-sm select-bordered"
                value={formType}
                disabled={!!editingId}
                onChange={(e) => { setFormType(e.target.value as PayoutMethodType); setFormDetails({}); }}
              >
                {METHOD_TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(p, ty)}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label htmlFor="payout-form-label">{p.methodLabel}</label>
              <input
                id="payout-form-label"
                className="input input-sm input-bordered"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder={p.methodLabelPlaceholder}
              />
            </div>
            {fieldsForType(p, formType).map((f) => (
              <div key={f.key} className={styles.formField}>
                <label htmlFor={`payout-field-${f.key}`}>{f.label}</label>
                <input
                  id={`payout-field-${f.key}`}
                  type={f.type ?? "text"}
                  className="input input-sm input-bordered"
                  value={formDetails[f.key] ?? ""}
                  onChange={(e) => setFormDetails((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={formDefault} onChange={(e) => setFormDefault(e.target.checked)} />
            {p.setDefault}
          </label>
          {formError ? <p className={styles.formError}>{formError}</p> : null}
          <div className={styles.formActions}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFormOpen(false)} disabled={formBusy}>{p.cancel}</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void submitForm()} disabled={formBusy}>
              {formBusy ? p.saving : p.save}
            </button>
          </div>
        </div>
      ) : null}

      <div className={`${styles.methodList} mb-6`}>
        {methods.length === 0 ? (
          <p className="text-sm text-base-content/50">{p.noMethods}</p>
        ) : methods.map((m) => (
          <div key={m.id} className={styles.methodRow}>
            <Wallet size={18} className="opacity-60" />
            <div className={styles.methodInfo}>
              <div className={styles.methodLabel}>
                {m.label}
                {m.isDefault ? <span className={styles.defaultBadge}>{p.default}</span> : null}
              </div>
              <div className={styles.methodMeta}>{typeLabel(p, m.type)}{maskSummary(m.mask) ? ` · ${maskSummary(m.mask)}` : ""}</div>
            </div>
            <div className={styles.methodActions}>
              {!m.isDefault ? (
                <button type="button" className="btn btn-xs btn-ghost" onClick={() => void makeDefault(m)} title={p.setDefault}>
                  <Star size={14} />
                </button>
              ) : null}
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => openEdit(m)} title={p.editMethod}>
                <Pencil size={14} />
              </button>
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => void removeMethod(m.id)} disabled={deletingId === m.id} title={p.deleteMethod}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Solicitar retiro */}
      <h3 className="mb-3 text-sm font-semibold opacity-70">{p.requestTitle}</h3>
      <div className={`${styles.methodForm} mb-6`}>
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label htmlFor="payout-req-method">{p.requestMethod}</label>
            <select
              id="payout-req-method"
              className="select select-sm select-bordered"
              value={reqMethodId}
              onChange={(e) => setReqMethodId(e.target.value)}
              disabled={methods.length === 0}
            >
              {methods.length === 0 ? <option value="">—</option> : null}
              {methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div className={styles.formField}>
            <label htmlFor="payout-req-amount">{p.requestAmount}</label>
            <input
              id="payout-req-amount"
              type="number"
              min={0}
              className="input input-sm input-bordered"
              value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder={String(minTokens)}
            />
          </div>
          <div className={styles.formField}>
            <label>{p.converterUsdLabel}</label>
            <span className={styles.converterUsd}>{usdFmt.format(quoteTokensToUsd(Number(reqAmount) || 0, rate))}</span>
          </div>
        </div>
        {reqError ? <p className={styles.formError}>{reqError}</p> : null}
        {reqSuccess ? <p className={styles.formSuccess}>{reqSuccess}</p> : null}
        <div className={styles.formActions}>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void submitRequest()} disabled={reqBusy || methods.length === 0}>
            {reqBusy ? p.requesting : p.requestButton}
          </button>
        </div>
      </div>

      {/* Historial */}
      <h3 className="mb-3 text-sm font-semibold opacity-70">{p.historyTitle}</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.thead}>
              <th className={styles.thStart}>{p.colAmount}</th>
              <th className={styles.thEnd}>{p.colUsd}</th>
              <th className={styles.thStart}>{p.colMethod}</th>
              <th className={styles.thStart}>{p.colStatus}</th>
              <th className={styles.thEnd}>{p.colDate}</th>
            </tr>
          </thead>
          <tbody>
            {requestsError ? (
              <tr><td colSpan={5} className={styles.tdEmpty}>{p.loadError}</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className={styles.tdEmpty}>{p.noRequests}</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className={styles.tbodyRow}>
                <td className={styles.tdUser}>{intFmt.format(r.amountTokens)} {p.tokens}</td>
                <td className={styles.tdEnd}>{usdFmt.format(r.amountUsd)}</td>
                <td className={styles.tdUser}>{r.methodLabel ?? "—"}</td>
                <td className={styles.tdUser}>
                  <span className={`${styles.statusBadge} ${statusClass(r.status)}`}>{statusLabel(p, r.status)}</span>
                  {r.status === "rejected" && r.rejectionReason ? (
                    <div className={styles.rejectionNote}>{p.rejectionReason}: {r.rejectionReason}</div>
                  ) : null}
                </td>
                <td className={styles.tdEnd}>{r.requestedAt ? new Date(r.requestedAt).toLocaleDateString(intlLocale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
