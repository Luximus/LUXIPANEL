// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useModuleGate } from "@/lib/use-module-gate";
import { pathIsAssistantView, pathIsTerminalView } from "@/lib/panel-routes";
const TerminalPanel = lazy(() => import("./TerminalPanel"));
import { useTerminalMessages } from "./terminal-panel/use-terminal-messages";

declare global {
  interface Window {
    __lxpFloatingTerminalAPI?: {
      requestOpen(): void;
      requestClose(): void;
    };
    // Inyectado por el WebView de la app móvil (React Native).
    ReactNativeWebView?: { postMessage(message: string): void };
    /** Publicado por ChatPane: el scope visible del asistente es "Agentes IA". */
    __lxpAssistantAgentsScopeActive?: boolean;
  }
}

/**
 * En la vista dedicada del terminal (`/panel/terminal`) NO mostramos el FAB ni
 * dejamos abrir el drawer: la página monta su propia instancia de
 * `TerminalPanel`. Así hay UNA sola instancia montada a la vez → un único
 * `#terminal-container`, sin colisión de IDs ni sesiones xterm duplicadas.
 *
 * En la vista dedicada del Asistente IA tampoco mostramos el FAB del terminal:
 * ahí el chat ofrece un botón inline "Terminal" en la fila de selectores de
 * proveedor/modelo (ver ChatPane), que abre ESTE mismo drawer via
 * `window.__lxpFloatingTerminalAPI`. Ocultamos solo el FAB; el drawer y el
 * window API siguen montados para que ese botón inline funcione.
 *
 * Ambos predicados viven en `@/lib/panel-routes` (F-12).
 */

/**
 * FAB + drawer flotante del Terminal. El contenido lo aporta el componente
 * compartido `TerminalPanel` (mismo que usa la vista de página). Aquí solo vive
 * lo propio del modo drawer: estado `open`, gate del módulo, window API
 * (`__lxpFloatingTerminalAPI`, usado por ProvidersTab del asistente) y el
 * candado anti-cierre-por-gesto.
 */
