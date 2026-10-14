import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw, Clock, Coins, Settings, BadgePercent, X } from "lucide-react";
// (Package/Check eliminados: solo se usaban en la tab "Planes" ya removida.)
import DataTable from "./DataTable";
import { getMessages } from "../i18n";
import { getAdminPayments, type PaymentRow, type AdminPaymentRow } from "../api/client";
import {
  getTokenPacks, createTokenCheckout, getPaymentStatus,
  type TokenPack,
} from "../api/billing";
import { CheckoutModal } from "./CheckoutModal";

type PaymentTableRow = {
  id: string;
  plan: string;
  status: string;
  amountUsd: string;
  date: string;
  reference: string;
  // Magnitud cruda para la fila de totales (las columnas muestran strings ya
  // formateados con unidad mixta).
  _amountUsd: number;
};

function buildStatusLabel(t: ReturnType<typeof getMessages>, status: string): string {
  const map: Record<string, string> = {
    approved: t.payments.statusApproved,
    pending: t.payments.statusPending,
    declined: t.payments.statusDeclined,
    refunded: t.payments.statusRefunded,
    voided: t.payments.statusVoided,
    error: t.payments.statusError,
  };
  return map[status] ?? status;
}

function buildRows(payments: PaymentRow[], t: ReturnType<typeof getMessages>): PaymentTableRow[] {
  return payments.map((p) => ({
    id: p.id,
    plan: p.product?.name ?? p.tier ?? "-",
    status: buildStatusLabel(t, p.status),
    amountUsd: p.amountUsd != null ? `$${p.amountUsd.toFixed(2)}` : "-",
    date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-",
    reference: p.reference,
    _amountUsd: p.amountUsd ?? 0,
  }));
}

/**
 * Modal de COMPRAS y pagos (paquetes de datos/tokens). Antes vivía como vista
 * propia (`PaymentsScreen`); ahora se muestra en un modal global con el patrón
 * `lp-modal-*` (igual que `AccountMenu`/`AuditModal`). Las pestañas hacen de
 * "título" en la cabecera; Refresh/Configurar (antes en el navbar) viven a su
 * derecha junto a cerrar. OJO: la pestaña "Desembolso" de aquí (payout) es
 * distinta del tema; no confundir con la pestaña Desembolso del modal de Cuenta.
 */
