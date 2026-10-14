// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useNamespaceMessages } from "@/lib/use-namespace-messages";
import { useModuleGate } from "@/lib/use-module-gate";
import { pathIsAssistantView } from "@/lib/panel-routes";
import {
  ASSISTANT_REQUEST_EVENT,
  drainAssistantRequestQueue,
  resetAssistantRequestBus,
  REQUEST_VERSION,
  type AssistantRequestBusEntry,
} from "@/lib/assistant-request";
import { assistantMessagesFallback, mergeAssistantMessages, type AssistantMessages } from "./i18n";
import AssistantPanel, { type AssistantPendingRequest, type AssistantSeed, type AssistantTab } from "./AssistantPanel";

declare global {
  interface Window {
    __lxpFloatingAssistantAPI?: {
      requestOpen(tab?: AssistantTab): void;
      requestClose(): void;
    };
  }
}

// Cuando estamos en la vista dedicada del asistente (`/panel/assistant`) NO
// mostramos el FAB ni dejamos abrir el drawer: la página ya monta su propia
// instancia de `AssistantPanel`, así garantizamos una sola instancia montada
// a la vez (sin doble manejo de eventos ni window API duplicada). El predicado
// es compartido con el drawer del terminal — ver `@/lib/panel-routes` (F-12).

/** Pestañas del Asistente (union restringida a las que `requestedTab` soporta). */
type RequestTab = AssistantTab;

/**
 * FAB + drawer flotante del Asistente IA. El contenido lo aporta el componente
 * compartido `AssistantPanel` (mismo componente que usa la vista de página).
 * Aquí solo vive lo propio del modo drawer: estado `open`, gate del módulo,
 * bridge de hidratación `lxp:assistant:request v1`, compat temporal con
 * `lxp:assistant:open` / `lxp:assistant:seed` (legacy), y el atajo Ctrl/Cmd+J.
 *
 * Política:
 *  • `showFloatingButton=false` SOLO oculta el FAB. NO bloquea las
 *    solicitudes: el drawer se abre igualmente y entrega el prompt. Esto
 *    garantiza que los botones contextuales (Monitor, Mail, Files…) abran
 *    el Asistente aunque el admin haya apagado el FAB.
 *  • El módulo Assistant realmente deshabilitado o sin permiso SIGUE
 *    bloqueando el acceso fail-closed (mostramos un toast/empty-state).
 *  • En la vista dedicada `/panel/assistant` la página monta su propio
 *    AssistantView, así que el drawer NO se abre: evita doble superficie.
 *  • El bridge se registra como consumidor válido de la cola FIFO cuando
 *    `onOwnView===false`. En `onOwnView===true` la cola se sigue drenando,
 *    pero hacia la view (`window.__lxpAssistantAPI.request` ya delegado).
 */
