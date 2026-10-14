// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Descarga de la lista COMPLETA de conversaciones (modo árbol) con
 * CONCURRENCIA ACOTADA. Lógica pura: ni React ni transporte — el drawer inyecta
 * el `fetchPage` (un GET por el proxy SSO → SSH).
 *
 * POR QUÉ EXISTE: el árbol de agentes / proyectos agrupa client-side sobre TODOS
 * los chats, así que hay que agotar la paginación. El bucle original pedía las
 * páginas EN CASCADA (`await` dentro de un `for`): con cientos de chats eso son
 * varios round-trips SSH encadenados de cientos de ms cada uno, sumados en serie.
 * Aquí las páginas 1..N se piden en un POOL de `concurrency` (2-3), así que la
 * espera total es ~ceil((N-1)/concurrency) round-trips en vez de N-1.
 *
 * INVARIANTES (las mismas que garantizaba el bucle secuencial; no cambiar sin
 * test):
 * - **Prefijo contiguo**: aunque las páginas aterricen desordenadas, solo se
 *   emiten/acumulan en ORDEN de offset y sin huecos. La lista es la fuente del
 *   offset de "Cargar más" (`conversations.length`): un hueco lo desalinearía.
 * - **Página fallida corta el bucle CONSERVANDO el total**: `luxAssistantProxy`
 *   devuelve `null` ante cualquier fallo (429 del rate-limit, 5xx, timeout). Al
 *   fallar una página intermedia se deja de paginar, se conserva lo ya traído y
 *   el `total` del servidor (así el drawer sigue ofreciendo "Cargar más" en vez
 *   de truncar el árbol en silencio) y se marca `failed`.
 * - **La primera página es especial**: si falla, no hay nada que pintar →
 *   `null` (el drawer muestra el bloque de error con reintento y NO envenena la
 *   caché con un snapshot vacío).
 * - **Cancelación**: al desmontar / cambiar de scope, `isCancelled()` corta las
 *   peticiones pendientes y NO se emite ningún progreso más.
 */

/** Una página de la lista tal y como la devuelve el backend (ya normalizada). */
export type ConvPage<T> = { items: T[]; total: number };

/** GET de una página por offset. `null` = fallo del proxy (nunca lanza). */
export type FetchConvPage<T> = (offset: number) => Promise<ConvPage<T> | null>;

export type ConvPagesResult<T> = {
  /** Prefijo contiguo de páginas que SÍ llegaron (en orden de offset). */
  items: T[];
  /** Último total conocido del servidor (nunca decrece por debajo de `items`). */
  total: number;
  /** Alguna página intermedia falló: la lista está INCOMPLETA. */
  failed: boolean;
};

export type LoadConvPagesOpts<T> = {
  /** Tamaño de página (el backend clampa a 200). */
  pageSize: number;
  /** Tope duro de páginas (guarda contra un bucle patológico). */
  maxPages: number;
  /** Peticiones en vuelo como mucho. Conservador: el proxy rate-limita (429). */
  concurrency: number;
  fetchPage: FetchConvPage<T>;
  /** Pintado INCREMENTAL: se llama con el prefijo contiguo tras cada página que
   *  aterriza (el usuario ve la lista al primer round-trip, no al último). */
  onProgress?: (items: T[], total: number) => void;
  /** Corta la descarga (desmontaje / cambio de scope). */
  isCancelled?: () => boolean;
};

/**
 * Trae la lista completa: la página 0 primero (es la que desbloquea el pintado y
 * la que dice cuántas quedan) y el resto en un pool acotado.
 *
 * Devuelve `null` si falló la PRIMERA página o si se canceló: en ambos casos no
 * hay snapshot válido que pintar ni cachear.
 */
export async function loadConversationPages<T>({
  pageSize,
  maxPages,
  concurrency,
  fetchPage,
  onProgress,
  isCancelled,
}: LoadConvPagesOpts<T>): Promise<ConvPagesResult<T> | null> {
  const cancelled = () => isCancelled?.() === true;

  const first = await fetchPage(0);
  if (cancelled()) return null;
  if (!first) return null;

  const items: T[] = [...first.items];
  let total = Math.max(first.total, items.length);
  onProgress?.(items, total);

  /** Nº de páginas a pedir según el total VIGENTE (puede crecer si entran chats
   *  nuevos mientras paginamos), acotado por `maxPages`. */
  const pageCount = () => Math.min(maxPages, Math.ceil(total / pageSize));
  // Lista ya completa (o página corta = última): no hay nada más que pedir.
  if (items.length >= total || first.items.length < pageSize || pageCount() <= 1) {
    return { items, total, failed: false };
  }

  /** Páginas que ya aterrizaron y aún no se han volcado (pueden llegar
   *  desordenadas: solo se vuelca el prefijo contiguo). */
  const landed = new Map<number, ConvPage<T> | null>();
  let nextPage = 1; // siguiente página a PEDIR
  let flushPage = 1; // siguiente página a VOLCAR (mantiene la contigüidad)
  let stop = false; // deja de pedir (fallo / última página / cancelado)
  let failed = false;

  /** Vuelca a `items` todas las páginas contiguas ya aterrizadas y emite el
   *  progreso UNA vez por tanda. Una página fallida corta aquí (y las que
   *  vinieran detrás se descartan: acumularlas dejaría un HUECO en la lista). */
  const drain = () => {
    if (stop) return;
    let grew = false;
    while (landed.has(flushPage)) {
      const page = landed.get(flushPage);
      landed.delete(flushPage);
      if (!page) {
        failed = true;
        stop = true;
        break;
      }
      items.push(...page.items);
      total = Math.max(page.total, items.length);
      flushPage++;
      grew = true;
      // Página corta = última real: parar (aunque el `total` dijera otra cosa).
      if (page.items.length < pageSize) {
        stop = true;
        break;
      }
    }
    if (grew && !cancelled()) onProgress?.(items, total);
  };

  const worker = async (): Promise<void> => {
    for (;;) {
      if (stop || cancelled()) return;
      if (nextPage >= pageCount()) return;
      const page = nextPage++;
      const res = await fetchPage(page * pageSize);
      if (cancelled()) return;
      landed.set(page, res);
      drain();
    }
  };

  const workers = Math.max(1, Math.min(concurrency, pageCount() - 1));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  if (cancelled()) return null;
  return { items, total: Math.max(total, items.length), failed };
}
