// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Host GLOBAL de sesiones vivas (fase B2).
 *
 * Renderiza CADA consola tmux nativa viva de TODAS las pestañas —
 * `NativeTerminalSession` —
 * SIEMPRE montada, para que navegar/cambiar de pestaña NUNCA mate conexiones:
 *  - `bound`: posicionada absoluta sobre el rect que publicó la pantalla
 *    (`SessionSurfaceTarget` de TerminalScreen / ModuleWebViewScreen);
 *  - oculta: consolas con `display:none` (el emulador no recalcula grilla
 *    ni re-dimensiona el PTY).
 *
 * Las sesiones se leen de `console-sessions-store`: cerrar una sesión en el
 * store la desmonta aquí.
 * Los props/callbacks por pestaña llegan por `session-env` (los publica cada
 * MainTab). Se monta en MainScreen ENCIMA del contenido de pestañas y DEBAJO
 * de los drawers globales/toasts del shell (los overlays por-tab que hoy van
 * encima —módulo nativo, picker, activación diferida— se emulan con
 * `env.suppressed`, y el drawer del servidor sobre una sesión ya usa RN Modal).
 */
import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import NativeTerminalSession from "../components/NativeTerminalSession";
import {
  registerConsoleInjector,
  useConsolesByTab,
  type ConsoleSession,
} from "../lib/console-sessions-store";
import { requestSurfaceMeasure, surfaceKey, useSurface, type SurfaceRect } from "./surface-registry";
import { useSessionEnvs, type SessionTabEnv } from "./session-env";
import { styles } from "./SessionHost.styles";

type HostOrigin = { x: number; y: number };

/** Estilo absoluto de una sesión visible: rect en ventana → coordenadas del host. */
function boundStyle(rect: SurfaceRect, origin: HostOrigin) {
  return {
    left: rect.x - origin.x,
    top: rect.y - origin.y,
    width: rect.width,
    height: rect.height,
  };
}

function ConsoleLayer({
  tabId,
  session,
  env,
  origin,
}: {
  tabId: string;
  session: ConsoleSession;
  env: SessionTabEnv;
  origin: HostOrigin;
}) {
  const surface = useSurface(surfaceKey(tabId, session.id));
  const shown = surface.status === "bound" && env.isActiveTab && !env.suppressed;
  return (
    <View
      style={shown ? [styles.bound, boundStyle(surface.rect, origin)] : styles.hiddenNone}
      pointerEvents={shown ? "auto" : "none"}
    >
      {/* Swipe lateral sobre el terminal (abre drawers): réplica del gesto del
          shell del MainTab, que ya no es ancestro de la sesión. */}
      <PanGestureHandler
        enabled={shown && Boolean(env.consoles.onSwipe)}
        onHandlerStateChange={env.consoles.onSwipe}
        activeOffsetX={[-8, 8]}
        failOffsetY={[-28, 28]}
      >
        <View style={styles.fill}>
          <NativeTerminalSession
            panelId={session.panelId}
            token={env.consoles.token}
            language={env.consoles.language}
            // Id estable de la consola → reattach con tmux server-side.
            sessionId={session.id}
            // Botón atrás = MINIMIZAR (la consola sigue viva), pero lo resuelve
            // el BackHandler del MainTab activo en `MainScreen` (caso
            // `consoleOverlayVisible` → `minimizeConsoles`), NO la sesión:
            // montada siempre en este host, un handler propio consumiría el
            // "atrás" incluso minimizada o en pestañas inactivas.
            onRegisterInjector={(inject) => registerConsoleInjector(session.id, inject)}
            // Tabs del servidor (Terminal / Chat / Ajustes) pintados ARRIBA del
            // terminal; tocar uno abre el drawer en esa sección.
            topTabs={env.consoles.topTabs}
            onSelectTopTab={env.consoles.onSelectTopTab}
            // Los TECLEADOS van al historial de comandos; los inyectados
            // (snippets/reanudar) NO, pero ambos actualizan el auto-rótulo.
            onCommand={(cmd, injected) => env.consoles.onCommand(session.id, cmd, injected)}
          />
        </View>
      </PanGestureHandler>
    </View>
  );
}

export function SessionHost() {
  const envs = useSessionEnvs();
  const consolesByTab = useConsolesByTab();
  const rootRef = useRef<View | null>(null);
  const [origin, setOrigin] = useState<HostOrigin>({ x: 0, y: 0 });

  // Origen del host en ventana: los rects de las superficies llegan en
  // coordenadas de ventana y aquí se convierten a coordenadas del host. Si el
  // layout del host cambia (p. ej. navbar que aparece/desaparece) se re-mide y
  // se pide a los targets que re-publiquen (su layout local pudo no cambiar).
  const measureOrigin = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      setOrigin((prev) => (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5 ? prev : { x, y }));
      requestSurfaceMeasure();
    });
  }, []);

  return (
    <View
      ref={rootRef}
      style={styles.host}
      pointerEvents="box-none"
      collapsable={false}
      onLayout={measureOrigin}
    >
      {Object.keys(envs).map((tabId) => {
        const env = envs[tabId];
        // Réplica del gate `shellVisible` del MainTab: en splash/carga/login/ssh
        // los overlays NO se montaban (sus sesiones se desmontan igual que antes).
        if (!env.shellVisible) return null;
        const consolesTab = consolesByTab[tabId];
        // Solo las MONTADAS renderizan sesión (las restauradas frías no, hasta
        // activarlas). Consolas: nunca en invitado (paridad con el overlay previo).
        const consoles = env.consoles.guestMode
          ? []
          : (consolesTab?.consoles ?? []).filter((c) => consolesTab!.mountedIds.includes(c.id));
        return (
          <React.Fragment key={tabId}>
            {consoles.map((c) => (
              <ConsoleLayer key={c.id} tabId={tabId} session={c} env={env} origin={origin} />
            ))}
          </React.Fragment>
        );
      })}
    </View>
  );
}
