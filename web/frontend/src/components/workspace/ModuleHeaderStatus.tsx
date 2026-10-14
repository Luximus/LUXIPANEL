import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useViewContext } from "./view-context";
import { useModuleVisibility } from "./module-visibility";

/** The active view owns its header badge, including its lifecycle and locale. */
export function ModuleHeaderStatus({ children }: { children: ReactNode }) {
  const { scope } = useViewContext();
  const visible = useModuleVisibility();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const drawer = scope.root.closest(".lxp-workspace-quick-drawer");
    setTarget(visible ? drawer?.querySelector<HTMLElement>("[data-module-header-status-slot]") ?? null : null);
  }, [scope, visible]);
  return visible && target ? createPortal(children, target) : null;
}
