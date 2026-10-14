// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useModalClose } from "@/components/ui/use-deferred-close";

/**
 * ModalNavbar (React) — the React twin of ModalNavbar.astro. Renders the same
 * panel-topbar-style modal header for React dialogs (floating assistant,
 * messenger, files, …): compact h-14 row with an optional icon-only
 * chevron-left back button, a font-semibold title (description surfaced as a
 * native `title` tooltip, never a subtitle), a pill actions cluster and a ✕
 * close button.
 *
 * Contract for consumers (tanda 2):
 *   title        modal title.
 *   description? native `title` tooltip on the heading (no subtitle text).
 *   icon?        optional leading Tabler icon class (e.g. "ti-folder-key").
 *   onBack?      when provided, renders the chevron-left back button.
 *   backLabel?   aria-label/title for back (pass an i18n string).
 *   onClose      close handler for the ✕ button.
 *   closeLabel?  aria-label for close (pass an i18n string).
 *   hideClose?   when true, the ✕ button is not rendered (e.g. a wizard that
 *                must not be dismissed from the header).
 *   leading?     custom node rendered in the left icon slot (before the
 *                title); takes precedence over `icon`.
 *   actions?     pill-style actions rendered left of the ✕.
 *   className?   extra classes for the header row.
 *
 * aria-labels default to English; pass localized strings from the consumer's
 * i18n subtree (the panel's React islands own their translation lookup).
 */
export type ModalNavbarProps = {
  title: ReactNode;
  description?: string;
  icon?: string;
  onBack?: () => void;
  backLabel?: string;
  onClose: () => void;
  closeLabel?: string;
  hideClose?: boolean;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ModalNavbar({
  title,
  description,
  icon,
  onBack,
  backLabel,
  onClose,
  closeLabel,
  hideClose,
  leading,
  actions,
  className,
}: ModalNavbarProps) {
  // Inside a ModalShell the ✕ plays the shell's exit animation (200ms
  // ease-out, motion standard) before running the consumer's `onClose`.
  const shellClose = useModalClose();
  const handleClose = shellClose ? () => shellClose.requestClose(onClose) : onClose;
  return (
    <div className={cn("flex h-14 items-center gap-3 border-b border-border px-4", className)}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={backLabel}
          title={backLabel}
        >
          <i className="ti ti-chevron-left text-lg" />
        </button>
      )}

      <div className="flex min-w-0 items-center gap-2">
        {leading ?? (icon && <i className={cn("ti shrink-0 text-lg text-primary", icon)} />)}
        <h3 className="truncate text-base font-semibold" title={description}>
          {title}
        </h3>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {actions}
        {!hideClose && (
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={closeLabel}
          >
            <i className="ti ti-x text-lg" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ModalNavbar;
