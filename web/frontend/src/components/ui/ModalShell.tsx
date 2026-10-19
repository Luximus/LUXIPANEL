// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useId, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { cn } from "@/lib/utils";
import { ModalCloseContext, useDeferredClose, type DeferredClose } from "@/components/ui/use-deferred-close";

export type ModalShellProps = {
  /**
   * Close handler. Wired to: backdrop click, Escape key, and the built-in
   * close button (structured header) or the header chrome supplied via
   * `children`.
   */
  onClose: () => void;
  /** z-index class. Defaults to 9999 (panel-dialog conventions). */
  zIndexClass?: string;
  /** Numeric layer for drawers opened above another drawer. */
  zIndex?: number;
  /** Keep a covered drawer mounted without allowing interaction or focus. */
  inactive?: boolean;
  /** Background opacity / blur. Defaults to the panel-dialog style. */
  backdropClass?: string;
  /** Wrapping classes for the content card. */
  cardClassName?: string;
  /** Disable the Escape-to-close handler (e.g. while saving). */
  closeOnEscape?: boolean;
  /** Prevent dismissal before any exit animation, including nested close controls. */
  closeDisabled?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /**
   * Presentation:
   *   * `"drawer"` (default) — anchored to the RIGHT edge, full height, slides
   *     in from the right. Width: 40vw on ≥1024px, 60vw on 640–1023px, 100vw
   *     below 640px. Rounded only on its left (inner) edge.
   *   * `"centered"` — legacy centered card (opt-out for viewers/nav that must
   *     stay centered or full-bleed).
   */
  variant?: "drawer" | "centered";

  // ── Structured header/body/footer API (all optional) ───────────────────────
  // When `title` OR `footer` is provided, ModalShell renders a standard drawer
  // skeleton: a FIXED header (via ModalNavbar: optional back button + title +
  // close), a `flex-1` scrollable BODY wrapping `children`, and a FIXED FOOTER
  // anchored to the bottom. Without either, `children` are rendered raw (full
  // backward-compatibility for consumers that supply their own ModalNavbar).
  /** Header title. Enables the structured header. */
  title?: ReactNode;
  /** Optional leading Tabler icon class for the header (e.g. "ti-plug"). */
  icon?: string;
  /** Native `title` tooltip on the header heading (no subtitle text). */
  description?: string;
  /** When provided, the header shows a chevron-left back button. */
  onBack?: () => void;
  /** aria-label/title for the back button. */
  backLabel?: string;
  /** aria-label for the close button. */
  closeLabel?: string;
  /** Pill-style actions rendered in the header, left of the ✕. */
  headerActions?: ReactNode;
  /** Hide the header ✕ close button (structured header only). */
  hideClose?: boolean;
  /** Footer content (typically the action buttons). Anchored to the bottom. */
  footer?: ReactNode;
  /** Extra classes (merged) for the scrollable body wrapper. */
  bodyClassName?: string;

  /**
   * Ref to the fixed overlay element (e.g. a consumer's document-level focus
   * guard that must know whether a focus move enters/leaves this modal).
   */
  overlayRef?: Ref<HTMLDivElement>;
  /**
   * Externally-owned exit controller (`useDeferredClose`). When the consumer's
   * view-model already owns the close lifecycle (save/delete → close), pass its
   * controller so backdrop/Escape/✕ and the consumer's own close paths share
   * ONE `closing` phase (one exit animation, no double `onClose`). Omit and the
   * shell creates its own from `onClose`.
   */
  closeController?: DeferredClose;
  /** Children rendered as the dialog body. */
  children: ReactNode;
};

/**
 * Shared modal chrome: backdrop + Escape-to-close + body pointer-events, plus
 * an optional structured header/body/footer skeleton.
 *
 * The same backdrop chrome was duplicated across `OfficeConnectors.tsx`,
 * `ConversationMedia.tsx`, `DashboardTab.tsx`, `StructurePanel.tsx`,
 * `TeamTemplatesModal.tsx` and `AssistantFileEditorModal.tsx`. This component
 * factors out the boilerplate (portal, fixed inset-0 overlay, backdrop click,
 * stopPropagation in the card) so the modal bodies can focus on content.
 *
 * Special cases kept local:
 *   * Carousel variant (`ConversationMedia` ImageCarousel): full-bleed,
 *     backdrop is darker (`bg-black/85`), and it handles Arrow keys in
 *     addition to Escape.
 *   * Any modal where `confirm-while-dirty` matters
 *     (`AssistantFileEditorModal`): the close handler asks for confirmation
 *     before invoking `onClose`.
 */
/**
 * Right drawer card chrome. Anchored to the right edge, full viewport height,
 * `flex flex-col` so a structured header/body/footer fills the height (the
 * body owns the scroll). `fixed` so it ignores the overlay's flex/padding and
 * always hugs the edge. Rounded only on the left (inner) edge, flat below
 * 640px (full-width). `slide-in-from-right` (tw-animate-css) honours
 * `prefers-reduced-motion` via `motion-reduce:animate-none`.
 */
/**
 * The metrics themselves, WITHOUT the positioning strategy and without
 * `@container` (F-16). Exported so the two drawers that must keep their own
 * card (`ProjectModalView` — `overlayRef` focus guard + spinner;
 * `TeamTemplatesModal` — deliberately non-dismissable wizard) stop re-typing the
 * `40vw / 60vw / 100vw`, `h-dvh`, `rounded-l-[0.3rem]`, `slide-in-from-right`
 * chain. They anchor with `absolute` inside their own overlay, so the position
 * class stays at the call site.
 */
