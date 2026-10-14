import type { NavAction, ThemeMode } from "../features/app/types";
import type { AccountOpenSignal } from "./AccountMenu";
import { buildSectionNav } from "../features/app/sectionNav";
import { getMessages } from "../i18n";

/** Datos de cuenta/tema de la pestaña activa para el `AccountMenu` (vive en la
 *  barra de título, nivel 1). Seguridad es una pestaña del modal de cuenta, así
 *  que el chrome también transporta su señal de apertura. */
export type NavbarChrome = {
  theme: ThemeMode;
  toggleTheme: () => void;
  language: string;
  setLanguage: (next: string) => void;
  displayName: string;
  switchAccount: () => Promise<void>;
  logout: () => Promise<void>;
  /** Solo los admins ven la sección Administración en el navbar. */
  isAdmin: boolean;
  /** Saldo de tokens disponible; `null` mientras carga o en invitado. */
  tokensAvailable: number | null;
  /** Señal imperativa para abrir el modal en la pestaña Seguridad (asistente). */
  accountOpenSignal: AccountOpenSignal;
  /** El modal de Pagos (compras) está abierto → resalta el item "Pagos". */
  paymentsModalOpen: boolean;
};

function actionClass(action: NavAction): string {
  const base = "btn btn-sm gap-2 normal-case";
  if (action.alert) return `${base} btn-outline !border-amber-400 !text-amber-600 dark:!text-amber-300`;
  switch (action.variant) {
    case "primary":
      return `${base} btn-primary text-white`;
    case "danger":
      return `${base} btn-error text-white`;
    case "outline":
      return `${base} btn-outline`;
    case "ghost":
    default:
      return `${base} btn-ghost`;
  }
}

/**
 * Nivel 2 del chrome: navbar daisyUI (https://daisyui.com/components/navbar/).
 * Posiciones intercambiadas a pedido: `navbar-start` = acciones contextuales de
 * la vista activa; `navbar-end` = navegación de sección. Reemplaza al dock inferior, al speed-dial
 * del logo, al `AccountMenu` flotante y a los FABs. El botón del asistente de
 * soporte ya NO vive aquí: se movió a un FAB flotante (ver MainScreen) para
 * igualar a /app y /web.
 */
export function AppNavbar({
  language,
  activeView,
  onServers,
  onSupport,
  onPayments,
  onAdmin,
  showAdmin = false,
  paymentsActive = false,
  actions,
}: {
  language: string;
  activeView?: string;
  onServers?: () => void;
  onSupport?: () => void;
  onPayments?: () => void;
  onAdmin?: () => void;
  showAdmin?: boolean;
  /** El modal de Pagos está abierto → item "Pagos" activo (ya no es una vista). */
  paymentsActive?: boolean;
  actions: NavAction[];
}) {
  const t = getMessages(language);
  // Construir aquí (no en MainScreen) evita que el linter marque el paso de
  // handlers que leen refs a una función durante el render: aquí llegan como
  // props del componente.
  // Soporte del CLIENTE → asistente (drawer); la sección "Soporte" del navbar
  // queda solo para staff/admin (consola de tickets).
  const sectionNav = buildSectionNav({ t, activeView, onServers, onSupport, onPayments, onAdmin, showAdmin, showSupport: showAdmin, paymentsActive });

  return (
    <div className="lp-navbar navbar fixed inset-x-0 top-[var(--lp-titlebar-h)] z-40 min-h-0 gap-2 border-b border-base-300/60 bg-base-100/70 px-2 backdrop-blur-sm">
      <div className="navbar-start min-w-0 overflow-x-auto">
        {/* Acciones de la vista activa como grupo conectado (daisyUI join). El
            botón del asistente se movió a un FAB flotante (ver MainScreen).
            Posición intercambiada: las acciones van a la izquierda. */}
        <div className="join flex-nowrap">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`${actionClass(action)} join-item`}
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.label}
              title={action.title ?? action.label}
            >
              {action.busy ? (
                <span className="loading loading-spinner loading-sm" />
              ) : action.icon ? (
                <span className="inline-flex items-center">{action.icon}</span>
              ) : null}
              <span className="whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="navbar-end min-w-0">
        {/* Navegación de sección como grupo conectado (daisyUI join).
            Posición intercambiada: la navegación va a la derecha. */}
        <div className="join">
          {sectionNav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`btn btn-sm join-item gap-2 normal-case ${item.active ? "btn-primary text-white" : "btn-ghost"}`}
              onClick={() => item.onSelect?.()}
              disabled={!item.onSelect}
              aria-current={item.active ? "page" : undefined}
              title={item.label}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
