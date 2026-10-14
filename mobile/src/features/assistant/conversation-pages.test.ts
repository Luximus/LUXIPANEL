// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { loadConversationPages, type ConvPage } from "./conversation-pages";

type Row = { id: string };

/** Servidor falso paginado: `total` filas, páginas de `pageSize`. Registra los
 *  offsets pedidos y el máximo de peticiones EN VUELO simultáneas. */
function fakeServer(opts: {
  total: number;
  pageSize: number;
  /** Offsets que deben fallar (devuelven `null`, como `luxAssistantProxy`). */
  failAt?: number[];
  /** Retardo por offset (ms simulados con microtareas encadenadas): permite que
   *  las páginas aterricen DESORDENADAS. */
  delayOf?: (offset: number) => number;
}) {
  const { total, pageSize, failAt = [], delayOf } = opts;
  const offsets: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchPage = async (offset: number): Promise<ConvPage<Row> | null> => {
    offsets.push(offset);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const ticks = delayOf?.(offset) ?? 0;
    for (let i = 0; i < ticks; i++) await Promise.resolve();
    inFlight--;
    if (failAt.includes(offset)) return null;
    const items: Row[] = [];
    for (let i = offset; i < Math.min(offset + pageSize, total); i++) items.push({ id: `c${i}` });
    return { items, total };
  };
  return { fetchPage, offsets, maxInFlight: () => maxInFlight };
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe("loadConversationPages", () => {
  it("trae TODAS las páginas y las acumula en orden de offset", async () => {
    const srv = fakeServer({ total: 7, pageSize: 3 });
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
    });
    expect(res).not.toBeNull();
    expect(res!.failed).toBe(false);
    expect(res!.total).toBe(7);
    expect(ids(res!.items)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(srv.offsets.sort((a, b) => a - b)).toEqual([0, 3, 6]);
  });

  it("no dispara más peticiones en paralelo que `concurrency` (el proxy da 429)", async () => {
    // 10 páginas: si no hubiera pool, saldrían las 9 restantes de golpe.
    const srv = fakeServer({ total: 100, pageSize: 10, delayOf: () => 3 });
    await loadConversationPages<Row>({
      pageSize: 10, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
    });
    expect(srv.maxInFlight()).toBeLessThanOrEqual(2);
    expect(srv.offsets).toHaveLength(10);
  });

  it("es más rápido que la cascada: la página 1 y la 2 vuelan a la vez", async () => {
    const srv = fakeServer({ total: 9, pageSize: 3, delayOf: () => 4 });
    await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
    });
    // La página 0 va sola (es la que dice cuántas quedan); las 1 y 2 en paralelo.
    expect(srv.maxInFlight()).toBe(2);
  });

  it("las páginas que aterrizan DESORDENADAS se vuelcan igualmente en orden", async () => {
    // La página 2 (offset 6) resuelve ANTES que la 1 (offset 3).
    const srv = fakeServer({
      total: 9, pageSize: 3,
      delayOf: (offset) => (offset === 3 ? 8 : 1),
    });
    const seen: string[][] = [];
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 3, fetchPage: srv.fetchPage,
      onProgress: (items) => seen.push(ids(items)),
    });
    expect(ids(res!.items)).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
    // Ningún pintado intermedio puede tener un HUECO (c6 antes que c3): el
    // `conversations.length` es el offset de "Cargar más".
    for (const snapshot of seen) {
      expect(snapshot).toEqual(["c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"].slice(0, snapshot.length));
    }
  });

  it("pinta INCREMENTALMENTE: emite la página 0 antes de tener el resto", async () => {
    const srv = fakeServer({ total: 9, pageSize: 3, delayOf: (o) => (o === 0 ? 0 : 5) });
    const seen: number[] = [];
    await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
      onProgress: (items) => seen.push(items.length),
    });
    expect(seen[0]).toBe(3);
    expect(seen[seen.length - 1]).toBe(9);
  });

  it("la PRIMERA página fallida devuelve null (ni se pinta ni se cachea vacío)", async () => {
    const srv = fakeServer({ total: 9, pageSize: 3, failAt: [0] });
    const onProgress = vi.fn();
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage, onProgress,
    });
    expect(res).toBeNull();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("una página intermedia fallida corta el bucle CONSERVANDO el total (queda 'Cargar más')", async () => {
    const srv = fakeServer({ total: 9, pageSize: 3, failAt: [3] });
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 1, fetchPage: srv.fetchPage,
    });
    expect(res!.failed).toBe(true);
    expect(ids(res!.items)).toEqual(["c0", "c1", "c2"]);
    // El total del servidor se conserva: 3 < 9 ⇒ el drawer ofrece "Cargar más".
    expect(res!.total).toBe(9);
  });

  it("tras una página fallida NO se cuelan las siguientes (dejarían un hueco)", async () => {
    // Falla la 1 (offset 3) pero la 2 (offset 6) ya iba en vuelo y llega bien.
    const srv = fakeServer({
      total: 9, pageSize: 3, failAt: [3],
      delayOf: (offset) => (offset === 3 ? 6 : 1),
    });
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
    });
    expect(res!.failed).toBe(true);
    // c6..c8 se DESCARTAN: sin la página 1 la lista tendría un hueco.
    expect(ids(res!.items)).toEqual(["c0", "c1", "c2"]);
  });

  it("una página corta termina la paginación sin pedir más", async () => {
    // total miente (dice 100) pero la página 1 vuelve corta ⇒ es la última.
    const fetchPage = vi.fn(async (offset: number): Promise<ConvPage<Row> | null> => {
      if (offset === 0) return { items: [{ id: "a" }, { id: "b" }], total: 100 };
      return { items: [{ id: "c" }], total: 100 };
    });
    const res = await loadConversationPages<Row>({
      pageSize: 2, maxPages: 25, concurrency: 1, fetchPage,
    });
    expect(ids(res!.items)).toEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(res!.failed).toBe(false);
  });

  it("respeta el tope `maxPages` (guarda contra un bucle patológico)", async () => {
    const srv = fakeServer({ total: 1000, pageSize: 10 });
    const res = await loadConversationPages<Row>({
      pageSize: 10, maxPages: 3, concurrency: 2, fetchPage: srv.fetchPage,
    });
    expect(srv.offsets).toHaveLength(3);
    expect(res!.items).toHaveLength(30);
  });

  it("con `maxPages: 1` solo pide la página 0 (lista plana: búsqueda / proyecto)", async () => {
    const srv = fakeServer({ total: 500, pageSize: 200 });
    const res = await loadConversationPages<Row>({
      pageSize: 200, maxPages: 1, concurrency: 3, fetchPage: srv.fetchPage,
    });
    expect(srv.offsets).toEqual([0]);
    expect(res!.items).toHaveLength(200);
    expect(res!.total).toBe(500);
    expect(res!.failed).toBe(false);
  });

  it("una sola página completa (total exacto) no pide una página extra vacía", async () => {
    const srv = fakeServer({ total: 3, pageSize: 3 });
    const res = await loadConversationPages<Row>({
      pageSize: 3, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
    });
    expect(srv.offsets).toEqual([0]);
    expect(res!.items).toHaveLength(3);
  });

  it("cancelar (desmontaje / cambio de scope) corta las peticiones y no emite más", async () => {
    let cancelled = false;
    const srv = fakeServer({ total: 100, pageSize: 10, delayOf: () => 2 });
    const onProgress = vi.fn(() => { cancelled = true; }); // se cancela tras el 1er pintado
    const res = await loadConversationPages<Row>({
      pageSize: 10, maxPages: 25, concurrency: 2, fetchPage: srv.fetchPage,
      onProgress, isCancelled: () => cancelled,
    });
    expect(res).toBeNull();
    expect(onProgress).toHaveBeenCalledTimes(1);
    // No se agotan las 10 páginas: se cortó nada más cancelar.
    expect(srv.offsets.length).toBeLessThan(10);
  });
});
