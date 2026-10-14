// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * DOM lookups + `<dialog>` handling shared by the extracted page scripts
 * (E-06 / E-10).
 *
 * `const $ = (id) => document.getElementById(id)` was re-declared in ~12
 * modules, and `(document.getElementById("x") as HTMLDialogElement).showModal()`
 * appeared ~50 times in THREE divergent flavors inside the same modules:
 *   - `(… as HTMLDialogElement).showModal()`   → TypeError if the node is gone
 *   - `(… as HTMLDialogElement | null)?.showModal()` → silent no-op
 *   - `const d = …; if (d && !d.open) d.showModal()` → guards the
 *     `InvalidStateError` you get from `showModal()` on an already-open dialog.
 *
 * `openDialog()` here is the union of the three safe behaviors: missing node →
 * no-op, already open → no-op, otherwise `showModal()`.
 *
 * Imported by the runtime URL `/scripts/extracted/lib/dom.js` (stays external in
 * bundled entries via the `/scripts/extracted/lib/*` glob).
 * Standalone (no imports).
 */

/** `document.getElementById`, optionally narrowed to a concrete element type. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Same as `$` but typed as a `<dialog>`. */
export function dlg(id: string): HTMLDialogElement | null {
  return document.getElementById(id) as HTMLDialogElement | null;
}

/**
 * Open a modal `<dialog>` by id. No-op when the node is missing or already open
 * (`showModal()` on an open dialog throws `InvalidStateError`).
 * Returns the dialog so callers can keep chaining, or `null` if absent.
 */
export function openDialog(id: string): HTMLDialogElement | null {
  const el = dlg(id);
  if (!el) return null;
  if (!el.open) el.showModal();
  return el;
}

/** Close a `<dialog>` by id. No-op when the node is missing or already closed. */
export function closeDialog(id: string, returnValue?: string): void {
  const el = dlg(id);
  if (!el || !el.open) return;
  if (returnValue === undefined) el.close();
  else el.close(returnValue);
}

/**
 * Pliega/despliega una sección con la animación estándar del panel
 * (`.lxp-collapse-y` en motion.css: fundido + desplazamiento, 200 ms ease-out —
 * misma receta que el colapso del sidebar izquierdo). Sustituye a
 * `el.classList.toggle("hidden")` en secciones plegables:
 *
 *   - abrir: quita `hidden`, y en el siguiente frame pone `data-collapsed=false`
 *     para que la transición de entrada llegue a ejecutarse;
 *   - cerrar: pone `data-collapsed=true` y añade `hidden` SOLO al terminar la
 *     transición (o tras un timeout de seguridad), así el elemento deja de
 *     ocupar flujo igual que antes.
 *
 * Devuelve el nuevo estado (`true` = plegado). `force` como en `classList.toggle`.
 */
export function setCollapsed(el: HTMLElement | null, force?: boolean): boolean {
  if (!el) return true;
  el.classList.add("lxp-collapse-y");
  const isCollapsed = el.classList.contains("hidden") || el.dataset.collapsed === "true";
  const next = force === undefined ? !isCollapsed : force;
  const token = String((Number(el.dataset.lxpCollapseSeq ?? "0") + 1) | 0);
  el.dataset.lxpCollapseSeq = token;
  if (next) {
    el.dataset.collapsed = "true";
    el.setAttribute("aria-hidden", "true");
    const hide = () => {
      if (el.dataset.lxpCollapseSeq !== token) return; // reabierto entre medias
      el.classList.add("hidden");
    };
    let done = false;
    const once = () => { if (!done) { done = true; el.removeEventListener("transitionend", onEnd); hide(); } };
    const onEnd = (event: Event) => { if (event.target === el) once(); };
    el.addEventListener("transitionend", onEnd);
    window.setTimeout(once, 260);
  } else {
    el.classList.remove("hidden");
    el.removeAttribute("aria-hidden");
    // Dos frames: el primero aplica `display`, el segundo arranca la transición.
    el.dataset.collapsed = "true";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (el.dataset.lxpCollapseSeq !== token) return;
      el.dataset.collapsed = "false";
    }));
  }
  return next;
}

