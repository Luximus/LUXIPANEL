import { useCallback, useEffect, useState } from "react";
import type { AppTab, View } from "../features/app/types";
import { loadPersistedTabs, persistTabs, type TabSession } from "../lib/tabs-state";

const DEFAULT_TABS: AppTab[] = [{ id: "tab-1", autoLabel: "Servers", autoConnect: true }];

export function useTabs() {
  const [tabs, setTabs] = useState<AppTab[]>(() => {
    const persisted = loadPersistedTabs();
    return persisted?.tabs ?? DEFAULT_TABS;
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const persisted = loadPersistedTabs();
    return persisted?.activeTabId ?? DEFAULT_TABS[0].id;
  });

  useEffect(() => {
    persistTabs({ tabs, activeTabId });
  }, [tabs, activeTabId]);

  const openNewTab = () => {
    const nextId = `tab-${Date.now()}`;
    setTabs((current) => [...current, { id: nextId, autoLabel: "Servers", autoConnect: false }]);
    setActiveTabId(nextId);
    return nextId;
  };

  const closeTab = (tabId: string) =>
    setTabs((current) => {
      if (current.length === 1) return current;
      const next = current.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) setActiveTabId(next[next.length - 1]?.id ?? next[0].id);
      return next;
    });

  const renameTab = (tabId: string, customLabel: string) =>
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, customLabel: customLabel.trim() || undefined } : tab)),
    );

  // Estable (useCallback): se pasa como `onAutoLabelChange` a un useEffect del
  // controlador de pestaña; si cambiara de identidad cada render, ese efecto se
  // re-ejecutaría en bucle ("Maximum update depth"). Solo usa el setter `setTabs`.
  const setTabAutoLabel = useCallback((tabId: string, autoLabel: string) =>
    setTabs((current) => {
      let changed = false;
      const next = current.map((tab) => {
        if (tab.id !== tabId || tab.autoLabel === autoLabel) return tab;
        changed = true;
        return { ...tab, autoLabel };
      });
      return changed ? next : current;
    }), []);

  const updateTabSession = useCallback((tabId: string, session: TabSession) => {
    setTabs((current) => {
      let changed = false;
      const next = current.map((tab) => {
        if (tab.id !== tabId) return tab;
        const view: View | undefined = session.view;
        const sshUrl = session.sshUrl || undefined;
        const panelId = session.panelId || undefined;
        if (
          tab.restoreView === view &&
          tab.restoreSshUrl === sshUrl &&
          tab.restorePanelId === panelId
        ) {
          return tab;
        }
        changed = true;
        return { ...tab, restoreView: view, restoreSshUrl: sshUrl, restorePanelId: panelId };
      });
      return changed ? next : current;
    });
  }, []);

  return {
    tabs,
    activeTabId,
    setActiveTabId,
    openNewTab,
    closeTab,
    renameTab,
    setTabAutoLabel,
    updateTabSession,
  };
}