export default function FloatingAssistantDrawer({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  // Slice i18n perezoso — hook compartido (F-13); `mergeAssistantMessages` es
  // el deep-merge del bundle anidado del asistente.
  const messages = useNamespaceMessages<AssistantMessages>(locale, "assistant", assistantMessagesFallback, {
    merge: (_fallback, next) => mergeAssistantMessages(next),
  });
  // Hidratado en cliente: evita que el FAB parpadee durante el SSR (donde
  // `window` no existe y los estados arrancan en null/false) y luego desaparezca.
  const [mounted, setMounted] = useState(false);
  // FAB visibility: only rendered when the `assistant` module is enabled in
  // /panel/modules AND its "Show floating button" toggle is on. `null` =
  // still probing → render optimistically (true) so the first paint is fast.
  const { enabled: moduleEnabled, showFloatingButton } = useModuleGate("assistant");
  // Hidden while on the dedicated `/panel/assistant` view (single instance).
  const [onOwnView, setOnOwnView] = useState<boolean>(() =>
    typeof window !== "undefined" ? pathIsAssistantView(window.location.pathname) : false,
  );
  // Tab requested by a deep-link / window API. Bumped via `requestNonce`.
  const [requestedTab, setRequestedTab] = useState<AssistantTab | null>(null);
  const [requestNonce, setRequestNonce] = useState(0);
  // Legacy seed and versioned assistant requests use separate handoffs.
  const [seed, setSeed] = useState<AssistantSeed | null>(null);
  const [pendingRequest, setPendingRequest] = useState<AssistantPendingRequest | null>(null);
  const handledRequestIds = useRef<Set<string>>(new Set());
  // Toast/empty-state cuando una solicitud llega pero el módulo está deshabilitado.
  const [deniedNotice, setDeniedNotice] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track SPA navigation to hide the FAB on the dedicated view.
  useEffect(() => {
    const sync = () => {
      const own = pathIsAssistantView(window.location.pathname);
      setOnOwnView(own);
      if (own) setOpen(false);
    };
    sync();
    document.addEventListener("astro:page-load", sync);
    return () => document.removeEventListener("astro:page-load", sync);
  }, []);

  // Helper: notifica al usuario que el módulo está deshabilitado y descarta
  // la solicitud. Usado tanto por la API global como por el listener de
  // eventos cuando `moduleEnabled===false`.
  function denyWithToast(reason: "disabled" | "no-permission"): void {
    const text =
      reason === "disabled"
        ? messages.drawer.moduleDisabled
        : messages.drawer.noPermission;
    setDeniedNotice(text);
    window.setTimeout(() => setDeniedNotice(null), 4000);
  }

  // Consumer del bridge `lxp:assistant:request v1`. Cuando estamos en la
  // vista dedicada NO somos el consumidor: el `AssistantPanel` de la view
  // ya gestiona las solicitudes vía su propia `__lxpAssistantAPI.request`.
  // Aquí solo consumimos cuando `!onOwnView`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (onOwnView) return; // cede a AssistantView

    const handlePrompt = (entry: AssistantRequestBusEntry) => {
      // Fail-closed: módulo realmente deshabilitado bloquea la instrucción
      // (no así `showFloatingButton=false`, que sólo apaga el FAB visible).
      if (moduleEnabled === false) {
        denyWithToast("disabled");
        return;
      }
      const prompt = (entry.request.kind === "prompt" ? entry.request.prompt : "") ?? "";
      if (!prompt.trim()) return;
      if (handledRequestIds.current.has(entry.requestId)) return;
      if (handledRequestIds.current.size > 100) handledRequestIds.current.clear();
      handledRequestIds.current.add(entry.requestId);
      setPendingRequest({
        requestId: entry.requestId,
        prompt,
        submit: entry.request.kind === "prompt" ? entry.request.submit : "prefill",
        providerId: entry.request.kind === "prompt" ? entry.request.providerId ?? null : null,
        serverEntries: entry.request.kind === "prompt" ? entry.request.serverEntries : undefined,
      });
      setOpen(true);
    };

    const handleNavigate = (entry: AssistantRequestBusEntry) => {
      if (moduleEnabled === false) {
        denyWithToast("disabled");
        return;
      }
      if (entry.request.kind !== "navigate") return;
      if (handledRequestIds.current.has(entry.requestId)) return;
      handledRequestIds.current.add(entry.requestId);
      const tab = entry.request.tab as RequestTab;
      setRequestedTab(tab);
      setRequestNonce((n) => n + 1);
      setOpen(true);
    };

    // 1) Registramos este drawer como consumidor válido de la cola FIFO
    //    del bridge del layout: ahora `request()` delega directamente.
    //    NO sobreescribimos si ya hay uno (la view podría haber ganado la
    //    carrera en onOwnView, pero como aquí onOwnView===false no debería
    //    ocurrir).
    const api = {
      request: (input: { kind: "prompt" | "navigate"; requestId?: string; prompt?: string; submit?: "auto" | "prefill"; providerId?: string | null; serverEntries?: import("@/lib/assistant-request").AssistantServerEntry[]; tab?: AssistantTab; origin?: { module: string; action: string } }) => {
        if (moduleEnabled === false) {
          denyWithToast("disabled");
          return "";
        }
        if (input.kind === "prompt") {
          handlePrompt({
            version: REQUEST_VERSION,
            requestId: input.requestId ?? `drawer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            request: {
              kind: "prompt",
              prompt: input.prompt ?? "",
              submit: input.submit ?? "prefill",
              providerId: input.providerId ?? null,
              serverEntries: input.serverEntries,
              target: { kind: "assistant", agentId: null, projectId: null },
              conversation: "new",
              origin: input.origin ?? { module: "unknown", action: "request" },
            },
            issuedAt: Date.now(),
          });
          return "";
        }
        handleNavigate({
          version: REQUEST_VERSION,
          requestId: input.requestId ?? `drawer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          request: {
            kind: "navigate",
            tab: (input.tab ?? "chat") as RequestTab,
            origin: input.origin ?? { module: "unknown", action: "request" },
          },
          issuedAt: Date.now(),
        });
        return "";
      },
    };
    window.__lxpAssistantAPI = api;

    // 2) Listener del CustomEvent; the requestId dedupes the same delivery
    //    through the API call and a later drain after hydration.
    const onRequest = (ev: Event) => {
      const entry = (ev as CustomEvent<AssistantRequestBusEntry>).detail;
      if (!entry || entry.version !== REQUEST_VERSION) return;
      if (entry.request.kind === "prompt") {
        handlePrompt(entry);
      } else {
        handleNavigate(entry);
      }
    };
    window.addEventListener(ASSISTANT_REQUEST_EVENT, onRequest);

    // 3) Drenamos la cola FIFO pendiente (solicitudes previas al mount).
    //    Sólo procesamos; NO las reenviamos a la API (sería bucle).
    const queued = drainAssistantRequestQueue();
    for (const entry of queued) {
      if (entry.request.kind === "prompt") handlePrompt(entry);
      else handleNavigate(entry);
    }

    return () => {
      window.removeEventListener(ASSISTANT_REQUEST_EVENT, onRequest);
      if (window.__lxpAssistantAPI === api) {
        // Regresamos al fallback del bridge (que sólo encola) para no dejar
        // la API global apuntando a un componente desmontado.
        delete window.__lxpAssistantAPI;
      }
    };
  }, [moduleEnabled, onOwnView, messages]);

  // Limpia la cola al cambiar de servidor: ya no aplica el contexto del
  // target anterior. El propio AssistantPanel recarga config en
  // target-changed; aquí evitamos arrastrar prompts de otro servidor.
  useEffect(() => {
    function onTargetChanged() {
      resetAssistantRequestBus();
      handledRequestIds.current.clear();
      setPendingRequest(null);
    }
    window.addEventListener("luxipanel:target-changed", onTargetChanged);
    return () => window.removeEventListener("luxipanel:target-changed", onTargetChanged);
  }, []);

  // Public window API + open-event listener for deep-links from other modules.
  // Mantiene compat temporal con `lxp:assistant:open` / `lxp:assistant:seed`
  // (legacy) durante esta fase; se retirarán en el siguiente step.
  useEffect(() => {
    const requestOpen = (t?: AssistantTab) => {
      if (t) {
        setRequestedTab(t);
        setRequestNonce((n) => n + 1);
      }
      setOpen(true);
    };
    const apiObj = {
      requestOpen,
      requestClose: () => setOpen(false),
    };
    window.__lxpFloatingAssistantAPI = apiObj;
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tab?: AssistantTab }>).detail;
      requestOpen(detail?.tab);
    };
    window.addEventListener("lxp:assistant:open", onOpen);
    // Seed deep-link LEGACY (deprecado). No descartamos por
    // `showFloatingButton===false`: el drawer debe abrir aunque el FAB esté
    // oculto. Si el módulo está deshabilitado, sí bloqueamos fail-closed.
    const onSeed = (ev: Event) => {
      if (moduleEnabled === false) {
        denyWithToast("disabled");
        return;
      }
      const detail = (ev as CustomEvent<{ prompt?: string; autoSend?: boolean; newChat?: boolean; provider?: string }>).detail;
      const prompt = (detail?.prompt ?? "").trim();
      if (!prompt) return;
      setSeed((prev) => ({
        text: prompt,
        autoSend: !!detail?.autoSend,
        newChat: !!detail?.newChat,
        provider: detail?.provider ?? null,
        nonce: (prev?.nonce ?? 0) + 1,
      }));
      requestOpen("chat");
    };
    window.addEventListener("lxp:assistant:seed", onSeed);
    return () => {
      window.removeEventListener("lxp:assistant:open", onOpen);
      window.removeEventListener("lxp:assistant:seed", onSeed);
      if (window.__lxpFloatingAssistantAPI === apiObj) {
        delete window.__lxpFloatingAssistantAPI;
      }
    };
  }, [moduleEnabled, messages]);

  // Keyboard shortcut: Ctrl/Cmd+J toggles el drawer. Se mantiene incluso
  // con FAB oculto: el atajo es la entrada de teclado al Asistente.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        if (moduleEnabled === false || onOwnView) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moduleEnabled, onOwnView]);

  // Reglas de visibilidad del FAB:
  //  - `mounted` evita el flash SSR → cliente: hasta que React no hidrate en el
  //    cliente, no se muestra nada (en SSR `onOwnView` vale false por
  //    `typeof window === "undefined"` y el FAB se pintaría erróneamente).
  //  - El módulo debe estar habilitado.
  //  - El toggle "Mostrar botón flotante" debe estar activo en /panel/modules.
  //  - En la vista dedicada `/panel/assistant` el FAB se oculta SIEMPRE: la
  //    página monta su propio `AssistantPanel` (single-instance) y dos FABs
  //    causarían eventos duplicados. Esto aplica incluso si el toggle está ON.
  //    (Con toggle OFF, el FAB ya estaría oculto por la condición previa en
  //    cualquier vista, incluida `/panel/assistant`.)
  //  - IMPORTANTE: `showFloatingButton=false` SOLO afecta a este FAB visible.
  //    Las solicitudes al Asistente siguen funcionando (el drawer abre por
  //    bridge aunque el botón esté oculto).
  const showFab =
    mounted &&
    moduleEnabled !== false &&
    showFloatingButton !== false &&
    !onOwnView;

  return (
    <>
      {showFab && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={messages.drawer.openAriaLabel}
          title={messages.drawer.openTitle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)] shadow-lg transition-all hover:scale-105 hover:bg-[var(--primary-hover)] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <i className="ti ti-sparkles text-xl" aria-hidden="true"></i>
        </button>
      )}

      {/* modal={false}: el drawer es pantalla completa, así que no necesita
          scroll-lock ni atrapar el foco. Desactivar la trampa de foco de Radix
          permite que los modales (ProjectModal, lightbox) portados a <body>
          conserven el foco de sus inputs en vez de que el drawer lo recupere. */}
      <Drawer open={open} onOpenChange={setOpen} dismissible={false} modal={false}>
        <DrawerContent
          className="!h-[var(--lxp-vvh,100dvh)] !max-h-[var(--lxp-vvh,100dvh)] !mt-0 !rounded-none !border-t-0 flex flex-col bg-card"
          onPointerDownOutside={(e) => e.preventDefault()}
          // Full-screen panel: the sr-only title says everything a screen
          // reader needs and there is no meaningful one-line description to
          // add. Radix demands EITHER a <Description> OR an explicit
          // `aria-describedby={undefined}` opt-out, and warns otherwise — this
          // is that opt-out, not a suppression hack.
          aria-describedby={undefined}
        >
          {/* No header — matches the terminal drawer. Title kept for a11y only. */}
          <DrawerTitle className="sr-only">{messages.drawer.title}</DrawerTitle>

          <AssistantPanel
            locale={locale}
            variant="drawer"
            onClose={() => setOpen(false)}
            requestedTab={requestedTab}
            requestNonce={requestNonce}
            seed={seed}
            onSeedConsumed={() => setSeed(null)}
            pendingRequest={pendingRequest}
            onPendingRequestConsumed={() => setPendingRequest(null)}
          />
        </DrawerContent>
      </Drawer>

      {/* Toast/empty-state cuando una solicitud llega pero el módulo está
          deshabilitado. role=status para que AT lo lea sin interrumpir. */}
      {deniedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-4 z-50 max-w-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 shadow-lg backdrop-blur-sm dark:text-amber-300"
        >
          {deniedNotice}
        </div>
      )}
    </>
  );
}
