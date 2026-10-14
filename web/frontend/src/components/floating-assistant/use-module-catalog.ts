// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef } from "react";
import { assistantModulesApi, type ResolvedModule } from "./assistant-api";
import { scopeHeaders } from "@/lib/api-client";
import { MODULES_CHANGED_EVENT } from "@/lib/module-events";
/** One refresh lifecycle; old responses cannot cross a target or permission change. */
export function useModuleCatalog(onRows: (rows: ResolvedModule[]) => void, onError?: (error: Error) => void): void {
  const callbacks = useRef({ onRows, onError }); callbacks.current = { onRows, onError };
  useEffect(() => {
    let generation = 0, disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const epoch = ++generation, scope = JSON.stringify(scopeHeaders());
      try {
        const rows = await assistantModulesApi.list();
        if (!disposed && epoch === generation && scope === JSON.stringify(scopeHeaders())) callbacks.current.onRows(rows);
      } catch (error) { if (!disposed && epoch === generation && scope === JSON.stringify(scopeHeaders())) callbacks.current.onError?.(error as Error); }
    };
    const changed = () => { generation++; clearTimeout(timer); timer = setTimeout(() => void refresh(), 100); };
    const targetChanged = () => { callbacks.current.onRows([]); changed(); };
    window.addEventListener(MODULES_CHANGED_EVENT, changed);
    for (const event of ["luxipanel:target-changed", "luxipanel:permissions-changed"]) window.addEventListener(event, targetChanged);
    void refresh();
    return () => { disposed = true; generation++; clearTimeout(timer); window.removeEventListener(MODULES_CHANGED_EVENT, changed); for (const event of ["luxipanel:target-changed", "luxipanel:permissions-changed"]) window.removeEventListener(event, targetChanged); };
  }, []);
}
