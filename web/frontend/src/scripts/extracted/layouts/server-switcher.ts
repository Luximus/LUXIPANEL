import { openAlert } from "/scripts/extracted/lib/confirm.js";
import {
  TARGET_SCOPE_SESSION_KEY,
  LOCAL_TARGET_SCOPE,
  BRIDGE_SESSION_SESSION_KEY,
  SERVER_SWITCHER_ID,
  ATTR_CURRENT_TARGET_ID,
  ATTR_CURRENT_BRIDGE_SESSION_ID,
  resolveTargetScope,
  getCsrfToken,
  scopeHeaders,
  CSRF_HEADER_NAME,
} from "/scripts/extracted/lib/api-client.js";
// Canonical `/api/servers` paths from the SSOT api-routes runtime lib (this
// entry is bundle:false and resolves shared libs by runtime URL; api-routes.ts
// IS emitted as `/scripts/extracted/lib/api-routes.js`, so import it directly).
import { SERVERS_PATH, serverSwitchPath } from "/scripts/extracted/lib/api-routes.js";
// SSOT for the ServerTarget shape (union/superset shared with settings/servers).
// Type-only import → erased at build (safe in this bundle:false script).
import type { ServerTarget } from "@/scripts/extracted/lib/server-target.types";

// `astro:transitions/client` is a VIRTUAL module: Astro only resolves it for
// scripts it compiles itself. This file is an EXTRACTED script and
// `build-extracted.mjs` leaves bare specifiers external, so the import survived
// verbatim into the served .js — the browser could not resolve it and CSP
// reported it as a blocked script load. Navigate through the real DOM instead:
// a target switch rebuilds the whole panel session anyway, so a full document
// load is the correct (and more predictable) behaviour here.
const navigate = async (href: string): Promise<void> => {
  window.location.assign(href);
  // Give the pending navigation a tick so callers awaiting us don't keep
  // mutating a DOM that is about to be torn down.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

// Standalone multi-node switcher. Fuente de destinos: `GET /api/servers`
// (registro local, sin secretos). Cambio de destino: `POST /api/servers/:id/switch`
// → `{ bridgeSessionId, targetId, targetName }`; guardamos el `bridgeSessionId`
// y el `api-client` lo reenvía como `X-Bridge-Session-Id` en cada petición
// (mismo mecanismo TARGET_SCOPE/BRIDGE_SESSION de siempre; lo consume
// `session.middleware`). Siempre existe la opción "Local (esta caja)", que
// limpia el header y vuelve a la sesión local (por defecto).

// `ServerTarget` (registro local de un destino, sin secretos) vive ahora en el
// SSOT `lib/server-target.types` (union/superset compartido con
// settings/servers-script1). Contrato ampliado (backend ssot 54b37ec4): GET
// /api/servers incluye, como PRIMER elemento, una entrada sintética del servidor
// local/conectado (id "local", isLocal:true); `active` marca el target contra el
// que resuelve la request actual (override per-tab X-Bridge-Session-Id).

type SwitcherI18n = {
  label: string;
  title: string;
  currentOption: string;
  connectingTitle: string;
  connectingStatus: string;
  changeServer: string;
  localOption: string;
  manageServers: string;
  noOtherServers: string;
  openingConnection: string;
  unknownError: string;
  switchFailedStatus: string;
  switchFailedAlert: string;
  connectionErrorTitle: string;
};

// Sentinel option values (no chocan con ningún id de servidor real).
const LOCAL_OPTION_VALUE = "__local__";
const MANAGE_OPTION_VALUE = "__manage_servers__";
const SERVERS_PAGE_PATH = "/panel/settings#servers";

// Fallback intencional: `PanelLayout.astro` inyecta `panelLayout.serverSwitcher`
// en un `<script type="application/json" id="server-switcher-i18n">` antes de que
// este módulo se cargue. Si no se provee, este verbatim aparece en cualquier
// locale.
const I18N_FALLBACK: SwitcherI18n = {
  label: "Cambiar de servidor",
  title: "Cambiar de servidor",
  currentOption: "{server} (cambiar)",
  connectingTitle: "Conectando al servidor...",
  connectingStatus: "Preparando nueva sesion de conexion.",
  changeServer: "Cambiar de servidor...",
  localOption: "Local (esta caja)",
  manageServers: "Gestionar servidores...",
  noOtherServers: "No hay otros servidores registrados",
  openingConnection: "Abriendo conexion segura con el nuevo servidor...",
  unknownError: "Error desconocido",
  switchFailedStatus: "No se pudo cambiar de servidor ({detail}).",
  switchFailedAlert: "No se pudo establecer conexión con el nuevo servidor: {detail}",
  connectionErrorTitle: "Error de conexión",
};

function readI18n(): SwitcherI18n {
  try {
    const el = document.getElementById("server-switcher-i18n");
    if (el?.textContent) return { ...I18N_FALLBACK, ...JSON.parse(el.textContent) };
  } catch {
    // usa el fallback
  }
  return I18N_FALLBACK;
}

function fmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = params[k];
    return v === undefined || v === null ? m : String(v);
  });
}

