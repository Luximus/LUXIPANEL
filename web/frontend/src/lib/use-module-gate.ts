// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { startupSeed, invalidateStartup } from "./startup-state";
/**
 * "Is this module enabled, and should its FAB show?" gate (F-12).
 *
 * `FloatingTerminalDrawer` and `FloatingAssistantDrawer` had the same effect
 * twice (the terminal's comment even said "mismas reglas que en
 * FloatingAssistantDrawer"): probe `/api/admin/modules`, resolve
 * `enabled ?? installed`, resolve `showFloatingButton ?? true`, and re-probe on
 * the `luxipanel:modules-changed` event that `/panel/modules` emits.
 *
 * Both flags start as `null` = "still probing" so the caller can render
 * optimistically (fast first paint); when the endpoint doesn't list the module
 * at all (older panel) they resolve to `true` to preserve the previous UX.
 */
import { useEffect, useState } from "react";
import { api, scopeHeaders } from "@/lib/api-client";
import { ADMIN_MODULES_PATH } from "@/lib/api-routes";

/** Event `/panel/modules` emits after toggling a module. */
import { MODULES_CHANGED_EVENT } from "./module-events";
export { MODULES_CHANGED_EVENT } from "./module-events";

type ModuleRow = {
  id: string;
  enabled?: boolean;
  installed?: boolean;
  showFloatingButton?: boolean;
  showInSidebar?: boolean;
};

export interface ModuleGate {
  /** `null` while probing. */
  enabled: boolean | null;
  /** `null` while probing. */
  showFloatingButton: boolean | null;
}

export function useModuleGate(moduleId: string): ModuleGate {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [showFloatingButton, setShowFloatingButton] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false, generation = 0;
    async function probe() {
      const epoch = ++generation, scope = JSON.stringify(scopeHeaders());
      const seed = startupSeed();
      const res = seed ? {data:seed.modules as ModuleRow[]} : await api.get<ModuleRow[]>(ADMIN_MODULES_PATH);
      if (cancelled || epoch !== generation || scope !== JSON.stringify(scopeHeaders())) return;
      const modules = Array.isArray(res.data) ? res.data : [];
      const mod = modules.find((m) => m.id === moduleId);
      setEnabled(mod ? Boolean(mod.enabled ?? mod.installed) : !seed);
      // `showFloatingButton` is opt-in: undefined ⇒ show (compat with older
      // backends); false ⇒ the admin turned it off in /panel/modules.
      setShowFloatingButton(mod ? (mod.showFloatingButton ?? true) : !seed);
    }
    void probe();
    function handleModulesChanged() {
      invalidateStartup();
      void probe();
    }
    window.addEventListener(MODULES_CHANGED_EVENT, handleModulesChanged);
    window.addEventListener("luxipanel:target-changed", handleModulesChanged);
    window.addEventListener("luxipanel:permissions-changed", handleModulesChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(MODULES_CHANGED_EVENT, handleModulesChanged);
      window.removeEventListener("luxipanel:target-changed", handleModulesChanged);
      window.removeEventListener("luxipanel:permissions-changed", handleModulesChanged);
    };
  }, [moduleId]);

  return { enabled, showFloatingButton };
}
