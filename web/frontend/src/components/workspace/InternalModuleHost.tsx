// SPDX-License-Identifier: AGPL-3.0-only
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { SessionUser } from "@/lib/auth";
import { getMessages } from "@/i18n";
import type { LocaleCode } from "@/i18n/config";
import { mountModuleAiFooter } from "@/lib/module-ai-footer";
import { MODULE_REGISTRY } from "./module-registry";
import { disposeChatStreams } from "@/lib/chat-event-stream";
import { INTERNAL_ROUTE_CHANGED_EVENT } from "@/lib/panel-routes";
import { ModuleVisibilityContext } from "./module-visibility";
import { describeModule, type ModuleDescriptor } from "./module-descriptor";
import {
  createControllerScope,
  type ControllerScope,
} from "./controller-scope";
import { createViewContext, InternalViewContext } from "./view-context";
import { mountModuleTopbar } from "./module-topbar";

type Entry = {
  mounted?: boolean;
  databasePrefix?: string;
  descriptor: ModuleDescriptor;
  View?: ComponentType<any>;
  messages?: Record<string, any>;
  controller?: (scope: ControllerScope) => void;
  error?: string;
  generation: number;
};
type HostProps = {
  user: SessionUser;
  locale: LocaleCode;
  labels: {
    module: string;
    loadingModule: string;
    close: string;
    settings: string;
    retry: string;
    unavailable: string;
  };
};
declare global {
  interface Window {
    __lxpInternalModules?: {
      open: (input: string | URL) => boolean;
      close: () => void;
      settings: () => void;
    };
  }
}
class ModuleError extends Component<
  { children: ReactNode; onError: (error: Error) => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}
