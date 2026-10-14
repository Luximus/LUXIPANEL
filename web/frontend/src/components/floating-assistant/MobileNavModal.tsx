// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createPortal } from "react-dom";
import { ProviderIcon } from "./ProviderIcon";
import { type AssistantProviderId } from "./assistant-api";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { useDeferredClose } from "@/components/ui/use-deferred-close";
import { backdropMotionClass } from "@/components/ui/ModalShell";
import { cn } from "@/lib/utils";
import { useAssistantI18n } from "./i18n";

/** One selectable row in a mobile nav modal (provider / section switcher). */
export interface MobileNavOption {
  id: string;
  label: string;
  /** Small uppercase suffix (e.g. a provider mode "cli"/"api"). */
  mode?: string;
  /** ti-* icon class for non-provider entries (sections). */
  iconClass?: string;
  /** Render the provider glyph for this entry instead of an icon class. */
  provider?: boolean;
}

/** A mobile switcher's option list + current selection + setter. */
export interface MobileNavController {
  options: MobileNavOption[];
  /** Currently selected option id. */
  selected: string;
  onSelect: (id: string) => void;
}

/**
 * Bottom-sheet picker used on phones to replace the chat tab's two full-width
 * option strips (the provider sub-tabs and the main section nav). On mobile each
 * strip collapses to a single icon button in the composer that opens one of
 * these modals — one row of options per modal. Desktop keeps the inline strips
 * and never renders this.
 */
export function MobileNavModal({
  title,
  controller,
  onClose: onCloseProp,
}: {
  title: string;
  controller: MobileNavController;
  onClose: () => void;
}) {
  // Keep the drawer interactive while this portal sits above it (vaul sets
  // body `pointer-events: none` otherwise — same fix the other modals use).
  useBodyPointerEventsWhileOpen(true);
  const i18n = useAssistantI18n();
  // Exit animation (200ms ease-out, motion standard) before unmount.
  const { closing, requestClose } = useDeferredClose(onCloseProp);
  const onClose = () => requestClose();
  return createPortal(
    <div
      className={cn("fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4", backdropMotionClass(closing), closing && "pointer-events-none")}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "flex max-h-[70vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-sm sm:rounded-xl",
          "duration-200 ease-out fill-mode-forwards motion-reduce:animate-none",
          closing ? "animate-out slide-out-to-bottom fade-out-0 sm:zoom-out-95" : "animate-in slide-in-from-bottom fade-in-0 sm:zoom-in-95",
        )}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ModalNavbar title={title} onClose={onClose} closeLabel={i18n.drawer.close} />
        {/* Extra bottom padding lifts the last row above the Android system
            navbar (and the home indicator) so it's never covered. */}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)]">
          {controller.options.map((opt) => {
            const active = controller.selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  controller.onSelect(opt.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="shrink-0 text-lg leading-none">
                  {opt.provider ? (
                    <ProviderIcon id={opt.id as AssistantProviderId} className="text-lg" />
                  ) : (
                    <i className={`ti ${opt.iconClass ?? "ti-point"}`} aria-hidden></i>
                  )}
                </span>
                <span className="capitalize">{opt.label}</span>
                {opt.mode && <span className="text-[10px] uppercase opacity-60">{opt.mode}</span>}
                {active && <i className="ti ti-check ml-auto text-primary" aria-hidden></i>}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
