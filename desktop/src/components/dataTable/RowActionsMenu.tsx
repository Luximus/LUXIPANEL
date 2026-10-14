import { type RefObject } from "react";
import { createPortal } from "react-dom";
import styles from "../DataTable.module.css";
import type { DataTableRowActionConfig } from "./types";
import { RowActionIcon } from "./icons";

export type OpenMenuState<T extends Record<string, unknown>> = {
  row: T;
  rowId: string;
  actions: DataTableRowActionConfig<T>[];
  top: number;
  left: number;
};

/**
 * Menú contextual de acciones de fila, renderizado en portal sobre `body` con
 * posición absoluta calculada por el que lo abre (evita clipping por overflow de
 * la tabla). Un divisor separa la primera acción `danger` del resto.
 */
export function RowActionsMenu<T extends Record<string, unknown>>({
  menu,
  menuRef,
  onSelect,
}: {
  menu: OpenMenuState<T>;
  menuRef: RefObject<HTMLDivElement | null>;
  onSelect: (actionId: string, row: T) => void;
}) {
  return createPortal(
    <div
      ref={menuRef}
      className={`menu absolute z-[200] w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl ${styles.rowMenu}`}
      style={{ ["--dt-top" as string]: `${menu.top}px`, ["--dt-left" as string]: `${menu.left}px` }}
    >
      {menu.actions.map((action, index) => {
        const prev = index > 0 ? menu.actions[index - 1] : null;
        const showDangerDivider = action.variant === "danger" && prev?.variant !== "danger";
        return (
          <div key={`${menu.rowId}-${action.id}`}>
            {showDangerDivider ? <div className="my-1 border-t border-base-300/80" /> : null}
            <button
              type="button"
              className={`btn btn-ghost btn-sm w-full justify-start gap-2 text-sm text-slate-900 dark:text-white ${action.variant === "danger" ? "!text-error" : ""}`}
              onClick={() => onSelect(action.id, menu.row)}
            >
              <RowActionIcon actionId={action.id} danger={action.variant === "danger"} />
              {action.label}
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
