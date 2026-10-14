import { useContext, useEffect, useState } from "react";
import { NativeModuleContext } from "./native-module-context";
import { workspaceModuleViews } from "./workspace-module-views";
/** A submenu selection activates a mounted module without discarding its drafts. */
export function useWorkspaceModuleTab<T extends string>(initial: T) {
  const context = useContext(NativeModuleContext);
  const [tab, setTab] = useState<T>(initial);
  useEffect(() => {
    if (!context?.selectedView || !context.moduleId) return;
    const view = workspaceModuleViews[context.moduleId]?.find(
      (view) => view.id === context.selectedView,
    );
    if (view?.tab) setTab(view.tab as T);
  }, [context?.selectedView, context?.viewRevision, context?.moduleId]);
  return [tab, setTab] as const;
}
