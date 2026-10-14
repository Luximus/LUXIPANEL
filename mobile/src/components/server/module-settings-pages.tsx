import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";

export type ModuleSettingsPage = { key: string; label: string; icon?: React.ReactNode; content: React.ReactNode };
type RegisteredPage = Omit<ModuleSettingsPage, "content"> & { render: () => React.ReactNode };
export function createModuleSettingsStore(open: (key: string) => void) {
  let pages: RegisteredPage[] = [];
  let revision = 0;
  const metadata = new Set<() => void>(), contents = new Set<() => void>();
  const store = {
    open,
    pages: () => pages,
    revision: () => revision,
    subscribe: (listener: () => void) => { metadata.add(listener); return () => { metadata.delete(listener); }; },
    subscribeContent: (listener: () => void) => { contents.add(listener); return () => { contents.delete(listener); }; },
    update: () => { revision++; contents.forEach(listener => listener()); },
    register: (page: RegisteredPage) => {
      pages = [...pages.filter(item => item.key !== page.key), page];
      metadata.forEach(listener => listener());
      return () => { pages = pages.filter(item => item !== page); metadata.forEach(listener => listener()); };
    },
  };
  return store;
}
export const ModuleSettingsPagesContext = createContext<ReturnType<typeof createModuleSettingsStore> | null>(null);

/** Table state stays in its module; its settings render in the module's common drawer. */
export function useRegisterModuleSettingsPage(page: ModuleSettingsPage) {
  const store = useContext(ModuleSettingsPagesContext);
  const content = useRef(page.content);
  content.current = page.content;
  useEffect(() => store?.register({ key: page.key, label: page.label, icon: page.icon, render: () => content.current }), [store, page.key, page.label]);
  useLayoutEffect(() => store?.update(), [store, page.content]);
  return store ? () => store.open(page.key) : null;
}

export function RegisteredModuleSettingsPage({ store, pageKey }: { store: ReturnType<typeof createModuleSettingsStore>; pageKey: string }) {
  useSyncExternalStore(store.subscribeContent, store.revision);
  return <>{store.pages().find(page => page.key === pageKey)?.render()}</>;
}