// ── Cambio de vista (tabs / menús / pasos) ─────────────────────────────────
// Preset de motion.css: `.lxp-view-enter` (fade + 6px ↑), `-right` / `-left`
// (direccional según el orden del tab). El panel saliente NO se anima.

export type ViewDirection = "left" | "right" | "none";

const VIEW_ENTER_CLASSES = ["lxp-view-enter", "lxp-view-enter-right", "lxp-view-enter-left"] as const;

/* Solo animamos tras una interacción del usuario: el primer render de la
   página (tab por defecto, deep-link `?tab=`, restauración desde
   sessionStorage) debe pintarse quieto. El flag se reinicia en cada
   navegación SPA (`astro:before-swap`) para que la página siguiente tampoco
   anime su tab inicial. */
let userInteracted = false;
if (typeof document !== "undefined") {
  const arm = () => { userInteracted = true; };
  document.addEventListener("pointerdown", arm, { capture: true, passive: true });
  document.addEventListener("keydown", arm, { capture: true, passive: true });
  document.addEventListener("astro:before-swap", () => { userInteracted = false; });
}

/** `true` cuando ya hubo una interacción del usuario en esta página. */
export function viewMotionArmed(): boolean {
  return userInteracted;
}

/** Dirección de entrada al pasar del tab `prevIndex` al `nextIndex`. */
export function tabDirection(prevIndex: number, nextIndex: number): ViewDirection {
  if (prevIndex < 0 || nextIndex < 0 || prevIndex === nextIndex) return "none";
  return nextIndex > prevIndex ? "right" : "left";
}

/**
 * Reproduce la animación de entrada sobre un panel YA visible (p. ej. su
 * contenido cambió por `innerHTML`, o un filtro/tab re-renderizó la misma
 * vista). Reinicia la animación aunque la clase ya estuviera puesta.
 * No hace nada antes de la primera interacción (ver `viewMotionArmed`).
 */
export function animateViewEnter(el: HTMLElement | null | undefined, direction: ViewDirection = "none"): void {
  if (!el || !userInteracted) return;
  el.classList.remove(...VIEW_ENTER_CLASSES);
  void el.offsetWidth; // reflow: reinicia la animación CSS
  const cls = direction === "right" ? "lxp-view-enter-right" : direction === "left" ? "lxp-view-enter-left" : "lxp-view-enter";
  el.classList.add(cls);
  const cleanup = (event?: Event) => {
    if (event && event.target !== el) return;
    el.removeEventListener("animationend", cleanup);
    el.classList.remove(cls);
  };
  el.addEventListener("animationend", cleanup);
  window.setTimeout(cleanup, 400); // seguridad (reduced-motion → sin animationend)
}

/**
 * Muestra `next` y oculta el resto de `panels` (clase `hidden`), animando la
 * entrada del panel que pasa a visible. Si `next` ya estaba visible no anima
 * (evita el doble parpadeo cuando un tab se re-activa o cuando el contenido
 * perezoso llega después). `flexClass` opcional: paneles cuyo layout necesita
 * `flex` mientras están visibles (patrón `setPaneVisibilityById`).
 */
export function switchView(
  panels: Iterable<HTMLElement | null | undefined>,
  next: HTMLElement | null | undefined,
  opts: { direction?: ViewDirection; flexClass?: boolean } = {},
): HTMLElement | null {
  const wasHidden = !!next && next.classList.contains("hidden");
  for (const panel of panels) {
    if (!panel) continue;
    const active = panel === next;
    panel.classList.toggle("hidden", !active);
    if (!active) panel.classList.remove(...VIEW_ENTER_CLASSES); // saliente: sin restos
    if (opts.flexClass) panel.classList.toggle("flex", active);
  }
  if (!next) return null;
  if (wasHidden) animateViewEnter(next, opts.direction ?? "none");
  return next;
}
