// Iconos SVG inline de la tabla (búsqueda, orden, kebab, paginación, acciones de
// fila). Sin dependencias externas para no acoplar la tabla a un set de iconos.

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

export function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <span className="inline-flex items-center justify-center text-xs opacity-70" aria-hidden="true">
      {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
    </span>
  );
}

export function KebabIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="lp-rtl-flip" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="lp-rtl-flip" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function RowActionIcon({ actionId, danger = false }: { actionId: string; danger?: boolean }) {
  const common = danger ? "text-error" : "text-base-content/80";

  if (actionId.includes("delete")) {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </svg>
    );
  }

  if (actionId.includes("edit")) {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }

  if (actionId.includes("connect") || actionId.includes("view")) {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className={`${common} lp-rtl-flip`} aria-hidden="true">
        <path d="M8 12h8" />
        <path d="M13 7l5 5-5 5" />
      </svg>
    );
  }

  if (actionId.includes("copy")) {
    return (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <rect x="4" y="4" width="11" height="11" rx="2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className={common} aria-hidden="true">
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="6.5" cy="12" r="1.6" />
      <circle cx="17.5" cy="12" r="1.6" />
    </svg>
  );
}
