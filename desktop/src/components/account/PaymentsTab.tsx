import { PayoutSection } from "../../screens/PayoutSection";

/**
 * Pestaña "Pagos" del modal de cuenta (espejo de la pestaña Pagos de la cuenta
 * web): SOLO la UI de desembolso/payout (saldo, conversor tokens→USD, métodos de
 * pago, solicitar retiro e historial). El `PayoutSection` es autocontenido: trae
 * sus propios datos vía `../api/payouts`, así que esta tab solo le pasa idioma y
 * token. La pantalla de facturación amplia (datos/tokens/consumo/historial) vive
 * aparte como vista de navegación (`PaymentsScreen`), no en este modal.
 */
export function PaymentsTab({
  language,
  token,
}: {
  language: string;
  token: string;
}) {
  return <PayoutSection language={language} token={token} />;
}