export function PaymentsModal({
  open,
  onClose,
  language,
  token,
  payments,
  busy,
  onRefresh,
  onBalancesChanged,
  initialTab,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  language: string;
  token: string;
  payments: PaymentRow[];
  busy: boolean;
  onRefresh: () => void;
  /**
   * Avisa al contenedor que los saldos cambiaron (compra aprobada / datos
   * acreditados al instante) para que refresque TODA la UI de saldos fuera de
   * este modal: chip de cuenta (MB/tokens), barra de saldo del dashboard y la
   * UI gateada por 0 MB/tokens (conexión, asistente, tarjetas "sin datos").
   */
  onBalancesChanged?: () => void;
  /**
   * Tab a abrir al entrar. El prop acepta la unión legacy (incluye "usage"/
   * "payout") para compatibilidad con llamadores que aún los pasan; internamente
   * se normaliza a las 3 tabs vigentes (ver `coerceTab`).
   */
  initialTab?: "data" | "tokens" | "usage" | "history" | "payout";
  /** Admin: oculta las pestañas de compra (Datos/Tokens); solo Historial. */
  isAdmin?: boolean;
}) {
  const t = getMessages(language);
  const s = t.payments;
  const isEs = language.startsWith("es");
  // Las tabs "usage"/"payout"/"data" se retiraron. Cualquier valor legacy del
  // llamador (incl. "data") cae a "tokens".
  const coerceTab = (tab?: string): "tokens" | "history" =>
    tab === "history" ? tab : "tokens";
  const [activeTab, setActiveTab] = useState<"tokens" | "history">(coerceTab(initialTab));
  // Re-sincroniza el tab activo con initialTab cuando el modal se (re)abre con
  // otro tab.
  useEffect(() => {
    if (open && initialTab) setActiveTab(coerceTab(initialTab));
  }, [open, initialTab]);
  // Admin no tiene pestañas de compra: solo Historial.
  useEffect(() => {
    if (isAdmin && activeTab !== "history") setActiveTab("history");
  }, [isAdmin, activeTab]);

  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string>("");
  const [buyingPackId, setBuyingPackId] = useState<string>("");
  // Checkout in-app: URL de pago activa (abre el modal webview) + su título.
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutTitle, setCheckoutTitle] = useState("");
  const [checkoutRef, setCheckoutRef] = useState<string | null>(null);
  // Abre el modal de ajustes de la tabla de historial desde el botón Configurar.
  const [historySettingsOpen, setHistorySettingsOpen] = useState(false);

  // ── Historial de compras de TODOS los usuarios (vista admin) ──
  const [adminPays, setAdminPays] = useState<AdminPaymentRow[] | null>(null);
  const [adminPaysBusy, setAdminPaysBusy] = useState(false);
  const loadAdminPays = useCallback(async () => {
    if (!token) return;
    setAdminPaysBusy(true);
    try {
      setAdminPays(await getAdminPayments(token));
    } catch {
      setAdminPays([]);
    } finally {
      setAdminPaysBusy(false);
    }
  }, [token]);
  useEffect(() => {
    if (open && activeTab === "history" && isAdmin) void loadAdminPays();
  }, [open, activeTab, isAdmin, loadAdminPays]);

  const loadWallets = useCallback(async () => {
    if (!token) return;
    setWalletBusy(true);
    setWalletError("");
    try {
      setPacks(await getTokenPacks(token, "web"));
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : s.loadError);
    } finally {
      setWalletBusy(false);
    }
  }, [token, s.loadError]);

  const intlLocale = isEs ? "es-CO" : language;
  const usdFmt = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const copFmt = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const intFmt = new Intl.NumberFormat(intlLocale);
  const fmtUsd = (n: number) => usdFmt.format(n);
  const fmtCop = (n: number) => {
    const f = copFmt.format(n);
    return /COP/i.test(f) ? f : `${f} COP`;
  };
  // Carga las wallets al abrir el modal (antes: al montar la vista).
  useEffect(() => {
    if (open) void loadWallets();
  }, [open, loadWallets]);

  const buyPack = useCallback(async (packId: string) => {
    if (!token) return;
    setBuyingPackId(packId);
    try {
      const res = await createTokenCheckout(token, packId);
      const checkout = res.checkout as { wompiUrl?: string; url?: string; reference?: string } | null;
      const url = checkout?.wompiUrl ?? checkout?.url;
      if (url) { setCheckoutTitle(s.buy); setCheckoutRef(checkout?.reference ?? null); setCheckoutUrl(url); }
    } catch {
      // el error de backend se registra; el usuario puede reintentar
    } finally {
      setBuyingPackId("");
    }
  }, [token, s.buy]);

  const tableRows = buildRows(payments, t);

  // Columnas del historial: plan · estado · monto · fecha · referencia. El
  // modelo por datos (MB) fue retirado (sin columna de datos).
  const columns = [
    { id: "plan", header: t.payments.colPlan, accessorKey: "plan" as const, sortable: true },
    { id: "status", header: t.payments.colStatus, accessorKey: "status" as const, sortable: true },
    { id: "amountUsd", header: t.payments.colAmount, accessorKey: "amountUsd" as const, sortable: true, summary: { value: (r: PaymentTableRow) => r._amountUsd, format: (n: number) => `$${n.toFixed(2)}` } },
    { id: "date", header: t.payments.colDate, accessorKey: "date" as const, sortable: true },
    { id: "reference", header: t.payments.colReference, accessorKey: "reference" as const },
  ];

  // Historial admin: compras de TODOS los usuarios (con columna de cliente).
  const adminTableRows = (adminPays ?? []).map((p) => ({
    id: p.id,
    customer: p.customerName || p.customerEmail || "—",
    email: p.customerEmail ?? "",
    plan: p.productName ?? p.tier ?? "-",
    status: buildStatusLabel(t, p.status),
    amountUsd: p.amountUsd != null ? `$${p.amountUsd.toFixed(2)}` : "-",
    date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-",
    reference: p.reference,
    _amountUsd: p.amountUsd ?? 0,
  }));
  const adminColumns = [
    { id: "customer", header: isEs ? "Cliente" : "Customer", accessorKey: "customer" as const, sortable: true },
    { id: "email", header: "Email", accessorKey: "email" as const, sortable: true },
    { id: "plan", header: t.payments.colPlan, accessorKey: "plan" as const, sortable: true },
    { id: "status", header: t.payments.colStatus, accessorKey: "status" as const, sortable: true },
    { id: "amountUsd", header: t.payments.colAmount, accessorKey: "amountUsd" as const, sortable: true, summary: { value: (r: typeof adminTableRows[number]) => r._amountUsd, format: (n: number) => `$${n.toFixed(2)}` } },
    { id: "date", header: t.payments.colDate, accessorKey: "date" as const, sortable: true },
    { id: "reference", header: t.payments.colReference, accessorKey: "reference" as const },
  ];

  const refreshAll = useCallback(() => {
    onRefresh();
    void loadWallets();
  }, [onRefresh, loadWallets]);

  if (!open) return null;

  return (
    <>
      <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4">
        <div className="lp-modal-card flex max-h-full w-full max-w-5xl flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Cabecera estándar lp-modal-*: las pestañas hacen de "título" y a la
              derecha van Refresh/Configurar (antes en el navbar) + cerrar. */}
          <div className="lp-modal-header">
            <div className="join">
              {/* Admin no compra: oculta Tokens, deja solo Historial. */}
              {!isAdmin ? (
                <button type="button" className={`btn btn-sm lp-seg-tab join-item ${activeTab === "tokens" ? "is-active" : "btn-outline"}`} onClick={() => setActiveTab("tokens")}>
                  <Coins size={15} /> {s.tabTokens}
                </button>
              ) : null}
              <button type="button" className={`btn btn-sm lp-seg-tab join-item ${activeTab === "history" ? "is-active" : "btn-outline"}`} onClick={() => setActiveTab("history")}>
                <Clock size={15} /> {s.tabHistory}
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm"
                onClick={refreshAll}
                disabled={busy || walletBusy}
                title={t.payments.refresh}
              >
                {busy || walletBusy ? <span className="loading loading-spinner loading-sm" /> : <RefreshCw size={16} />}
                <span>{t.payments.refresh}</span>
              </button>
              {activeTab === "history" ? (
                <button
                  type="button"
                  className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm"
                  onClick={() => setHistorySettingsOpen(true)}
                  title={t.dataTable.configure}
                >
                  <Settings size={16} />
                  <span>{t.dataTable.configure}</span>
                </button>
              ) : null}
              <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="lp-modal-body grow min-h-0">
            {walletError && activeTab !== "history" ? (
              <div className="mb-3 flex items-center gap-3">
                <p className="text-sm text-error">{walletError}</p>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => void loadWallets()}>{s.retry}</button>
              </div>
            ) : null}

            {activeTab === "tokens" ? (
              walletBusy ? (
                <div className="flex gap-4 flex-wrap">{[1, 2].map((i) => <div key={i} className="skeleton h-28 w-48 rounded-2xl" />)}</div>
              ) : (
                <div>
                  {/* Las tarjetas de tokens (disponibles/ganados) se muestran ahora
                      en el aviso de datos del dashboard, no aquí. */}
                  <h3 className="mb-4 mt-1 text-sm font-semibold opacity-70">{s.packs}</h3>
                  {packs.length === 0 ? (
                    <p className="text-sm text-base-content/50">{s.noPacks}</p>
                  ) : (
                    <div className="lp-plan-grid">
                      {packs.map((pack) => (
                        <div key={pack.id} className="lp-plan-card">
                          <span className="lp-plan-card__badge">{intFmt.format(pack.tokenAmount)} {s.tokens}</span>
                          <h3 className="lp-plan-card__name">{pack.name}</h3>
                          <div className="lp-plan-card__price-wrap">
                            {pack.discountPercent > 0 ? (
                              <div className="lp-plan-card__discount-row">
                                <span className="lp-plan-card__discount"><BadgePercent size={12} />-{pack.discountPercent}%</span>
                                <span className="lp-plan-card__strike">
                                  {pack.baseAmountUsd != null ? fmtUsd(pack.baseAmountUsd) : pack.baseAmountCop != null ? fmtCop(pack.baseAmountCop) : ""}
                                </span>
                              </div>
                            ) : null}
                            <div className="lp-plan-card__price-main">
                              <span className="lp-plan-card__price">
                                {pack.amountUsd != null ? fmtUsd(pack.amountUsd) : pack.amountCop != null ? fmtCop(pack.amountCop) : "—"}
                              </span>
                            </div>
                            <p className="lp-plan-card__sub">
                              {pack.amountUsd != null && pack.amountCop != null ? `${s.singlePayment} · ${fmtCop(pack.amountCop)}` : s.singlePayment}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm w-full btn-outline lp-plan-card__buy"
                            onClick={() => void buyPack(pack.id)}
                            disabled={buyingPackId === pack.id}
                          >
                            <CreditCard size={15} />
                            <span>{s.buy}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : null}

            {activeTab === "history" && isAdmin ? (
              <DataTable
                tableId="portal-payments-admin-history-table"
                title={s.tabHistory}
                data={adminTableRows}
                columns={adminColumns}
                pageSizeOptions={[10, 25, 50]}
                language={language}
                loading={adminPaysBusy}
                settingsOpen={historySettingsOpen}
                onSettingsOpenChange={setHistorySettingsOpen}
                hideSettingsButton
              />
            ) : null}
            {activeTab === "history" && !isAdmin ? (
              <DataTable
                tableId="portal-payments-history-table"
                title={s.tabHistory}
                data={tableRows}
                columns={columns}
                pageSizeOptions={[10, 25, 50]}
                language={language}
                loading={busy}
                settingsOpen={historySettingsOpen}
                onSettingsOpenChange={setHistorySettingsOpen}
                hideSettingsButton
              />
            ) : null}
          </div>
        </div>
      </div>

      {checkoutUrl ? (
        <CheckoutModal
          url={checkoutUrl}
          title={checkoutTitle}
          closeLabel={isEs ? "Cerrar" : "Close"}
          checkStatus={checkoutRef ? () => getPaymentStatus(token, checkoutRef) : undefined}
          labels={{
            checking: isEs ? "Confirmando tu pago…" : "Confirming your payment…",
            approvedTitle: isEs ? "¡Pago aprobado!" : "Payment approved!",
            approvedText: isEs
              ? "Tus datos se acreditaron y tu saldo ya está actualizado."
              : "Your data has been credited and your balance is updated.",
            declinedTitle: isEs ? "Pago rechazado" : "Payment declined",
            declinedText: isEs
              ? "No se pudo completar el pago. No se realizó ningún cargo; puedes intentarlo de nuevo."
              : "The payment couldn't be completed. No charge was made; you can try again.",
            pendingTitle: isEs ? "Pago en proceso" : "Payment processing",
            pendingText: isEs
              ? "Estamos confirmando tu pago; tu saldo se actualizará en cuanto se acredite."
              : "We're confirming your payment; your balance will update once it's credited.",
            doneButton: isEs ? "Listo" : "Done",
          }}
          onClose={() => { setCheckoutUrl(null); setCheckoutRef(null); }}
          onPaid={() => { void loadWallets(); onBalancesChanged?.(); }}
        />
      ) : null}
    </>
  );
}
