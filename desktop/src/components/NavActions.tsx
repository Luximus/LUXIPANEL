import type { NavAction } from "../features/app/types";

/**
 * Estilo de un botón de acción contextual. Espejo del que vivía en `AppNavbar`
 * (la barra intermedia ya removida): ahora las acciones se renderizan dentro de
 * cada pantalla, encima de su buscador, con este mismo aspecto.
 */
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
 * Fila de acciones contextuales de una pantalla (New/Refresh/Configurar, etc.).
 * Antes se publicaban al navbar superior; ahora cada pantalla las renderiza
 * encima de su buscador con este componente.
 */
export function NavActions({ actions, className }: { actions: NavAction[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={actionClass(action)}
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
  );
}
