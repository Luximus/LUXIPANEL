import { createPortal } from "react-dom";
import { AppWindow } from "lucide-react";
import type { AppTab } from "../features/app/types";
import { getMessages } from "../i18n";
import { localizeAutoLabel } from "../features/app/sectionNav";
import type { TabSwitcherState } from "../hooks/useTabSwitcher";

/**
 * Overlay del cambiador de pestañas (Ctrl+Tab). Rejilla de miniaturas estilo
 * "vista de tareas" de Windows; resalta la pestaña seleccionada. Ver
 * `useTabSwitcher`.
 */
export function TabSwitcherOverlay({
  overlay,
  tabs,
  thumbs,
  version,
  onSelect,
  language,
}: {
  overlay: TabSwitcherState;
  tabs: AppTab[];
  thumbs: Map<string, string>;
  /** Cambia cuando se actualiza una miniatura → fuerza re-render. */
  version: number;
  onSelect: (id: string) => void;
  language?: string;
}) {
  if (!overlay.open) return null;
  const t = getMessages(language);
  const items = overlay.order
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab): tab is AppTab => Boolean(tab));
  if (items.length < 2) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] grid place-items-center bg-black/55 p-8 backdrop-blur-sm"
      data-version={version}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onSelect(overlay.order[overlay.sel]); }}
    >
      <div className="flex max-h-full max-w-6xl flex-wrap items-stretch justify-center gap-4 overflow-auto">
        {items.map((tab) => {
          const selected = overlay.order[overlay.sel] === tab.id;
          const label = tab.customLabel?.trim() || localizeAutoLabel(t, tab.autoLabel);
          const thumb = thumbs.get(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              className={`group flex w-64 flex-col overflow-hidden rounded-xl border-2 bg-base-100 text-start shadow-xl transition ${
                selected ? "border-primary ring-2 ring-primary/50" : "border-base-300/60 hover:border-base-300"
              }`}
              onClick={() => onSelect(tab.id)}
            >
              <div className="flex h-36 w-full items-center justify-center overflow-hidden bg-base-200">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
                ) : (
                  <AppWindow size={40} className="opacity-30" />
                )}
              </div>
              <div className={`truncate px-3 py-2 text-sm font-semibold ${selected ? "text-primary" : "text-base-content/80"}`}>
                {label}
              </div>
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
