import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { AppTab } from "../features/app/types";
import { getMessages } from "../i18n";
import { localizeAutoLabel, type SectionNavItem } from "../features/app/sectionNav";
import { AccountMenu } from "./AccountMenu";
import { Tooltip } from "./ui/Tooltip";
import type { NavbarChrome } from "./AppNavbar";

/**
 * Nivel 1 del chrome: barra de título fina y arrastrable (Electron) con el
 * logo, las pestañas tipo navegador y los controles de ventana. La navegación
 * de sección, las acciones contextuales, el tema, la cuenta y el asistente
 * viven en el nivel 2 (`AppNavbar`).
 */
export function TitleBarTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onOpenNewTab,
  onRenameTab,
  onLogoClick,
  canOpenNewTab = true,
  navEnabled = true,
  language,
  chrome,
  sectionNav,
}: {
  tabs: AppTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onOpenNewTab: () => void;
  onRenameTab: (tabId: string, label: string) => void;
  onLogoClick: () => void;
  canOpenNewTab?: boolean;
  navEnabled?: boolean;
  language?: string;
  /** Tema + cuenta de la pestaña activa (a la izquierda de los controles de
   *  ventana). `null` en pantallas sin sesión (login/splash). */
  chrome?: NavbarChrome | null;
  /** Navegación de sección (Servidores/Soporte/Pagos/Admin). Vive a la derecha
   *  de la cuenta en la barra de título (antes en la barra intermedia). */
  sectionNav?: SectionNavItem[];
}) {
  const t = getMessages(language);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  return (
    <div className="titlebar-drag fixed inset-x-0 top-0 z-50 flex h-[var(--lp-titlebar-h)] items-center border-b border-base-300/60 bg-base-100/35 ps-2 backdrop-blur-xs">
      {navEnabled ? (
        <Tooltip tip={t.titleBar.goToServers} position="bottom" className="titlebar-no-drag me-1">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-sm px-1 hover:bg-base-200/60"
            onClick={onLogoClick}
          >
            <img src="/logo.webp" alt={t.titleBar.logoAlt} className="h-5 w-auto object-contain" />
          </button>
        </Tooltip>
      ) : (
        <span className="titlebar-no-drag me-1 inline-flex h-9 items-center px-1">
          <img src="/logo.webp" alt={t.titleBar.logoAlt} className="h-5 w-auto object-contain" />
        </span>
      )}
      {tabs.map((tab) => {
        const label = tab.customLabel?.trim() || localizeAutoLabel(t, tab.autoLabel);
        const isEditing = editingTabId === tab.id;
        return (
          <button
            key={tab.id}
            className={`titlebar-no-drag group inline-flex h-9 items-center gap-2 border px-3 text-sm ${
              activeTabId === tab.id
                ? "border-base-300 border-b-transparent bg-base-100 text-base-content"
                : "border-transparent bg-transparent text-base-content/70 hover:bg-base-200/50 hover:text-base-content"
            }`}
            onClick={() => onSelectTab(tab.id)}
            onDoubleClick={() => {
              setEditingTabId(tab.id);
              setDraftLabel(label);
            }}
            title={label}
          >
            {isEditing ? (
              <input
                className="titlebar-no-drag input input-xs h-5 w-36 border-base-300 bg-base-100 px-1 text-xs"
                value={draftLabel}
                autoFocus
                onChange={(event) => setDraftLabel(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onBlur={() => {
                  onRenameTab(tab.id, draftLabel);
                  setEditingTabId(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onRenameTab(tab.id, draftLabel);
                    setEditingTabId(null);
                  }
                  if (event.key === "Escape") {
                    setEditingTabId(null);
                  }
                }}
              />
            ) : (
              <span>{label}</span>
            )}
            {tabs.length > 1 ? (
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-xs text-base-content/60 hover:bg-base-300/70 hover:text-base-content"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <X size={12} />
              </span>
            ) : null}
          </button>
        );
      })}

      {canOpenNewTab ? (
        <Tooltip tip={t.titleBar.newTab} position="bottom" className="titlebar-no-drag ms-1">
          <button className="inline-flex h-7 w-7 items-center justify-center text-base-content/70 hover:bg-base-200/60 hover:text-base-content" onClick={onOpenNewTab} aria-label={t.titleBar.newTab}>
            <Plus size={14} />
          </button>
        </Tooltip>
      ) : null}

      <div className="ms-auto flex items-center">
        {chrome ? (
          <div className="titlebar-no-drag pe-2">
            <AccountMenu
              theme={chrome.theme}
              toggleTheme={chrome.toggleTheme}
              language={chrome.language}
              setLanguage={chrome.setLanguage}
              displayName={chrome.displayName}
              switchAccount={chrome.switchAccount}
              logout={chrome.logout}
              tokensAvailable={chrome.tokensAvailable}
              openSignal={chrome.accountOpenSignal}
              sectionNav={sectionNav}
            />
          </div>
        ) : null}
        {/* La navegación de sección (Servidores/Soporte/Pagos/Admin) ya NO se
            muestra aquí: vive en el desplegable del botón de cuenta
            (`AccountMenu`), al que `sectionNav` se sigue pasando. */}
        <div className="titlebar-no-drag flex items-stretch self-stretch">
          <Tooltip tip={t.titleBar.minimize} position="bottom" display="flex">
            <button className="h-[var(--lp-titlebar-h)] w-11 text-base-content/75 hover:bg-base-200/70" aria-label={t.titleBar.minimize} onClick={() => void window.electronApi?.minimizeWindow()}>-</button>
          </Tooltip>
          <Tooltip tip={t.titleBar.maximize} position="bottom" display="flex">
            <button className="h-[var(--lp-titlebar-h)] w-11 text-base-content/75 hover:bg-base-200/70" aria-label={t.titleBar.maximize} onClick={() => void window.electronApi?.toggleMaximizeWindow()}>□</button>
          </Tooltip>
          <Tooltip tip={t.titleBar.close} position="bottom" display="flex">
            <button className="h-[var(--lp-titlebar-h)] w-11 text-base-content/75 hover:bg-red-600 hover:text-white" aria-label={t.titleBar.close} onClick={() => void window.electronApi?.closeWindow()}>×</button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