export const DRAWER_CARD_BASE =
  "inset-y-0 right-0 h-dvh w-[40vw] max-lg:w-[60vw] max-sm:w-full " +
  "flex flex-col border-l border-border bg-card shadow-2xl " +
  "rounded-l-[0.3rem] max-sm:rounded-none";

/** Motion standard (motion.css / left sidebar): 200ms ease-out, in AND out. */
export const DRAWER_CARD_ENTER = "animate-in slide-in-from-right fade-in-0 duration-200 ease-out motion-reduce:animate-none";
export const DRAWER_CARD_EXIT = "animate-out slide-out-to-right fade-out-0 duration-200 ease-out fill-mode-forwards motion-reduce:animate-none";
export const CENTERED_CARD_ENTER = "animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none";
export const CENTERED_CARD_EXIT = "animate-out fade-out-0 zoom-out-95 duration-200 ease-out fill-mode-forwards motion-reduce:animate-none";
export const BACKDROP_ENTER = "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none";
export const BACKDROP_EXIT = "animate-out fade-out-0 duration-200 ease-out fill-mode-forwards motion-reduce:animate-none";

/** Drawer card classes for the given phase (`closing` → exit animation). */
export function drawerCardClass(closing: boolean): string {
  return `${DRAWER_CARD_BASE} ${closing ? DRAWER_CARD_EXIT : DRAWER_CARD_ENTER}`;
}
/** Backdrop/overlay classes for the given phase. */
export function backdropMotionClass(closing: boolean): string {
  return closing ? BACKDROP_EXIT : BACKDROP_ENTER;
}

/** @deprecated kept for callers that only need the entering card; prefer `drawerCardClass(closing)`. */
export const DRAWER_CARD_METRICS = `${DRAWER_CARD_BASE} ${DRAWER_CARD_ENTER}`;

export const DRAWER_CARD = `fixed @container ${DRAWER_CARD_METRICS}`;

export function ModalShell({
  onClose,
  zIndexClass = "z-[9999]",
  zIndex,
  inactive = false,
  backdropClass = "bg-black/50 backdrop-blur-sm",
  cardClassName,
  closeOnEscape = true,
  closeDisabled = false,
  ariaLabel,
  ariaLabelledBy,
  variant = "drawer",
  title,
  icon,
  description,
  onBack,
  backLabel,
  closeLabel,
  headerActions,
  hideClose,
  footer,
  bodyClassName,
  overlayRef,
  closeController,
  children,
}: ModalShellProps) {
  const titleId = useId();
  useBodyPointerEventsWhileOpen(true);
  // Exit animation: backdrop click / Escape / header ✕ mark the shell as
  // `closing`, play the 200ms ease-out exit, then run the consumer's onClose.
  // (Hook always runs; an external controller simply takes precedence.)
  const ownDeferred = useDeferredClose(onClose);
  const deferred = closeController ?? ownDeferred;
  const { closing } = deferred;
  const guardedClose: DeferredClose = {
    closing,
    requestClose: (fn) => { if (!closeDisabled) deferred.requestClose(fn); },
  };
  const handleClose = () => guardedClose.requestClose();
  useEscapeToClose(handleClose, closeOnEscape && !inactive);

  if (typeof document === "undefined") {
    // SSR: render nothing (mirrors the existing per-component `typeof
    // document === "undefined"` short-circuits).
    return null;
  }

  const isDrawer = variant === "drawer";
  const structured = title != null || footer != null;

  const cardBody = structured ? (
    <>
      {title != null && (
        <ModalNavbar
          title={title}
          titleId={titleId}
          icon={icon}
          description={description}
          onBack={onBack}
          backLabel={backLabel}
          onClose={onClose}
          closeDisabled={closeDisabled}
          closeLabel={closeLabel}
          hideClose={hideClose}
          actions={headerActions}
          className="shrink-0"
        />
      )}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
      {footer != null && (
        <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border bg-card px-4 py-3">
          {footer}
        </div>
      )}
    </>
  ) : (
    children
  );

  return createPortal(
    <ModalCloseContext.Provider value={guardedClose}>
    <div
      ref={overlayRef}
      style={zIndex === undefined ? undefined : { zIndex }}
      inert={inactive}
      aria-hidden={inactive ? true : undefined}
      className={cn(
        "fixed inset-0",
        // Centered variant lays the card out with flex + breathing room; the
        // drawer positions its (fixed) card itself, so no centering/padding.
        isDrawer ? undefined : "flex items-center justify-center p-3 sm:p-4",
        zIndexClass,
        backdropClass,
        backdropMotionClass(closing),
        (closing || inactive) && "pointer-events-none",
      )}
      onClick={handleClose}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal={inactive ? undefined : "true"}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy ?? (title != null ? titleId : undefined)}
    >
      <div
        className={
          isDrawer
            ? cn("fixed @container", drawerCardClass(closing), cardClassName)
            : cn(cardClassName, closing ? CENTERED_CARD_EXIT : CENTERED_CARD_ENTER)
        }
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {cardBody}
      </div>
    </div>
    </ModalCloseContext.Provider>,
    document.body,
  );
}
