/**
 * Paginación cliente de las listas del sidebar (árbol de agentes y de
 * "Sueltos / Proyectos"). Puerto DOM de `app/src/components/assistant/drawer/pager.tsx`
 * (RN → DOM): mismo `usePager`/`useNestedPages`, `AGENTS_PER_PAGE=5`. Sin
 * `defaultLast`/`newestLast`: en desktop la lista va SIEMPRE en orden normal
 * (lo más reciente arriba), sin layout invertido.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Messages } from "../../i18n";

// Paginación de 5/página en cada nivel de los árboles (top + anidados), como
// en el panel y en la app.
export const AGENTS_PER_PAGE = 5;

/** Paginación cliente de una lista: corta `items` en páginas de `size` y expone
 *  la página visible + navegación. Al cambiar `resetKey` (longitud/scope de la
 *  lista) vuelve a la página 1 para no quedar "atrapado" en una página que ya
 *  no existe. */
export function usePager<T>(items: T[], resetKey: unknown = null, size = AGENTS_PER_PAGE) {
  // `null` = el usuario aún no ha paginado ⇒ vale la página 0.
  const [page, setPage] = useState<number | null>(null);
  useEffect(() => { setPage(null); }, [resetKey, size]);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page ?? 0, pageCount - 1);
  return {
    visible: items.slice(current * size, current * size + size),
    page: current,
    pageCount,
    hasPager: items.length > size,
    prev: () => setPage(Math.max(0, current - 1)),
    next: () => setPage(Math.min(pageCount - 1, current + 1)),
  };
}

/** Páginas por-clave de las listas anidadas del árbol (chats propios, subs…). */
export function useNestedPages() {
  const [pages, setPages] = useState<Record<string, number>>({});
  return {
    get: (k: string, fallback = 0) => pages[k] ?? fallback,
    set: (k: string, p: number) => setPages((prev) => ({ ...prev, [k]: Math.max(0, p) })),
  };
}

/** Pie de paginación (chevrons prev/next DOM), deshabilitado en los extremos. */
export function Pager({ page, pageCount, st, onPrev, onNext }: {
  page: number;
  pageCount: number;
  st: Messages["serverStandalone"];
  onPrev: () => void;
  onNext: () => void;
}) {
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;
  return (
    <div className="sat-pager">
      <button type="button" className="sat-pager__btn" disabled={!canPrev} onClick={onPrev} aria-label={st.pagerPrev}>
        <ChevronLeft size={14} aria-hidden />
      </button>
      <span className="sat-pager__text">{`${page + 1} / ${pageCount}`}</span>
      <button type="button" className="sat-pager__btn" disabled={!canNext} onClick={onNext} aria-label={st.pagerNext}>
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  );
}
