import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { createPortalCheckout, getPaymentHistory, getPaymentProducts, type PaymentRow, type ProductRow } from "../../api/client";
import type { ToastApi } from "../../components/ToastProvider";
import type { Messages } from "../../i18n/messages";
import type { View } from "../../features/app/types";
import { openExternal } from "../../features/app/utils";

/**
 * Modal global de Pagos (compras/consumo/historial) del controlador de pestaña
 * principal, extraído de `useMainTabController` SIN cambios de comportamiento.
 * Pagos pasó de ser una vista propia a un MODAL global (espejo de cómo
 * Seguridad se movió al modal de cuenta): `paymentsOpen` controla el
 * `PaymentsModal`; la vista de fondo (dashboard/support/ssh) queda intacta.
 */
export function usePaymentsModal({ token, t, toast, setView }: {
  token: string | null;
  t: Messages;
  toast: ToastApi;
  setView: Dispatch<SetStateAction<View>>;
}) {
  // Tab inicial a abrir en Pagos: "usage" cuando se entra por el botón MB; null
  // por defecto. Se resetea al entrar a Pagos por la vía normal.
  const [paymentsInitialTab, setPaymentsInitialTab] = useState<"usage" | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [productRows, setProductRows] = useState<ProductRow[]>([]);
  const [busyPayments, setBusyPayments] = useState(false);

  // Pagos es la pantalla amplia de COMPRAS (datos/tokens/consumo/historial +
  // su propia tab Desembolso). Ahora se muestra en un MODAL global
  // (`PaymentsModal`) en vez de cambiar de vista; la vista de fondo no cambia.
  const openPaymentsView = (tab: "usage" | null) => {
    if (!token) { setView("login"); return; }
    setPaymentsInitialTab(tab);
    setPaymentsOpen(true);
    if (paymentRows.length === 0 && productRows.length === 0) {
      setBusyPayments(true);
      Promise.all([
        getPaymentHistory(token),
        getPaymentProducts(token, "desktop"),
      ]).then(([ph, pp]) => {
        setPaymentRows(ph);
        setProductRows(pp);
      }).catch(() => {}).finally(() => setBusyPayments(false));
    }
  };
  const closePayments = useCallback(() => setPaymentsOpen(false), []);

  const refreshPayments = useCallback(async () => {
    if (!token) return;
    setBusyPayments(true);
    try {
      const [ph, pp] = await Promise.all([
        getPaymentHistory(token),
        getPaymentProducts(token, "desktop"),
      ]);
      setPaymentRows(ph);
      setProductRows(pp);
    } finally {
      setBusyPayments(false);
    }
  }, [token]);


  const purchasePlan = useCallback(async (productId: string) => {
    if (!token) return;
    try {
      const result = await createPortalCheckout(token, { productId });
      openExternal(result.checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    }
  }, [token, toast, t.common.error]);

  return {
    paymentsInitialTab,
    paymentsOpen,
    paymentRows,
    productRows,
    busyPayments,
    openPaymentsView,
    closePayments,
    refreshPayments,
    purchasePlan,
  };
}