const switcher = document.getElementById(SERVER_SWITCHER_ID) as HTMLSelectElement | null;

if (switcher) {
  let i18n = readI18n();
  const currentTargetId = (switcher.getAttribute(ATTR_CURRENT_TARGET_ID) || "").trim();
  const ssrBridge = (switcher.getAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID) || "").trim();
  const resolvedCurrentTarget = currentTargetId || LOCAL_TARGET_SCOPE;
  let activeTargetId = resolvedCurrentTarget;
  let targetsLoaded = false;
  let loadingTargets: Promise<void> | null = null;

  // ── sessionStorage helpers (per-tab isolation) ────────────────────────────
  const readStoredTargetScope = (): string => {
    try {
      return (sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || "").trim() || LOCAL_TARGET_SCOPE;
    } catch {
      return LOCAL_TARGET_SCOPE;
    }
  };
  const writeStoredTargetScope = (scope: string): void => {
    try {
      sessionStorage.setItem(TARGET_SCOPE_SESSION_KEY, scope);
    } catch {
      // Ignore session storage issues (private mode, restricted policies).
    }
  };
  const syncTargetScope = (nextScope: string): void => {
    const previousScope = readStoredTargetScope();
    writeStoredTargetScope(nextScope);
    if (previousScope !== nextScope) {
      window.dispatchEvent(new CustomEvent("luxipanel:target-changed", {
        detail: { previousScope, nextScope },
      }));
    }
  };
  const writeStoredBridge = (value: string): void => {
    try {
      if (value) sessionStorage.setItem(BRIDGE_SESSION_SESSION_KEY, value);
      else sessionStorage.removeItem(BRIDGE_SESSION_SESSION_KEY);
    } catch {
      // Ignore session storage issues.
    }
  };
  const readStoredBridge = (): string => {
    try {
      return (sessionStorage.getItem(BRIDGE_SESSION_SESSION_KEY) || "").trim();
    } catch {
      return "";
    }
  };

  // Siembra inicial: la primera vez adopta el bridge/scope que trajo el SSR.
  if (!readStoredBridge() && ssrBridge) {
    writeStoredBridge(ssrBridge);
    syncTargetScope(resolvedCurrentTarget);
    activeTargetId = resolvedCurrentTarget;
  } else {
    activeTargetId = resolveTargetScope();
  }

  // ── Option rendering ──────────────────────────────────────────────────────
  const createOption = (label: string, value: string): HTMLOptionElement => {
    const option = document.createElement("option");
    option.textContent = label;
    option.value = value;
    return option;
  };
  const createSeparator = (): HTMLOptionElement => {
    const option = createOption("──────────", "__separator__");
    option.disabled = true;
    return option;
  };

  const targetLabel = (target: ServerTarget): string => {
    const name = typeof target.name === "string" ? target.name.trim() : "";
    if (name) return name;
    const host = typeof target.host === "string" ? target.host.trim() : "";
    if (host) return target.port ? `${host}:${target.port}` : host;
    return String(target.id);
  };

  const isLocalEntry = (target: ServerTarget): boolean =>
    target.isLocal === true || String(target.id) === LOCAL_TARGET_SCOPE;

  const renderTargets = (targets: ServerTarget[]): void => {
    switcher.innerHTML = "";
    // El backend envía la entrada local sintética como primer elemento; la
    // separamos del resto para no duplicar la opción "Local" (ya la renderizamos
    // con el sentinel __local__, cuyo click limpia el bridge per-tab en vez de
    // llamar a /switch — no hay material de bóveda para "local").
    const localEntry = targets.find(isLocalEntry);
    const remotes = targets.filter((t) => !isLocalEntry(t));

    // Fuente de verdad de la selección: el flag `active` del backend (refleja el
    // override per-tab). Si la respuesta no lo trae (contrato viejo), caemos al
    // activeTargetId resuelto en cliente.
    const hasActiveFlag = targets.some((t) => t.active === true);

    // Opción "Local (esta caja)" — siempre presente, limpia el header.
    switcher.appendChild(createOption(i18n.localOption, LOCAL_OPTION_VALUE));
    if (remotes.length > 0) switcher.appendChild(createSeparator());
    let selectedValue = (hasActiveFlag ? localEntry?.active === true : activeTargetId === LOCAL_TARGET_SCOPE)
      ? LOCAL_OPTION_VALUE
      : "";
    for (const target of remotes) {
      const id = String(target.id);
      switcher.appendChild(createOption(targetLabel(target), id));
      const isActive = hasActiveFlag ? target.active === true : id === activeTargetId;
      if (isActive) selectedValue = id;
    }
    // Ninguna fila marcada como activa (p.ej. bridge stale tras reinicio) → cae a
    // "Local" para que el usuario siempre tenga una selección coherente.
    if (!selectedValue) selectedValue = LOCAL_OPTION_VALUE;
    if (remotes.length === 0) {
      const empty = createOption(i18n.noOtherServers, "");
      empty.disabled = true;
      switcher.appendChild(empty);
    }
    // Separador visual + acción de gestión (CRUD).
    switcher.appendChild(createSeparator());
    const manage = createOption(i18n.manageServers, MANAGE_OPTION_VALUE);
    switcher.appendChild(manage);
    switcher.value = selectedValue;
  };

  const setFallback = (): void => {
    switcher.innerHTML = "";
    switcher.appendChild(createOption(i18n.localOption, LOCAL_OPTION_VALUE));
    switcher.appendChild(createSeparator());
    switcher.appendChild(createOption(i18n.manageServers, MANAGE_OPTION_VALUE));
    switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : "";
  };

  const loadTargets = async (): Promise<void> => {
    if (targetsLoaded) return;
    if (loadingTargets) {
      await loadingTargets;
      return;
    }
    loadingTargets = (async () => {
      try {
        // scopeHeaders() adjunta el X-Bridge-Session-Id de esta pestaña: sin él el
        // backend resolvería el flag `active` contra la cookie compartida por host
        // (no contra el target conmutado del tab) y marcaría mal la fila activa.
        const res = await fetch(SERVERS_PATH, {
          method: "GET",
          credentials: "include",
          headers: { accept: "application/json", ...scopeHeaders() },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data?.data) ? (data.data as ServerTarget[]) : Array.isArray(data) ? (data as ServerTarget[]) : [];
        renderTargets(list);
      } catch {
        setFallback();
      } finally {
        targetsLoaded = true;
        loadingTargets = null;
      }
    })();
    await loadingTargets;
  };

  const ensureTargetsLoaded = (): void => {
    void loadTargets();
  };

  if (!switcher.dataset.targetsLazyBound) {
    switcher.dataset.targetsLazyBound = "1";
    switcher.addEventListener("pointerenter", ensureTargetsLoaded, { once: true });
    switcher.addEventListener("pointerdown", ensureTargetsLoaded, { once: true });
    switcher.addEventListener("focus", ensureTargetsLoaded, { once: true });
  }

  // The target catalog is loaded when the selector receives focus or pointer intent.

  // ── Loading overlay ───────────────────────────────────────────────────────
  const overlay = document.getElementById("server-switch-overlay");
  const overlayStatus = document.getElementById("server-switch-status");
  const openLoading = (message: string): void => {
    if (overlayStatus) overlayStatus.textContent = message;
    overlay?.classList.remove("hidden");
    overlay?.classList.add("flex");
  };
  const closeLoading = (): void => {
    overlay?.classList.remove("flex");
    overlay?.classList.add("hidden");
  };

  const buildNextPath = (): string => {
    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return path.startsWith("/") ? path : "/";
  };

  // Cambia a la sesión local (por defecto): limpia bridge + scope.
  const switchToLocal = async (): Promise<void> => {
    // Camino AUTORITATIVO (backend ssot 42a3b1b2): POST /api/servers/local/switch
    // (id="local" en la ruta :id/switch) re-firma la cookie de sesión SIN
    // targetId/bridge y purga el material SSH del bridge en Redis. Es lo único que
    // resuelve el caso JWT-pinned (la cookie httpOnly lleva el targetId y JS no
    // puede quitarlo, así que borrar solo el header per-tab no escapa del target
    // remoto). scopeHeaders(true) adjunta el X-Bridge-Session-Id del tab (para que
    // el backend disponga el bridge exacto) y el token CSRF (la ruta lo exige).
    // Respuesta: { ok, data:{ local, targetId:"local", targetName:"Local",
    // bridgeSessionId:"", clearBridge:true } }; hosting → error (400) por diseño.
    // SOLO tras OK descartamos el header per-tab y recargamos: si el backend
    // responde error NO recargamos a ciegas (dejaría al usuario igual de pegado y
    // sin saber por qué) — dejamos que el llamador lo capture y avise.
    const res = await fetch(serverSwitchPath(LOCAL_TARGET_SCOPE), {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json", ...scopeHeaders(true) },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.ok === false) {
      const detail = (typeof json?.error === "string" && json.error) || `HTTP ${res.status}`;
      throw new Error(detail);
    }

    // Éxito: la cookie ya quedó re-firmada sin target. Descartamos también el
    // X-Bridge-Session-Id per-tab (sessionStorage + atributo SSR) y recargamos.
    writeStoredBridge("");
    switcher.setAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID, "");
    switcher.setAttribute(ATTR_CURRENT_TARGET_ID, "");
    activeTargetId = LOCAL_TARGET_SCOPE;
    syncTargetScope(LOCAL_TARGET_SCOPE);
    targetsLoaded = false;
    switcher.value = LOCAL_OPTION_VALUE;
    await navigate(buildNextPath());
  };

  // ── Return-to-local: sync de UI + flujo compartido ────────────────────────
  // Cuando hay un target REMOTO activo el <select> se OCULTA (el usuario sólo
  // vuelve a Local con el botón "Regresar") y los botones [data-server-return] se
  // muestran; en Local el select se muestra y los botones se ocultan. Se
  // re-sincroniza en init y en cada navegación SPA — los <aside> del sidebar son
  // transition:persist, así que los elementos sobreviven a los swaps y el botón y
  // el switcher SIEMPRE coexisten (ambos gateados por canSee("server-switcher")).
  const syncReturnUi = (): void => {
    const remote = activeTargetId !== LOCAL_TARGET_SCOPE;
    switcher.disabled = remote;
    switcher.setAttribute("aria-disabled", remote ? "true" : "false");
    // En remoto el selector no sirve (no se puede cambiar de servidor desde
    // ahí): se OCULTA el wrapper entero y sólo queda el botón "Regresar".
    // `closest("label")` cubre el SSR sin id (build antiguo) y el id nuevo.
    const wrap = document.getElementById("server-switcher-wrap") ?? switcher.closest("label");
    wrap?.classList.toggle("hidden", remote);
    for (const btn of document.querySelectorAll<HTMLElement>("[data-server-return]")) {
      btn.classList.toggle("hidden", !remote);
    }
  };

  // Flujo "volver a Local" compartido por el botón Regresar y la opción __local__
  // del <select> (mismo overlay + manejo de error + recarga; sin duplicar lógica).
  const runSwitchToLocal = async (): Promise<void> => {
    if (activeTargetId === LOCAL_TARGET_SCOPE) return;
    const filesGuard = (window as Window & { __filesBeforeTargetSwitch?: () => Promise<boolean> }).__filesBeforeTargetSwitch;
    if (filesGuard && !(await filesGuard())) return;
    const obsidianGuard = (window as Window & { __obsidianBeforeTargetSwitch?: () => Promise<boolean> }).__obsidianBeforeTargetSwitch;
    if (obsidianGuard && !(await obsidianGuard())) return;
    openLoading(i18n.openingConnection);
    switcher.disabled = true;
    try {
      await switchToLocal();
      // switchToLocal() ya disparó la recarga completa en su camino OK; el DOM se
      // destruye con el documento, no hace falta reactivar nada.
    } catch (error) {
      // El endpoint respondió error (p.ej. sesión hosting): seguimos en el target
      // remoto → NO recargamos a ciegas. Re-sincronizamos (select disabled + botón
      // visible, porque seguimos en remoto) y avisamos.
      closeLoading();
      syncReturnUi();
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
      const detail = error instanceof Error ? error.message : i18n.unknownError;
      if (overlayStatus) {
        overlayStatus.textContent = fmt(i18n.switchFailedStatus, { detail });
      }
      window.setTimeout(() => {
        if (overlayStatus) overlayStatus.textContent = i18n.connectingStatus;
      }, 2000);
      void openAlert(fmt(i18n.switchFailedAlert, { detail }), {
        title: i18n.connectionErrorTitle,
        variant: "danger",
      });
    }
  };

  // Delegación en document: cubre el botón desktop (#server-return-local) y el
  // móvil (#server-return-local-mobile) con un único listener robusto a swaps SPA.
  document.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest?.("[data-server-return]");
    if (!btn) return;
    ev.preventDefault();
    void runSwitchToLocal();
  });

  switcher.addEventListener("change", async () => {
    const selected = (switcher.value || "").trim();
    if (!selected) return;

    if (selected === MANAGE_OPTION_VALUE) {
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
      await navigate(SERVERS_PAGE_PATH);
      return;
    }

    if (selected === LOCAL_OPTION_VALUE) {
      await runSwitchToLocal();
      return;
    }

    // selected = id de un destino → POST /api/servers/:id/switch
    const filesGuard = (window as Window & { __filesBeforeTargetSwitch?: () => Promise<boolean> }).__filesBeforeTargetSwitch;
    if (filesGuard && !(await filesGuard())) {
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
      return;
    }
    const obsidianGuard = (window as Window & { __obsidianBeforeTargetSwitch?: () => Promise<boolean> }).__obsidianBeforeTargetSwitch;
    if (obsidianGuard && !(await obsidianGuard())) {
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
      return;
    }
    openLoading(i18n.openingConnection);
    switcher.disabled = true;
    try {
      const nextPath = buildNextPath();
      // El switch acuña material de bridge (cambio de estado real) → el backend
      // exige double-submit CSRF (cookie luxipanel_csrf == header X-CSRF-Token).
      // Este fetch es crudo (no pasa por api-client), así que hay que adjuntar
      // el header a mano; sin él el backend responde 403 "CSRF token mismatch".
      const csrf = getCsrfToken();
      const res = await fetch(serverSwitchPath(selected), {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(csrf ? { [CSRF_HEADER_NAME]: csrf } : {}),
        },
      });
      const json = await res.json().catch(() => null);
      const payload = (json?.data ?? json) as
        | { bridgeSessionId?: string; targetId?: string; targetName?: string }
        | null;
      if (!res.ok || !payload?.bridgeSessionId || !payload?.targetId) {
        throw new Error(json?.error ?? `HTTP ${res.status}`);
      }

      writeStoredBridge(payload.bridgeSessionId);
      activeTargetId = payload.targetId;
      switcher.setAttribute(ATTR_CURRENT_BRIDGE_SESSION_ID, payload.bridgeSessionId);
      switcher.setAttribute(ATTR_CURRENT_TARGET_ID, payload.targetId);
      syncTargetScope(payload.targetId);
      targetsLoaded = false;
      // Ya estamos en un target REMOTO → el select queda DESHABILITADO y el botón
      // "Regresar" visible (syncReturnUi) antes de navegar (la navegación recarga
      // el documento, pero mantenemos el estado coherente hasta entonces).
      syncReturnUi();
      // La navegación es un documento nuevo. Mantén el overlay mientras carga:
      // los listeners de target-changed pueden mostrar errores transitorios del
      // servidor anterior si destapamos la vista antes de que llegue el HTML.
      await navigate(nextPath);
    } catch (error) {
      closeLoading();
      // Re-sincroniza disabled/return según el target actual (sin cambios: seguía
      // en Local si veníamos de Local, o en remoto si el select estaba habilitado).
      syncReturnUi();
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
      const detail = error instanceof Error ? error.message : i18n.unknownError;
      if (overlayStatus) {
        overlayStatus.textContent = fmt(i18n.switchFailedStatus, { detail });
      }
      window.setTimeout(() => {
        if (overlayStatus) overlayStatus.textContent = i18n.connectingStatus;
      }, 2000);
      void openAlert(fmt(i18n.switchFailedAlert, { detail }), {
        title: i18n.connectionErrorTitle,
        variant: "danger",
      });
    }
  });

  document.addEventListener("astro:after-swap", () => {
    i18n = readI18n();
    activeTargetId = resolveTargetScope();
    // Refleja el destino activo en el <select> si ya se renderizó la lista.
    if (targetsLoaded) {
      switcher.value = activeTargetId === LOCAL_TARGET_SCOPE ? LOCAL_OPTION_VALUE : activeTargetId;
    }
    syncReturnUi();
  });

  // Sync inicial (síncrono, tras definir todas las funciones): estado disabled del
  // select + visibilidad del botón "Regresar" según el target sembrado en el init.
  syncReturnUi();
}

export {};
