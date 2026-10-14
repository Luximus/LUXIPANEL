import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { AppTab } from "../features/app/types";

/**
 * Filtro para `toPng`: excluye `<img>` cross-origin. html-to-image intenta
 * descargarlas (fetch) para inlinearlas y evitar "tainted canvas", pero el CSP
 * (`connect-src`) bloquea orígenes externos (p. ej. imágenes del blog en
 * r2.luxisoft.com) → inundaba la consola de errores. En una miniatura de ~256 px
 * omitir esas imágenes es irrelevante. Se conservan same-origin y `data:`.
 */
function captureFilter(node: HTMLElement): boolean {
  if (node instanceof HTMLImageElement) {
    const src = node.currentSrc || node.src;
    if (!src || src.startsWith("data:")) return true;
    try {
      return new URL(src, window.location.href).origin === window.location.origin;
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Cambiador de pestañas tipo Alt+Tab de Windows para las pestañas internas.
 * Combinación: `Ctrl+Tab` (siguiente) / `Ctrl+Shift+Tab` (anterior). Mientras se
 * mantiene Ctrl, cada Tab cicla la selección sobre un overlay con miniaturas
 * (en el ORDEN de las pestañas); al soltar Ctrl se activa la seleccionada.
 * `Esc` cancela.
 *
 * Las miniaturas se capturan de la pestaña ACTIVA (las inactivas están
 * `display:none` y no se pueden capturar): se RE-captura cada vez que una
 * pestaña se activa (en idle, ~600 ms tras activarse) para que su previa
 * refleje su contenido actual, y como fallback al abrir el overlay si aún no
 * tiene miniatura. Se guardan en memoria por sesión (no en disco).
 */
export type TabSwitcherState = {
  open: boolean;
  /** Orden de las pestañas, congelado al abrir el overlay. */
  order: string[];
  /** Índice seleccionado dentro de `order`. */
  sel: number;
};

export function useTabSwitcher({
  tabs,
  activeTabId,
  setActiveTabId,
  getActiveNode,
}: {
  tabs: AppTab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  getActiveNode: () => HTMLElement | null;
}) {
  const thumbs = useRef<Map<string, string>>(new Map());
  // Capturas en curso por id: evita lanzar dos `toPng` a la vez para la misma
  // pestaña (idle + apertura). NO bloquea re-capturas futuras: cada activación
  // refresca la miniatura para que refleje el contenido actual.
  const inFlight = useRef<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [overlay, setOverlay] = useState<TabSwitcherState>({ open: false, order: [], sel: 0 });
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  // Limpia miniaturas / capturas en curso de pestañas ya cerradas.
  useEffect(() => {
    const ids = new Set(tabs.map((t) => t.id));
    thumbs.current.forEach((_, id) => { if (!ids.has(id)) thumbs.current.delete(id); });
    inFlight.current.forEach((id) => { if (!ids.has(id)) inFlight.current.delete(id); });
  }, [tabs]);

  const capture = useCallback(async () => {
    const id = activeTabId;
    if (!id || inFlight.current.has(id)) return;
    const node = getActiveNode();
    if (!node) return;
    inFlight.current.add(id);
    try {
      // Miniatura: se muestra a ~256×144, así que no hace falta resolución.
      // `cacheBust` se omite a propósito (re-descargaba cada recurso embebido en
      // cada captura, ~2 s); `skipFonts` evita inlinear webfonts.
      const url = await toPng(node, { pixelRatio: 0.3, skipFonts: true, filter: captureFilter });
      thumbs.current.set(id, url);
      setVersion((v) => v + 1);
    } catch {
      /* tainted canvas / cross-origin: se ignora, queda placeholder */
    } finally {
      inFlight.current.delete(id);
    }
  }, [activeTabId, getActiveNode]);

  // Re-captura de la pestaña activa en tiempo IDLE (requestIdleCallback) cada vez
  // que se activa, para que su previa refleje el contenido actual. `toPng`
  // bloquea el hilo, así que se difiere a un momento de inactividad para no
  // hitchear la interacción.
  useEffect(() => {
    if (!activeTabId) return;
    let idleId = 0;
    const timer = setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(() => { void capture(); }, { timeout: 3000 });
      else void capture();
    }, 600);
    return () => {
      clearTimeout(timer);
      if (idleId && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
  }, [activeTabId, capture]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Tab") {
        e.preventDefault();
        const n = tabs.length;
        if (n < 2) return;
        const cur = overlayRef.current;
        if (!cur.open) {
          // Orden = el de las pestañas (no MRU). La selección empieza en la
          // pestaña vecina: siguiente, o anterior con Shift.
          const order = tabs.map((t) => t.id);
          const activeIndex = Math.max(0, order.indexOf(activeTabId));
          const sel = (activeIndex + (e.shiftKey ? -1 : 1) + order.length) % order.length;
          // Abre el overlay AL INSTANTE. La captura (`toPng`) bloquea el hilo
          // ~1-2 s, así que se DIFIERE a un macrotask (corre tras pintar el
          // overlay, no retrasa la apertura). captureThumb es 1 vez por pestaña.
          setOverlay({ open: true, order, sel });
          if (!thumbs.current.has(activeTabId)) window.setTimeout(() => { void capture(); }, 0);
        } else {
          setOverlay((o) => ({ ...o, sel: (o.sel + (e.shiftKey ? -1 : 1) + o.order.length) % o.order.length }));
        }
        return;
      }
      if (e.code === "Escape" && overlayRef.current.open) {
        e.preventDefault();
        setOverlay((o) => ({ ...o, open: false }));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" && overlayRef.current.open) {
        const cur = overlayRef.current;
        const target = cur.order[cur.sel];
        setOverlay((o) => ({ ...o, open: false }));
        if (target && target !== activeTabId) setActiveTabId(target);
      }
    };
    const onBlur = () => { if (overlayRef.current.open) setOverlay((o) => ({ ...o, open: false })); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [tabs, capture, activeTabId, setActiveTabId]);

  // Selección directa por click en una tarjeta del overlay.
  const select = useCallback((id: string) => {
    setOverlay((o) => ({ ...o, open: false }));
    if (id !== activeTabId) setActiveTabId(id);
  }, [activeTabId, setActiveTabId]);

  return { overlay, thumbs: thumbs.current, version, select };
}
