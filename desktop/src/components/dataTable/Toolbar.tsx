import { SettingsIcon } from "../ui/icons";
import { SearchIcon } from "./icons";
import type { DataTableFilterConfig, DataTableQuickActionConfig } from "./types";

/**
 * Barra superior de la tabla: controles de filtro (texto/select) + acciones
 * rápidas + botón "Configurar". Dos disposiciones: `inlineToolbar` mete filtros
 * y acciones en una sola fila (paneles estrechos); si no, se apilan en dos filas.
 */
export function Toolbar<T extends Record<string, unknown>>({
  filters,
  filterState,
  filterOptions,
  onFilterChange,
  inlineToolbar,
  visibleQuickActions,
  selectedRows,
  hideSettingsButton,
  onOpenSettings,
  configureLabel,
}: {
  filters: DataTableFilterConfig<T>[];
  filterState: Record<string, string>;
  filterOptions: Map<string, Array<{ label: string; value: string }>>;
  onFilterChange: (filterId: string, value: string) => void;
  inlineToolbar: boolean;
  visibleQuickActions: DataTableQuickActionConfig<T>[];
  selectedRows: T[];
  hideSettingsButton: boolean;
  onOpenSettings: () => void;
  configureLabel: string;
}) {
  const hasActions = visibleQuickActions.length > 0 || !hideSettingsButton;

  const filterControls = filters.map((filter) =>
    filter.type === "select" ? (
      <select
        key={filter.id}
        className="select select-bordered min-w-[180px] text-sm !text-slate-700 placeholder:text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:!text-zinc-100"
        value={filterState[filter.id] ?? ""}
        onChange={(event) => onFilterChange(filter.id, event.target.value)}
      >
        <option value="">{filter.label}</option>
        {(filterOptions.get(filter.id) ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ) : (
      <label key={filter.id} className={`input input-bordered flex items-center gap-2 text-sm !text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:!text-zinc-100 ${inlineToolbar ? "min-w-[120px] flex-1" : "min-w-[300px]"}`}>
        <span className="opacity-60">
          <SearchIcon />
        </span>
        <input
          className="grow !text-slate-700 placeholder:!text-slate-400 dark:!text-zinc-100 dark:placeholder:!text-zinc-400"
          placeholder={filter.label}
          value={filterState[filter.id] ?? ""}
          onChange={(event) => onFilterChange(filter.id, event.target.value)}
        />
      </label>
    ),
  );

  const actionControls = (
    <>
      {visibleQuickActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`btn text-sm ${
            action.variant === "primary"
              ? "btn-primary text-white"
              : action.variant === "danger"
                ? "btn-error text-white"
                : "btn-outline text-base-content dark:text-white"
          }`}
          onClick={() => action.onClick?.(selectedRows)}
        >
          {action.icon ? <span className="inline-flex items-center">{action.icon}</span> : null}
          {action.label}
        </button>
      ))}
      {hideSettingsButton ? null : (
        <button
          type="button"
          className="lp-modal-btn lp-modal-btn--ghost"
          onClick={onOpenSettings}
        >
          <SettingsIcon />
          {configureLabel}
        </button>
      )}
    </>
  );

  if (inlineToolbar) {
    return filters.length > 0 || hasActions ? (
      <div className="flex flex-wrap items-center gap-2">
        {filters.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">{filterControls}</div>
        ) : null}
        {hasActions ? <div className="flex shrink-0 flex-wrap gap-2">{actionControls}</div> : null}
      </div>
    ) : null;
  }

  return (
    <>
      {filters.length > 0 ? (
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2">{filterControls}</div>
        </div>
      ) : null}

      {hasActions ? <div className="flex flex-wrap gap-2">{actionControls}</div> : null}
    </>
  );
}
