import { mountLegacyTablePages } from "@/lib/legacy-table-pages";
// SPDX-License-Identifier: AGPL-3.0-only
/** DOM controllers belong to one mounted module, never the workspace document. */
export function createControllerScope(root: HTMLElement, initialUrl: URL) {
  let url = initialUrl;
  let visible = true;
  let disposed = false;
  const localLifecycle = new EventTarget();
  const cleanup = new Set<() => void>();
  const reads = new Set<AbortController>();
  const connections = new Set<{ close: () => void }>();
  const pendingTimeouts = new Set<number>();
  const intervals = new Set<number>();
  const localGlobals = new Map<PropertyKey, unknown>();
  // Old row renderers expose named actions. Resolve only simple calls and
  // literal arguments inside this scope; never evaluate supplied JavaScript.
  function dispatchRowAction(event: Event) {
    const element = (event.target as Element | null)?.closest<HTMLElement>(
      `[data-lxp-handler-${event.type}], [on${event.type}]`,
    );
    if (!element || !root.contains(element) || !visible || disposed) return;
    const expression =
      element.getAttribute(`data-lxp-handler-${event.type}`) ||
      element.getAttribute(`on${event.type}`) ||
      "";
    if (expression) element.setAttribute(`data-lxp-handler-${event.type}`, expression);
    element.removeAttribute(`on${event.type}`);
    const match = expression.match(
      /^(?:window\.)?([A-Za-z_$][\w$]*)\((.*)\)\s*;?$/s,
    );
    if (!match) return;
    const handler = localGlobals.get(match[1]);
    if (typeof handler !== "function") return;
    const argumentsList: string[] = [];
    let token = "",
      quote = "",
      escaped = false;
    for (const char of match[2]) {
      if (escaped) {
        token += char;
        escaped = false;
        continue;
      }
      if (char === "\\" && quote) {
        token += char;
        escaped = true;
        continue;
      }
      if (quote) {
        token += char;
        if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        token += char;
        continue;
      }
      if (char === ",") {
        argumentsList.push(token.trim());
        token = "";
      } else token += char;
    }
    if (token.trim()) argumentsList.push(token.trim());
    const values: unknown[] = [];
    for (const argument of argumentsList) {
      if (/^(['"])[\s\S]*\1$/.test(argument))
        values.push(argument.slice(1, -1).replace(/\\(['"\\])/g, "$1"));
      else if (/^-?\d+(\.\d+)?$/.test(argument)) values.push(Number(argument));
      else if (argument === "event") values.push(event);
      else if (argument === "this.checked")
        values.push((element as HTMLInputElement).checked);
      else if (argument === "this.value")
        values.push((element as HTMLInputElement).value);
      else if (argument === "true" || argument === "false")
        values.push(argument === "true");
      else if (argument === "null") values.push(null);
      else return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    handler(...values);
  }
  for (const type of ["click", "dblclick", "change", "input"]) {
    root.addEventListener(type, dispatchRowAction, true);
    cleanup.add(() => root.removeEventListener(type, dispatchRowAction, true));
  }
  const globalIds = new Set([
    "server-switcher",
    "sidebar-server-switcher",
    "messenger-link",
    "lxp-ui-bootstrap",
    "lxp-confirm-modal",
    "dlg-confirm",
    "confirm-modal",
    "toast-container",
    "persistent-assistant-workspace",
  ]);
  const owns = (event: Event) => {
    if ((event as any).__lxpModuleRoot && (event as any).__lxpModuleRoot !== root) return false;
    const target = event.target;
    if (
      target instanceof Node &&
      target !== document &&
      !root.contains(target)
    )
      return false;
    const tableId = (event as CustomEvent).detail?.tableId;
    if (
      tableId &&
      !root.querySelector(
        `[data-table-id="${CSS.escape(tableId)}"], #${CSS.escape(tableId)}`,
      )
    )
      return false;
    return (
      visible ||
      (typeof tableId === "string" && /^(lxp:data-table:)/.test(event.type))
    );
  };
  const listen = (
    target: Document | Window,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) => {
    if (type.startsWith("astro:") || ["lxp:module:visibility", "lxp:module:dispose"].includes(type)) {
      localLifecycle.addEventListener(type, listener, options);
      cleanup.add(() =>
        localLifecycle.removeEventListener(type, listener, options),
      );
      return;
    }
    const guarded: EventListener = (event) => {
      if (disposed || !owns(event)) return;
      if (typeof listener === "function") listener.call(target, event);
      else listener.handleEvent(event);
    };
    target.addEventListener(type, guarded, options);
    const remove = () => target.removeEventListener(type, guarded, options);
    cleanup.add(remove);
    listenerMap.set(listener, [
      ...(listenerMap.get(listener) || []),
      { type, target, remove },
    ]);
  };
  const listenerMap = new Map<
    EventListenerOrEventListenerObject,
    Array<{ type: string; target: Document | Window; remove: () => void }>
  >();
  const unlisten = (
    target: Document | Window,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    if (type.startsWith("astro:") || ["lxp:module:visibility", "lxp:module:dispose"].includes(type))
      localLifecycle.removeEventListener(type, listener);
    for (const entry of listenerMap.get(listener) || [])
      if (entry.type === type && entry.target === target) {
        entry.remove();
        cleanup.delete(entry.remove);
      }
  };
  const doc = new Proxy(document, {
    get(target, key) {
      if (key === "body") return root;
      if (key === "URL" || key === "documentURI") return url.href;
      if (key === "defaultView") return win;
      if (key === "hidden") return !visible || document.hidden;
      if (key === "visibilityState")
        return visible ? document.visibilityState : "hidden";
      if (key === "getElementById")
        return (id: string) =>
          root.querySelector(`#${CSS.escape(id)}`) ||
          (globalIds.has(id) || /^(confirm|alert|prompt)-modal-/.test(id)
            ? document.getElementById(id)
            : null);
      if (key === "querySelector")
        return (selector: string) => root.querySelector(selector);
      if (key === "querySelectorAll")
        return (selector: string) => root.querySelectorAll(selector);
      if (key === "addEventListener")
        return (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: AddEventListenerOptions | boolean,
        ) => listen(document, type, listener, options);
      if (key === "removeEventListener")
        return (type: string, listener: EventListenerOrEventListenerObject) =>
          unlisten(document, type, listener);
      if (key === "dispatchEvent")
        return (event: Event) =>
          event.type.startsWith("astro:") ||
          ["lxp:module:visibility", "lxp:module:dispose"].includes(event.type)
            ? localLifecycle.dispatchEvent(event)
            : document.dispatchEvent(event);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  // Location's methods are non-configurable, read-only own properties in real
  // browsers. A Proxy over Location cannot replace them with bound functions.
  const locationFacade = new Proxy({} as Location, {
    get(_target, key) {
      if (key in url) {
        const value = Reflect.get(url, key, url);
        return typeof value === "function" ? value.bind(url) : value;
      }
      const value = Reflect.get(location, key, location);
      return typeof value === "function" ? value.bind(location) : value;
    },
    set(_target, key, value) {
      if (key === "href")
        window.dispatchEvent(
          new CustomEvent("lxp:module:open", {
            detail: { url: String(value) },
          }),
        );
      else Reflect.set(url, key, value);
      return true;
    },
  });
  const historyFacade = {
    state: history.state,
    replaceState(_state: unknown, _title: string, next?: string | URL | null) {
      if (next) url = new URL(next, url);
    },
    pushState(_state: unknown, _title: string, next?: string | URL | null) {
      if (next)
        window.dispatchEvent(
          new CustomEvent("lxp:module:open", {
            detail: { url: new URL(next, url).href },
          }),
        );
    },
  };
  const scopeTimeout: typeof setTimeout = ((
    callback: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const id = window.setTimeout(() => {
      pendingTimeouts.delete(id);
      if (!disposed && typeof callback === "function") callback(...args);
    }, delay);
    pendingTimeouts.add(id);
    return id;
  }) as typeof setTimeout;
  const scopeInterval: typeof setInterval = ((
    callback: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const id = window.setInterval(() => {
      if (visible && !disposed && typeof callback === "function")
        callback(...args);
    }, delay);
    intervals.add(id);
    return id;
  }) as typeof setInterval;
  const scopedFetch: typeof fetch = async (input, init) => {
    if (disposed)
      throw new DOMException("Module session disposed", "AbortError");
    const method = (
      init?.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (!["GET", "HEAD"].includes(method)) return fetch(input, init);
    if (!visible) throw new DOMException("Module view hidden", "AbortError");
    const controller = new AbortController();
    reads.add(controller);
    const signal = init?.signal
      ? AbortSignal.any([controller.signal, init.signal])
      : controller.signal;
    try {
      return await fetch(input, { ...init, signal });
    } finally {
      reads.delete(controller);
    }
  };
  function tracked<T extends new (...args: any[]) => any>(Constructor: T): T {
    return new Proxy(Constructor, {
      construct(target, args) {
        const instance = Reflect.construct(target, args);
        connections.add(instance);
        cleanup.add(() => {
          instance.close?.();
          connections.delete(instance);
        });
        return instance;
      },
    });
  }
  function observed<T extends new (...args: any[]) => any>(Constructor: T): T {
    return new Proxy(Constructor, {
      construct(target, args) {
        const instance = Reflect.construct(target, args);
        // Libraries such as Chart.js observe their document for canvas removal.
        // The scoped document is a facade; keep observation on this module's DOM.
        const observe = instance.observe.bind(instance);
        instance.observe = (node: Node, ...options: any[]) => observe(node === doc ? root : node, ...options);
        cleanup.add(() => instance.disconnect());
        return instance;
      },
    });
  }
  const win = new Proxy(window, {
    get(target, key) {
      if (key === "document") return doc;
      if (key === "dispatchEvent") return (event: Event) => {
        if(event.type.startsWith("lxp:data-table:"))Object.defineProperty(event,"__lxpModuleRoot",{value:root,configurable:true});
        return window.dispatchEvent(event);
      };
      if (
        key === "window" ||
        key === "self" ||
        key === "top" ||
        key === "parent"
      )
        return win;
      if (key === "location") return locationFacade;
      if (key === "history") return historyFacade;
      if (key === "addEventListener")
        return (
          type: string,
          listener: EventListenerOrEventListenerObject,
          options?: AddEventListenerOptions | boolean,
        ) => listen(window, type, listener, options);
      if (key === "removeEventListener")
        return (type: string, listener: EventListenerOrEventListenerObject) =>
          unlisten(window, type, listener);
      if (key === "setTimeout") return scopeTimeout;
      if (key === "setInterval") return scopeInterval;
      if (key === "fetch") return scopedFetch;
      if (key === "WebSocket") return scope.WebSocket;
      if (key === "EventSource") return scope.EventSource;
      if (key === "MutationObserver") return scope.MutationObserver;
      if (key === "ResizeObserver") return scope.ResizeObserver;
      if (localGlobals.has(key)) return localGlobals.get(key);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" && !/^[A-Z]/.test(String(key))
        ? value.bind(target)
        : value;
    },
    set(_target, key, value) {
      localGlobals.set(key, value);
      return true;
    },
  });
  const scope = {
    root,
    vars: {} as Record<string, unknown>,
    document: doc,
    window: win,
    location: locationFacade,
    history: historyFacade,
    fetch: scopedFetch,
    setTimeout: scopeTimeout,
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: scopeInterval,
    clearInterval: window.clearInterval.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    EventSource: tracked(EventSource),
    WebSocket: tracked(WebSocket),
    MutationObserver: observed(MutationObserver),
    ResizeObserver: observed(ResizeObserver),
    setUrl(next: URL) {
      url = next;
    },
    setVisible(next: boolean) {
      visible = next;
      if (!next) {
        for (const read of reads) read.abort();
        for (const connection of connections) connection.close();
        connections.clear();
      }
      localLifecycle.dispatchEvent(new Event("lxp:module:visibility"));
    },
    mounted() {
      localLifecycle.dispatchEvent(new Event("astro:page-load"));
    },
    dispose() {
      localLifecycle.dispatchEvent(new Event("lxp:module:dispose"));
      disposed = true;
      for (const read of reads) read.abort();
      for (const id of pendingTimeouts) window.clearTimeout(id);
      for (const id of intervals) window.clearInterval(id);
      for (const fn of cleanup) fn();
      cleanup.clear();
      localGlobals.clear();
    },
  };
  cleanup.add(mountLegacyTablePages(root, win));
  return scope;
}
export type ControllerScope = ReturnType<typeof createControllerScope>;
