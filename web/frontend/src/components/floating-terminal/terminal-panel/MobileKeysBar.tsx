// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { TerminalMessages } from "../i18n";
import {
  SIDEBAR_TABS,
  SIDEBAR_TAB_ICONS,
  dismissMobileKeyboard,
  sidebarTabLabel,
} from "./helpers";
import type { SidebarTab } from "./types";

// Las 13 teclas del accessory bar eran 13 <button> idénticos salvo `data-tk`,
// las claves i18n de aria/title y el contenido (texto o icono) — F-24. Se
// declaran como datos y se renderizan con .map; el markup emitido (incluido el
// `data-tk` que engancha el JS vanilla) es exactamente el mismo.
const MOBILE_KEY_BASE =
  "inline-flex items-center justify-center rounded-lg border border-border bg-background py-2 text-foreground active:bg-accent";
/** Las teclas etiquetadas con TEXTO añaden el tamaño/peso de fuente. */
const MOBILE_KEY_TEXT = "text-[11px] font-medium";

type MobileKeySpec = {
  tk: string;
  aria: keyof TerminalMessages["mobileKeys"];
  title: keyof TerminalMessages["mobileKeys"];
  /** Etiqueta textual, o `icon` para las flechas. */
  label?: string;
  icon?: string;
};

const MOBILE_KEY_ROW_1: MobileKeySpec[] = [
  { tk: "esc", aria: "escAria", title: "escTitle", label: "ESC" },
  { tk: "tab", aria: "tabAria", title: "tabTitle", label: "TAB" },
  { tk: "ctrl", aria: "ctrlAria", title: "ctrlTitle", label: "CTRL" },
  { tk: "alt", aria: "altAria", title: "altTitle", label: "ALT" },
  { tk: "pgup", aria: "pgUpAria", title: "pgUpTitle", label: "PgUp" },
  { tk: "pgdn", aria: "pgDnAria", title: "pgDnTitle", label: "PgDn" },
  { tk: "slash", aria: "slashAria", title: "slashTitle", label: "/" },
];

const MOBILE_KEY_ROW_2: MobileKeySpec[] = [
  { tk: "home", aria: "homeAria", title: "homeTitle", label: "HOME" },
  { tk: "left", aria: "leftAria", title: "leftTitle", icon: "ti-arrow-left" },
  { tk: "up", aria: "upAria", title: "upTitle", icon: "ti-arrow-up" },
  { tk: "down", aria: "downAria", title: "downTitle", icon: "ti-arrow-down" },
  { tk: "right", aria: "rightAria", title: "rightTitle", icon: "ti-arrow-right" },
  { tk: "end", aria: "endAria", title: "endTitle", label: "END" },
];

function MobileKey({ spec, messages }: { spec: MobileKeySpec; messages: TerminalMessages }) {
  return (
    <button
      type="button"
      data-tk={spec.tk}
      aria-label={messages.mobileKeys[spec.aria]}
      title={messages.mobileKeys[spec.title]}
      className={spec.icon ? MOBILE_KEY_BASE : `${MOBILE_KEY_BASE} ${MOBILE_KEY_TEXT}`}
    >
      {spec.icon ? <i className={`ti ${spec.icon} text-lg`}></i> : spec.label}
    </button>
  );
}

interface MobileKeysBarProps {
  messages: TerminalMessages;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  keyboardOpen: boolean;
  keyboardInset: number;
}

/**
 * Barra inferior móvil: tira de pestañas del sidebar + teclado para
 * programadores. Vive fuera del flex principal para no quedar tapada por
 * el panel lateral cuando éste se desliza.
 *
 * Sólo se muestra en móvil y SÓLO mientras el teclado virtual está
 * desplegado (`keyboardOpen`): se ancla con `position: fixed` justo por
 * encima del teclado (`bottom: keyboardInset`). Cuando el teclado está
 * cerrado se mantiene en el DOM pero oculto (`hidden`) para que el JS
 * vanilla pueda seguir enlazando `#lxp-terminal-mobilekeys` una sola vez.
 * El contenedor de la terminal queda full-bleed detrás; la barra flota
 * encima de su franja inferior, como un accessory bar nativo.
 */
export function MobileKeysBar({
  messages,
  sidebarTab,
  setSidebarTab,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  keyboardOpen,
  keyboardInset,
}: MobileKeysBarProps) {
  return (
    <div
      className={
        keyboardOpen && !mobileSidebarOpen
          ? "md:hidden fixed inset-x-0 z-50 border-t border-border bg-card/95 shadow-2xl backdrop-blur-sm"
          : "hidden"
      }
      style={keyboardOpen && !mobileSidebarOpen ? { bottom: keyboardInset } : undefined}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        {SIDEBAR_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setSidebarTab(t);
              setMobileSidebarOpen(true);
              // Al desplegar el panel lateral, repliega el teclado virtual
              // para que el panel quede por encima de la barra auxiliar.
              dismissMobileKeyboard();
            }}
            className={
              mobileSidebarOpen && sidebarTab === t
                ? "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] font-medium text-primary"
                : "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground active:bg-accent"
            }
            aria-label={sidebarTabLabel(messages, t)}
            title={sidebarTabLabel(messages, t)}
          >
            <i className={`ti ${SIDEBAR_TAB_ICONS[t]} text-sm`}></i>
            <span>{sidebarTabLabel(messages, t)}</span>
          </button>
        ))}
      </div>

      <div
        id="lxp-terminal-mobilekeys"
        role="toolbar"
        aria-label={messages.mobileKeys.toolbarAria}
        className="flex flex-col gap-1 px-2 py-1.5"
      >
        {/* Fila 1 — modificadores, paginación y candado. */}
        <div className="grid grid-cols-7 gap-1">
          {MOBILE_KEY_ROW_1.map((key) => (
            <MobileKey key={key.tk} spec={key} messages={messages} />
          ))}
        </div>
        {/* Fila 2 — movimiento. */}
        <div className="grid grid-cols-6 gap-1">
          {MOBILE_KEY_ROW_2.map((key) => (
            <MobileKey key={key.tk} spec={key} messages={messages} />
          ))}
        </div>
      </div>
    </div>
  );
}