export default function FloatingTerminalDrawer({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  // Slice i18n perezoso — hook compartido (F-13).
  const messages = useTerminalMessages(locale);
  // Hidratado en cliente: evita que el FAB parpadee durante el SSR (donde
  // `window` no existe y los estados arrancan en null/false) y luego desaparezca.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // El botón flotante se muestra solo si el módulo "terminal" está habilitado
  // en /panel/modules Y su toggle "Mostrar botón flotante" está activo. La
  // página de módulos emite "luxipanel:modules-changed" cuando cambian.
  // `null` = aún probando → optimista (true) para que el primer paint sea
  // rápido. `mounted` evita que el FAB aparezca en el SSR y desaparezca tras
  // hidratar (parpadeo visible).
  const { enabled: terminalModuleEnabled, showFloatingButton: terminalShowFloatingButton } =
    useModuleGate("terminal");
  const [terminalDrawerLocked, setTerminalDrawerLocked] = useState(false);
  const [onOwnView, setOnOwnView] = useState<boolean>(() =>
    typeof window !== "undefined" ? pathIsTerminalView(window.location.pathname) : false,
  );
  const [onAssistantView, setOnAssistantView] = useState<boolean>(() =>
    typeof window !== "undefined" ? pathIsAssistantView(window.location.pathname) : false,
  );
  // El asistente FLOTANTE (drawer a pantalla completa sobre cualquier módulo) NO
  // cambia el pathname, así que `onAssistantView` no lo cubre. ChatPane publica
  // `lxp:assistant:agents-scope` cuando su scope visible es "Agentes IA"; en ese
  // caso ocultamos el FAB (igual que en la vista dedicada). Fuera del scope de
  // agentes / con el asistente cerrado, la señal vuelve a false y el FAB reaparece.
  const [assistantAgentsScope, setAssistantAgentsScope] = useState<boolean>(() =>
    typeof window !== "undefined" ? !!window.__lxpAssistantAgentsScopeActive : false,
  );

  // Track SPA navigation to hide the FAB on the dedicated view.
  useEffect(() => {
    const sync = () => {
      const own = pathIsTerminalView(window.location.pathname);
      setOnOwnView(own);
      setOnAssistantView(pathIsAssistantView(window.location.pathname));
      if (own) setOpen(false);
    };
    sync();
    document.addEventListener("astro:page-load", sync);
    return () => document.removeEventListener("astro:page-load", sync);
  }, []);

  // Escucha la señal de scope "Agentes IA" del asistente flotante.
  useEffect(() => {
    const onScope = (ev: Event) => {
      setAssistantAgentsScope(!!(ev as CustomEvent<{ active?: boolean }>).detail?.active);
    };
    window.addEventListener("lxp:assistant:agents-scope", onScope);
    // Re-sincroniza por si la señal se emitió antes de montar este componente.
    setAssistantAgentsScope(!!window.__lxpAssistantAgentsScopeActive);
    return () => window.removeEventListener("lxp:assistant:agents-scope", onScope);
  }, []);

  // Window API: requestOpen lo usa ProvidersTab del asistente para revelar la
  // consola; también lo invoca el botón "Instalar" del propio panel.
  useEffect(() => {
    const apiObj = {
      requestOpen: () => { if (!isAdmin) return; if(window.__lxpInternalModules?.open("/panel/terminal"))return;setOpen(true); },
      requestClose: () => setOpen(false),
    };
    window.__lxpFloatingTerminalAPI = apiObj;
    return () => {
      if (window.__lxpFloatingTerminalAPI === apiObj) {
        delete window.__lxpFloatingTerminalAPI;
      }
    };
  }, [isAdmin]);

  const onLockedChange = useCallback((locked: boolean) => {
    setTerminalDrawerLocked(locked);
  }, []);

  // Reglas de visibilidad del FAB (mismas que en FloatingAssistantDrawer):
  //  - `mounted`: evita flash SSR → cliente.
  //  - Módulo "terminal" habilitado.
  //  - Toggle "Mostrar botón flotante" activo en /panel/modules.
  //  - En la vista dedicada `/panel/terminal` el FAB se oculta SIEMPRE (la
  //    página monta su propio `TerminalPanel` para mantener una sola
  //    instancia y un único `#terminal-container`). Con toggle OFF, además,
  //    el FAB ya estaría oculto en cualquier vista.
  const showFab =
    mounted &&
    isAdmin &&
    terminalModuleEnabled !== false &&
    terminalShowFloatingButton !== false &&
    !onOwnView &&
    // En el módulo Asistente el terminal se abre desde el botón inline del chat.
    !onAssistantView &&
    // Asistente flotante en el tab "Agentes IA": ese tab no ofrece FAB de terminal.
    !assistantAgentsScope;

  return (
    <>
      {/* Botón flotante de terminal. */}
      {showFab && (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            data-module="terminal"
            onClick={() => {if(!window.__lxpInternalModules?.open("/panel/terminal"))setOpen(true);}}
            aria-label={messages.fab.openTerminal}
            title={messages.fab.openTerminal}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--primary-foreground)] shadow-lg transition-all hover:scale-105 hover:bg-[var(--primary-hover)] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <i className="ti ti-terminal-2 text-xl" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {isAdmin && <Drawer
        open={open}
        onOpenChange={(next) => {
          // Si el drawer está bloqueado (candado), ignoramos cierres por gesto/
          // overlay. Sólo dejamos pasar el abrir o el cierre explícito por botón.
          if (terminalDrawerLocked && !next) return;
          setOpen(next);
        }}
        dismissible={!terminalDrawerLocked}
        // modal={false}: el drawer ocupa toda la pantalla. Sin la trampa de foco
        // de Radix, el <dialog> nativo de snippets (showModal → top layer) y su
        // editor Monaco conservan el foco.
        modal={false}
      >
        <DrawerContent
          className="!h-[100dvh] !max-h-[100dvh] !mt-0 !rounded-none !border-t-0 flex flex-col bg-card"
          // See FloatingAssistantDrawer: full-screen panel with an sr-only
          // title and no useful description — explicit Radix opt-out.
          aria-describedby={undefined}
        >
          <DrawerTitle className="sr-only">{messages.drawerTitle}</DrawerTitle>
          <Suspense fallback={null}><TerminalPanel
            variant="drawer"
            locale={locale}
            onClose={() => setOpen(false)}
            onRequestVisible={() => setOpen(true)}
            onLockedChange={onLockedChange}
          /></Suspense>
        </DrawerContent>
      </Drawer>}
    </>
  );
}
