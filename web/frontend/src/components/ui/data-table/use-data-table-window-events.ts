// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import * as React from "react";
import { DATATABLE_EVENTS } from "@/lib/datatable-events";
import { rowsEqual } from "./helpers";
import type { DataTableColumnConfig, DataTableFilterConfig, RowData } from "./types";

export type ExtPageState = { canPrev: boolean; canNext: boolean; info: string; window?: boolean; version?: number; serverQuery?: boolean; total?: number; totals?: Record<string,number>; hasMore?: boolean; loading?: boolean; error?: string | null };

type Params = {
  tableId: string;
  tableRoot?: React.RefObject<HTMLElement | null>;
  onData?: () => void;
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>;
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
  setDynamicColumns: React.Dispatch<React.SetStateAction<DataTableColumnConfig[] | null>>;
  setExtPage: React.Dispatch<React.SetStateAction<ExtPageState | null>>;
  setFilters: React.Dispatch<React.SetStateAction<DataTableFilterConfig[]>>;
};

/**
 * Suscribe los seis eventos `lxp:data-table:*` que el host (scripts extraídos)
 * usa para hablar con la isla: SET_DATA, SET_COLUMNS, SET_PAGINATION,
 * SET_LOADING, SET_FILTER_OPTIONS y el handshake READY/REQUEST_READY. Cada uno
 * es su propio `useEffect` (orden y dependencias idénticos al original) para no
 * alterar el comportamiento de re-suscripción por `tableId`.
 */
export function useDataTableWindowEvents({
  tableId,
  tableRoot,
  setLoaded,
  setRows,
  onData,
  setDynamicColumns,
  setExtPage,
  setFilters,
}: Params) {
  React.useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ tableId: string; data: RowData[] }>;
      if (customEvent.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      onData?.();
      setLoaded(true);
      const nextData = Array.isArray(customEvent.detail.data) ? customEvent.detail.data : [];
      // Bail si las filas son las mismas por id+contenido. Evita
      // re-renders innecesarios cuando el origen vanilla re-emite el
      // mismo dataset (p.ej. respuesta a `lxp:data-table:ready`).
      setRows((prev) => (rowsEqual(prev, nextData) ? prev : nextData));
    };

    window.addEventListener(DATATABLE_EVENTS.SET_DATA, handler as EventListener);
    return () => window.removeEventListener(DATATABLE_EVENTS.SET_DATA, handler as EventListener);
  }, [tableId, onData]);

  React.useEffect(() => {
    // Columnas dinámicas en runtime (visor SQL de databases). Reemplaza las
    // columnas del prop hasta que se vuelva a emitir; `columns` vacío/no-array
    // vuelve a las del prop.
    const onSetColumns = (event: Event) => {
      const ce = event as CustomEvent<{ tableId: string; columns: DataTableColumnConfig[] }>;
      if (ce.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      setDynamicColumns(Array.isArray(ce.detail.columns) && ce.detail.columns.length > 0 ? ce.detail.columns : null);
    };
    window.addEventListener(DATATABLE_EVENTS.SET_COLUMNS, onSetColumns as EventListener);
    return () => window.removeEventListener(DATATABLE_EVENTS.SET_COLUMNS, onSetColumns as EventListener);
  }, [tableId]);

  React.useEffect(() => {
    // Estado del pie de paginación externa, empujado por el host tras cada
    // recarga server-side.
    const onSetPagination = (event: Event) => {
      const ce = event as CustomEvent<{ tableId: string; canPrev: boolean; canNext: boolean; info: string }>;
      if (ce.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      setExtPage(previous => ({ ...(previous?.window && !(ce.detail as ExtPageState).window ? previous : {}), ...ce.detail, canPrev: !!ce.detail.canPrev, canNext: !!ce.detail.canNext, info: String(ce.detail.info ?? "") }));
    };
    window.addEventListener(DATATABLE_EVENTS.SET_PAGINATION, onSetPagination as EventListener);
    return () => window.removeEventListener(DATATABLE_EVENTS.SET_PAGINATION, onSetPagination as EventListener);
  }, [tableId]);

  React.useEffect(() => {
    // Optional explicit control: a page script can show/hide the skeleton
    // around a refetch via `lxp:data-table:set-loading`.
    const onLoading = (event: Event) => {
      const ce = event as CustomEvent<{ tableId: string; loading: boolean }>;
      if (ce.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      setLoaded(!ce.detail.loading);
    };
    window.addEventListener(DATATABLE_EVENTS.SET_LOADING, onLoading as EventListener);
    // Safety net: never get stuck on the skeleton if the page script never
    // emits (degrade to the normal empty state instead).
    const settle = window.setTimeout(() => setLoaded(true), 15_000);
    return () => {
      window.removeEventListener(DATATABLE_EVENTS.SET_LOADING, onLoading as EventListener);
      window.clearTimeout(settle);
    };
  }, [tableId]);

  React.useEffect(() => {
    // Pages migrating from SSR-blocking fetches push filter options after
    // mount via `lxp:data-table:set-filter-options`. Each call REPLACES the
    // options of the targeted filter id; other filters stay as configured
    // in the prop. Letting the page render with empty options and patch
    // them client-side eliminates the SSR round-trip on cold loads.
    const onFilterOptions = (event: Event) => {
      const ce = event as CustomEvent<{
        tableId: string;
        filterId: string;
        options: Array<{ label: string; value: string }>;
      }>;
      if (ce.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      const { filterId, options } = ce.detail;
      if (!filterId || !Array.isArray(options)) return;
      setFilters((prev) =>
        prev.map((f) => (f.id === filterId ? { ...f, options } : f)),
      );
    };
    window.addEventListener(DATATABLE_EVENTS.SET_FILTER_OPTIONS, onFilterOptions as EventListener);
    return () => window.removeEventListener(DATATABLE_EVENTS.SET_FILTER_OPTIONS, onFilterOptions as EventListener);
  }, [tableId]);

  React.useEffect(() => {
    const dispatchReady = () => {
      const event=new CustomEvent(DATATABLE_EVENTS.READY,{detail:{tableId}});
      const owner=tableRoot?.current?.closest("[data-internal-module]");
      if(owner)Object.defineProperty(event,"__lxpModuleRoot",{value:owner});
      window.dispatchEvent(event);
    };
    dispatchReady();
    // Handshake bidireccional: si el script vanilla evaluó DESPUÉS de que
    // este componente despachó `ready`, ese evento se perdió y el cache
    // nunca se vuelve a vaciar. El script vanilla, en su init(), emite
    // `request-ready` por cada tableId conocido para volver a abrir el
    // canal; nosotros respondemos re-despachando `ready`.
    const onRequestReady = (event: Event) => {
      const ce = event as CustomEvent<{ tableId: string }>;
      if (ce.detail?.tableId !== tableId || ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== tableRoot?.current?.closest("[data-internal-module]"))) return;
      dispatchReady();
    };
    window.addEventListener(DATATABLE_EVENTS.REQUEST_READY, onRequestReady as EventListener);
    return () => window.removeEventListener(DATATABLE_EVENTS.REQUEST_READY, onRequestReady as EventListener);
  }, [tableId]);
}
