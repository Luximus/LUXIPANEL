// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * dialog-motion.ts — cierre ANIMADO y centralizado de todos los `<dialog>`
 * nativos del panel (~190 llamadas directas a `.close()` en los scripts de
 * página, que NO hace falta tocar).
 *
 * Mecánica: parchea `HTMLDialogElement.prototype.close`. Si el dialog está
 * abierto y las animaciones están permitidas, en vez de cerrar de golpe marca
 * `data-lxp-closing="1"` (modal-drawer.css → `lxpDrawerOut` / `lxpModalOut`
 * + fundido del backdrop con los tokens de motion.css), espera al
 * `animationend` (o a un timeout de seguridad) y ENTONCES llama al `close`
 * original con el mismo `returnValue`. El evento `close` del dialog se emite
 * al final, así que los flujos "Promise que resuelve en `close`" siguen
 * funcionando (solo llegan ~100 ms más tarde).
 *
 * - `showModal()`/`show()` sobre un dialog que se está cerrando CANCELAN el
 *   cierre (queda abierto) en vez de lanzar `InvalidStateError`.
 * - Escape: el UA dispara `cancel` y cierra sin pasar por `close()`. Se captura
 *   `cancel` a nivel `document`, se hace `preventDefault()` y se cierra vía el
 *   `close()` parcheado — SALVO que otro listener del dialog también haya
 *   llamado a `preventDefault()` (dialogs no descartables: p. ej.
 *   `dialog-toggle-loading` de Mail o los del editor TipTap, que ya cierran
 *   por su cuenta). Se detecta envolviendo `event.preventDefault`.
 * - `prefers-reduced-motion: reduce` → cierre inmediato (sin animación).
 * - Idempotente (`window.__lxpDialogMotion`): sobrevive a re-ejecuciones y a
 *   swaps SPA (los `<script type="module">` no se re-evalúan, pero por si acaso).
 */

type Pending = { timer: number; returnValue: string | undefined; onEnd: (event: AnimationEvent) => void };

(() => {
  const w = window as unknown as { __lxpDialogMotion?: boolean };
  if (w.__lxpDialogMotion) return;
  if (typeof HTMLDialogElement === "undefined") return;
  w.__lxpDialogMotion = true;

  const CLOSING_ATTR = "data-lxp-closing";
  /* Duración del token + margen: si el CSS no llega a disparar `animationend`
     (nodo oculto, animación anulada…) el timeout garantiza el cierre real. */
  const SAFETY_MS = 160;

  const proto = HTMLDialogElement.prototype;
  const origClose = proto.close;
  const origShowModal = proto.showModal;
  const origShow = proto.show;
  const pending = new WeakMap<HTMLDialogElement, Pending>();

  const reducedMotion = (): boolean => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };

  const callOrigClose = (dlg: HTMLDialogElement, returnValue: string | undefined): void => {
    if (returnValue === undefined) origClose.call(dlg);
    else origClose.call(dlg, returnValue);
  };

  const cancelClosing = (dlg: HTMLDialogElement): void => {
    const p = pending.get(dlg);
    if (!p) return;
    pending.delete(dlg);
    window.clearTimeout(p.timer);
    dlg.removeEventListener("animationend", p.onEnd);
    dlg.removeAttribute(CLOSING_ATTR);
  };

  proto.close = function (this: HTMLDialogElement, returnValue?: string): void {
    // Ya en salida: solo actualizamos el returnValue más reciente.
    const inFlight = pending.get(this);
    if (inFlight) {
      if (returnValue !== undefined) inFlight.returnValue = returnValue;
      return;
    }
    if (!this.open || !this.isConnected || reducedMotion()) {
      callOrigClose(this, returnValue);
      return;
    }

    const onEnd = (event: AnimationEvent) => {
      if (event.target === this && (event.animationName === "lxpDrawerOut" || event.animationName === "lxpModalOut")) finish();
    };
    const finish = () => {
      const p = pending.get(this);
      if (!p) return;
      pending.delete(this);
      window.clearTimeout(p.timer);
      this.removeEventListener("animationend", onEnd);
      this.removeAttribute(CLOSING_ATTR);
      if (this.open) callOrigClose(this, p.returnValue);
    };

    this.setAttribute(CLOSING_ATTR, "1");
    this.addEventListener("animationend", onEnd);
    const timer = window.setTimeout(finish, SAFETY_MS);
    pending.set(this, { timer, returnValue, onEnd });
  };

  proto.showModal = function (this: HTMLDialogElement): void {
    if (pending.has(this)) {
      cancelClosing(this); // sigue abierto y modal: no hay nada más que hacer
      return;
    }
    origShowModal.call(this);
  };

  proto.show = function (this: HTMLDialogElement): void {
    if (pending.has(this)) {
      cancelClosing(this);
      return;
    }
    origShow.call(this);
  };

  // Escape → `cancel` (no burbujea; se captura en document). Cerramos nosotros
  // con animación salvo que otro listener del dialog vete el cierre.
  document.addEventListener(
    "cancel",
    (event: Event) => {
      const dlg = event.target;
      if (!(dlg instanceof HTMLDialogElement) || !dlg.open) return;
      if (reducedMotion()) return; // dejar el cierre nativo inmediato
      if (pending.has(dlg)) {
        event.preventDefault(); // ya se está cerrando: no cerrar de golpe
        return;
      }
      let vetoedByOthers = false;
      const origPrevent = event.preventDefault.bind(event);
      Object.defineProperty(event, "preventDefault", {
        configurable: true,
        writable: true,
        value: () => {
          vetoedByOthers = true;
          origPrevent();
        },
      });
      origPrevent();
      // Tras el dispatch completo (los listeners del propio dialog ya corrieron).
      window.setTimeout(() => {
        if (vetoedByOthers) return;
        if (dlg.open && !pending.has(dlg)) dlg.close();
      }, 0);
    },
    true,
  );
})();

export {};