function MountedModule({
  entry,
  active,
  user,
  locale,
  onReady,
  onError,
}: {
  entry: Entry;
  active: boolean;
  user: SessionUser;
  locale: LocaleCode;
  onReady: (key: string, scope: ControllerScope) => void;
  onError: (key: string, error: Error) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<ControllerScope | null>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    const value = createControllerScope(root.current, entry.descriptor.url);
    setScope(value);
    return () => value.dispose();
  }, []);
  useLayoutEffect(() => {
    if (!scope) return;
    scope.setUrl(entry.descriptor.url);
    scope.setVisible(active);
    const node = root.current!;
    node.hidden = !active;
    node.inert = !active;
    node.setAttribute("aria-hidden", String(!active));
    for (const dialog of node.querySelectorAll<HTMLDialogElement>(
      "dialog[open]",
    )) {
      if (!active) {
        if (!("moduleParkedDisplay" in dialog.dataset))
          dialog.dataset.moduleParkedDisplay = dialog.style.display;
        dialog.style.display = "none";
      } else if ("moduleParkedDisplay" in dialog.dataset) {
        dialog.style.display = dialog.dataset.moduleParkedDisplay!;
        delete dialog.dataset.moduleParkedDisplay;
      }
    }
    if (active && scope) onReady(entry.descriptor.key, scope);
  }, [active, scope, entry.descriptor, onReady]);
  useEffect(() => {
    if (!scope || !entry.View || !entry.messages) return;
    let alive = true;
    try {
      entry.controller?.(scope);
      scope.mounted();
      onReady(entry.descriptor.key, scope);
    } catch (error) {
      if (alive) onError(entry.descriptor.key, error as Error);
    }
    return () => {
      alive = false;
    };
  }, [scope, entry.View, entry.messages]);
  const context =
    scope && entry.messages
      ? createViewContext({
          databasePrefix: entry.databasePrefix,
          user,
          locale,
          messages: entry.messages,
          url: entry.descriptor.url,
          params: entry.descriptor.params,
          scope,
        })
      : null;
  const View = entry.View;
  return (
    <div
      ref={root}
      data-internal-module={entry.descriptor.id}
      data-module-key={entry.descriptor.key}
      className="lxp-internal-module"
      hidden={!active}
      inert={!active}
      aria-hidden={!active}
    >
      {context && View && (
        <InternalViewContext.Provider value={context}>
          <ModuleError
            onError={(error) => onError(entry.descriptor.key, error)}
          >
            <ModuleVisibilityContext.Provider value={active}>
              <View />
            </ModuleVisibilityContext.Provider>
          </ModuleError>
        </InternalViewContext.Provider>
      )}
    </div>
  );
}
export default function InternalModuleHost({
  user,
  locale,
  labels,
}: HostProps) {
  const [entries, setEntries] = useState<Map<string, Entry>>(() => new Map());
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [title, setTitle] = useState(labels.module);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const scopes = useRef(new Map<string, ControllerScope>());
  const generation = useRef(0);
  const navigationSerial = useRef(0);
  const parentRoute = useRef<string | null>(null);
  const [mailAccounts, setMailAccounts] = useState<
    Array<{ id: number; address: string }>
  >([]);
  const activeRef = useRef<string | null>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const load = useCallback(
    async (entry: Entry) => {
      const definition = MODULE_REGISTRY[entry.descriptor.id];
      try {
        const owner = user.owner || "";
        let databasePrefix =
          owner && /^[a-z][a-z0-9_]*$/.test(owner) ? owner + "_" : "";
        if (owner && !databasePrefix) {
          const bytes = new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(owner),
            ),
          );
          databasePrefix =
            "lxp_" +
            [...bytes]
              .map((byte) => byte.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 16) +
            "_";
        }
        const [view, messages, controller] = await Promise.all([
          definition.load(),
          getMessages(locale, definition.namespaces as any),
          "controller" in definition
            ? definition.controller()
            : Promise.resolve(null),
        ]);
        if (entry.generation !== generation.current) return;
        setEntries((previous) => {
          const next = new Map(previous);
          const current = next.get(entry.descriptor.key);
          if (current && current.generation === entry.generation)
            next.set(entry.descriptor.key, {
              ...current,
              databasePrefix,
              View: view.default as ComponentType<any>,
              messages,
              controller: controller?.mount,
            });
          return next;
        });
      } catch (error) {
        if (entry.generation !== generation.current) return;
        setEntries((previous) => {
          const next = new Map(previous);
          const current = next.get(entry.descriptor.key);
          if (current)
            next.set(entry.descriptor.key, {
              ...current,
              error: (error as Error).message,
            });
          return next;
        });
      }
    },
    [locale, user.owner],
  );
  const close = useCallback((updateHistory = true) => {
    const closedAt = ++navigationSerial.current;
    const key = activeRef.current;
    activeRef.current = null;
    // Close is synchronous local state. No request, route loading or session teardown.
    if (drawer.current) {
      drawer.current.dataset.open = "false";
      drawer.current.setAttribute("aria-hidden", "true");
      drawer.current.inert = true;
    }
    if (key) {
      const scope = scopes.current.get(key);
      scope?.setVisible(false);
      if (scope) {
        scope.root.inert = true;
        scope.root.setAttribute("aria-hidden", "true");
        for (const dialog of scope.root.querySelectorAll<HTMLDialogElement>(
          "dialog[open]",
        )) {
          if (!("moduleParkedDisplay" in dialog.dataset))
            dialog.dataset.moduleParkedDisplay = dialog.style.display;
          dialog.style.display = "none";
        }
      }
    }
    setActiveKey(null);
    setSettingsAvailable(false);
    if (updateHistory) {
      history.replaceState({ ...history.state, lxpModule: null }, "", "/panel");
      window.dispatchEvent(new Event(INTERNAL_ROUTE_CHANGED_EVENT));
    }
    window.__lxpModuleNav?.reset();
    const parent = parentRoute.current;
    parentRoute.current = null;
    if (parent)
      queueMicrotask(() => {
        if (navigationSerial.current === closedAt && !activeRef.current)
          window.__lxpInternalModules?.open(parent);
      });
    if (opener.current?.isConnected) opener.current.focus();
  }, []);
  const open = useCallback(
    (
      input: string | URL,
      historyMode: "push" | "none" = "push",
      link?: HTMLAnchorElement,
    ) => {
      const descriptor = describeModule(input);
      if (!descriptor) return false;
      const category = descriptor.id.split("/")[0];
      const publicUserModule = ["chat", "preferences"].includes(category);
      const allowed =
        publicUserModule ||
        user.kind === "admin" ||
        user.modules.includes(category) ||
        Boolean(
          user.permissions?.sidebar.some(
            (item) => item === "*" || item === category,
          ),
        ) ||
        (category === "nginx" && user.modules.includes("dns"));
      if (!allowed) return false;
      navigationSerial.current++;
      opener.current = document.activeElement as HTMLElement;
      if (activeRef.current && activeRef.current !== descriptor.key)
        scopes.current.get(activeRef.current)?.setVisible(false);
      activeRef.current = descriptor.key;
      setActiveKey(descriptor.key);
      setTitle(
        link?.getAttribute("aria-label") ||
          link?.textContent?.trim() ||
          labels.module,
      );
      drawer.current?.removeAttribute("inert");
      let entry = entriesRef.current.get(descriptor.key);
      if (!entry) {
        entry = { descriptor, generation: generation.current };
        setEntries((previous) => new Map(previous).set(descriptor.key, entry!));
        void load(entry);
      } else
        setEntries((previous) =>
          new Map(previous).set(descriptor.key, { ...entry!, descriptor }),
        );
      if (historyMode === "push" && descriptor.url.href !== location.href) {
        history.pushState(
          { ...history.state, lxpModule: descriptor.key },
          "",
          descriptor.url.pathname + descriptor.url.search + descriptor.url.hash,
        );
        window.dispatchEvent(new Event(INTERNAL_ROUTE_CHANGED_EVENT));
      }
      if (link) window.__lxpModuleNav?.opened(link);
      // Use the navigation controller so the panel, backdrop and scroll lock
      // all finish closing together, including rapid close/reopen sequences.
      window.dispatchEvent(new Event("lxp:sidebar:close"));
      return true;
    },
    [labels.module, load, user],
  );
  const settings = useCallback(() => {
    const scope = activeRef.current
      ? scopes.current.get(activeRef.current)
      : null;
    if (!scope) return;
    const trigger = scope.root.querySelector<HTMLButtonElement>(
      "[data-view-settings-modal] > button, #mail-settings-modal-trigger, [data-module-toolbar] button",
    );
    trigger?.click();
  }, []);
  const ready = useCallback((key: string, scope: ControllerScope) => {
    scopes.current.set(key, scope);
    setEntries((previous) => {
      const next = new Map(previous);
      const entry = next.get(key);
      if (!entry || entry.mounted) return previous;
      next.set(key, { ...entry, mounted: true });
      return next;
    });
    if (activeRef.current !== key) return;
    const actions = scope.root.querySelector("[data-module-toolbar]");
    setSettingsAvailable(
      Boolean(
        actions?.querySelector("button") ||
        scope.root.querySelector("[data-view-settings-modal]"),
      ),
    );
    const entry = entriesRef.current.get(key);
    if (entry) {
      const localizedTitle = entry.descriptor.id === "module-dev/logs" ? (entry.messages as any)?.moduleDev?.logs?.title : Object.values(entry.messages || {}).find(
        (value: any) => value?.pageTitle,
      )?.pageTitle;
      if (localizedTitle) setTitle(localizedTitle);
    }
    if (entry)
      window.__lxpModuleNav?.activateRoot?.(
        scope.document,
        entry.descriptor.url,
        scope.window,
      );
  }, []);
  const onError = useCallback(
    (key: string, error: Error) =>
      setEntries((previous) => {
        const next = new Map(previous);
        const entry = next.get(key);
        if (entry) next.set(key, { ...entry, error: error.message });
        return next;
      }),
    [],
  );
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target as Element;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (["/panel", "/panel/", "/panel/assistant"].includes(url.pathname)) {
        if (activeRef.current) {
          event.preventDefault();
          event.stopImmediatePropagation();
          close();
        }
        return;
      }
      if (!describeModule(url)) return;
      if (!link.dataset.lxpModuleView && window.__lxpModuleNav?.show(link)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (open(url, "push", link)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const input = detail?.url;
      if (input && open(input)) {
        parentRoute.current = detail.parent || null;
        if (detail.title) setTitle(detail.title);
        setMailAccounts(Array.isArray(detail.accounts) ? detail.accounts : []);
      }
    };
    const onPop = () => {
      if (!open(location.href, "none")) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !activeRef.current
      )
        return;
      if (document.querySelector('dialog[open]:not([style*="display: none"])'))
        return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const reset = () => {
      parentRoute.current = null;
      disposeChatStreams();
      generation.current++;
      close(false);
      for (const scope of scopes.current.values()) scope.dispose();
      scopes.current.clear();
      setEntries(new Map());
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    window.addEventListener("lxp:module:open", onOpen);
    window.addEventListener("luxipanel:target-changed", reset);
    window.addEventListener("lxp:session:ended", reset);
    for (const event of ["luxipanel:session-started", "luxipanel:session-ended", "luxipanel:logout", "luxipanel:permissions-changed"]) window.addEventListener(event, reset);
    open(location.href, "none");
    window.__lxpInternalModules = {
      open: (input) => open(input),
      close: () => close(),
      settings,
    };
    window.dispatchEvent(new Event("lxp:internal-modules:ready"));
    return () => {
      delete window.__lxpInternalModules;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("lxp:module:open", onOpen);
      window.removeEventListener("luxipanel:target-changed", reset);
      window.removeEventListener("lxp:session:ended", reset);
      for (const event of ["luxipanel:session-started", "luxipanel:session-ended", "luxipanel:logout", "luxipanel:permissions-changed"]) window.removeEventListener(event, reset);
      for (const scope of scopes.current.values()) scope.dispose();
    };
  }, [open, close, settings]);
  useEffect(() => {
    if (!activeKey || !footer.current) return;
    const scope = scopes.current.get(activeKey);
    if (scope) return mountModuleAiFooter(footer.current, scope.document);
  }, [activeKey, entries]);
  useEffect(() => {
    if (!activeKey || !drawer.current) return;
    const scope = scopes.current.get(activeKey);
    if (scope) return mountModuleTopbar(scope.root, drawer.current);
  }, [activeKey, entries]);
  const active = activeKey ? entries.get(activeKey) : null;
  return (
    <div
      ref={drawer}
      id="workspace-quick-drawer"
      className="lxp-workspace-quick-drawer"
      data-open={Boolean(activeKey)}
      data-module={active?.descriptor.id}
      aria-hidden={!activeKey}
      inert={!activeKey}
    >
      <button
        type="button"
        className="lxp-workspace-quick-backdrop"
        data-close-drawer
        onClick={() => close()}
        aria-label={labels.close}
      />
      <section
        className="lxp-workspace-quick-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-quick-title"
      >
        <header className="lxp-workspace-quick-header">
          <h2 id="workspace-quick-title" className="sr-only">{title}</h2>
          <div data-module-header-tabs-slot className="lxp-workspace-header-tabs" />
          {active?.descriptor.id === "mail/[id]/inbox" &&
            mailAccounts.length > 1 && (
              <select
                aria-label={title}
                value={active.descriptor.params.id}
                onChange={(event) => {
                  const account = mailAccounts.find(
                    (item) => String(item.id) === event.target.value,
                  );
                  if (account) {
                    open(`/panel/mail/${account.id}/inbox`);
                    setTitle(account.address);
                  }
                }}
              >
                {mailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.address}
                  </option>
                ))}
              </select>
            )}
          <div className="ml-auto flex items-center gap-2">
            <div data-module-header-actions-slot className="lxp-workspace-header-actions" />
            <div data-module-header-status-slot className="lxp-workspace-header-status" />
            <button
              id="workspace-quick-settings"
              type="button"
              hidden={!settingsAvailable}
              className="lxp-workspace-header-settings"
              onClick={settings}
            >
              <i className="ti ti-settings text-sm" />
              {labels.settings}
            </button>
            <button
              className="lxp-workspace-quick-close"
              data-close-drawer
              onClick={() => close()}
              aria-label={labels.close}
            >
              <i className="ti ti-x text-lg" />
            </button>
          </div>
        </header>
        <div className="lxp-workspace-quick-body">
          {active && !active.View && !active.error && (
            <div className="lxp-workspace-quick-loading" role="status">
              <i className="ti ti-loader-2 animate-spin" />
              {labels.loadingModule}
            </div>
          )}
          {active?.error && (
            <div role="alert" className="p-5">
              <p>{labels.unavailable}</p>
              <button
                type="button"
                onClick={() => {
                  const retry = {
                    descriptor: active.descriptor,
                    generation: generation.current,
                  };
                  scopes.current.get(active.descriptor.key)?.dispose();
                  scopes.current.delete(active.descriptor.key);
                  setEntries((previous) =>
                    new Map(previous).set(active.descriptor.key, retry),
                  );
                  void load(retry);
                }}
              >
                {labels.retry}
              </button>
            </div>
          )}
          {[...entries.values()]
            .filter(
              (entry) =>
                entry.View &&
                !entry.error &&
                (entry.mounted || entry.descriptor.key === activeKey),
            )
            .map((entry) => (
              <MountedModule
                key={entry.descriptor.key}
                entry={entry}
                active={entry.descriptor.key === activeKey}
                user={user}
                locale={locale}
                onReady={ready}
                onError={onError}
              />
            ))}
        </div>
        <footer
          ref={footer}
          id="workspace-quick-footer"
          className="lxp-workspace-quick-footer"
        />
      </section>
    </div>
  );
}
