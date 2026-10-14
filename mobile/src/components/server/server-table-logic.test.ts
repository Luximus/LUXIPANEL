import { describe, expect, it } from "vitest";
import {
  clampPage,
  compareSortValues,
  defaultHiddenIds,
  hiddenColumnIds,
  filterAndSortRows,
  filterRows,
  nextSort,
  pageRange,
  pageSlice,
  sortRows,
  totalPageCount,
  visibleColumnsOf,
  type ServerColumn,
  type ServerFilter,
} from "./server-table-logic";

type Row = { id: string; name: string; size: number; kind: string };

const rows: Row[] = [
  { id: "1", name: "beta", size: 30, kind: "file" },
  { id: "2", name: "alpha", size: 10, kind: "dir" },
  { id: "3", name: "gamma", size: 20, kind: "file" },
];

const columns: ServerColumn<Row>[] = [
  { id: "name", header: "Nombre", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
  { id: "size", header: "Tamaño", cell: (r) => r.size, sortable: true, sortValue: (r) => r.size },
  { id: "kind", header: "Tipo", cell: (r) => r.kind, defaultHidden: true },
  { id: "nosort", header: "Sin orden", cell: () => "-" },
];

const searchFilter: ServerFilter<Row> = {
  id: "search",
  kind: "search",
  placeholder: "buscar",
  match: (r, q) => r.name.toLowerCase().includes(q),
};
const kindFilter: ServerFilter<Row> = {
  id: "kind",
  kind: "select",
  placeholder: "tipo",
  options: [{ value: "file", label: "Archivo" }],
  match: (r, v) => r.kind === v,
};

describe("filterRows", () => {
  it("sin filtros activos devuelve el MISMO array (identidad estable para memoizar)", () => {
    expect(filterRows(rows, [searchFilter, kindFilter], {}, {})).toBe(rows);
    // Cadenas vacías / sólo espacios = filtro inactivo.
    expect(filterRows(rows, [searchFilter], { search: "   " }, {})).toBe(rows);
  });

  it("filtra por búsqueda normalizando (trim + lowercase)", () => {
    // La tabla ya normaliza la query antes de llamar a `match`, así que el
    // `match` de la pantalla recibe siempre minúsculas sin espacios.
    expect(filterRows(rows, [searchFilter], { search: "  ALPHA " }, {}).map((r) => r.id)).toEqual(["2"]);
  });

  it("filtra por select y combina varios filtros (AND)", () => {
    expect(filterRows(rows, [kindFilter], {}, { kind: "file" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(
      filterRows(rows, [searchFilter, kindFilter], { search: "a" }, { kind: "file" }).map((r) => r.id),
    ).toEqual(["1", "3"]);
  });

  it("no muta el array de entrada", () => {
    const copy = [...rows];
    filterRows(rows, [searchFilter], { search: "alpha" }, {});
    expect(rows).toEqual(copy);
  });
});

describe("compareSortValues", () => {
  it("compara numéricamente si ambos son números", () => {
    expect(compareSortValues(2, 10)).toBeLessThan(0);
  });

  it("compara como texto si no lo son (10 < 2 lexicográficamente)", () => {
    expect(compareSortValues("10", "2")).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  it("sin sort, o con columna sin sortValue, devuelve el mismo array", () => {
    expect(sortRows(rows, columns, null)).toBe(rows);
    expect(sortRows(rows, columns, { id: "nosort", dir: "asc" })).toBe(rows);
    expect(sortRows(rows, columns, { id: "inexistente", dir: "asc" })).toBe(rows);
  });

  it("ordena asc y desc por texto", () => {
    expect(sortRows(rows, columns, { id: "name", dir: "asc" }).map((r) => r.name)).toEqual(["alpha", "beta", "gamma"]);
    expect(sortRows(rows, columns, { id: "name", dir: "desc" }).map((r) => r.name)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("ordena numéricamente (no lexicográficamente)", () => {
    expect(sortRows(rows, columns, { id: "size", dir: "asc" }).map((r) => r.size)).toEqual([10, 20, 30]);
  });

  it("no muta el array de entrada", () => {
    const copy = [...rows];
    sortRows(rows, columns, { id: "size", dir: "desc" });
    expect(rows).toEqual(copy);
  });
});

describe("filterAndSortRows", () => {
  it("filtra y luego ordena", () => {
    const out = filterAndSortRows(rows, columns, [kindFilter], {}, { kind: "file" }, { id: "size", dir: "desc" });
    expect(out.map((r) => r.id)).toEqual(["1", "3"]);
    expect(out.map((r) => r.size)).toEqual([30, 20]);
  });
});

describe("paginación", () => {
  it("totalPageCount nunca baja de 1", () => {
    expect(totalPageCount(0, 10)).toBe(1);
    expect(totalPageCount(10, 10)).toBe(1);
    expect(totalPageCount(11, 10)).toBe(2);
  });

  it("clampPage acota a un rango válido (bug: la página se quedaba fuera de rango al filtrar)", () => {
    expect(clampPage(9, 5, 10)).toBe(0); // 5 filas = 1 página
    expect(clampPage(-3, 100, 10)).toBe(0);
    expect(clampPage(4, 100, 10)).toBe(4);
    expect(clampPage(99, 100, 10)).toBe(9);
  });

  it("pageSlice devuelve la página acotada", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: `n${i}`, size: i, kind: "file" }));
    expect(pageSlice(many, 0, 10)).toHaveLength(10);
    expect(pageSlice(many, 2, 10)).toHaveLength(5);
    // Página fuera de rango: cae en la última, no devuelve vacío.
    expect(pageSlice(many, 99, 10).map((r) => r.id)).toEqual(["20", "21", "22", "23", "24"]);
  });

  it("pageRange calcula el 'mostrando X-Y de N' del footer", () => {
    expect(pageRange(0, 0, 10)).toEqual({ from: 0, to: 0 });
    expect(pageRange(25, 0, 10)).toEqual({ from: 1, to: 10 });
    expect(pageRange(25, 2, 10)).toEqual({ from: 21, to: 25 });
    // Página fuera de rango → se acota a la última.
    expect(pageRange(25, 99, 10)).toEqual({ from: 21, to: 25 });
  });
});

describe("columnas", () => {
  it("aplica nuevos valores por defecto sin perder las elecciones explícitas de una tabla abierta", () => {
    const overrides = { kind: false, name: true };
    expect([...hiddenColumnIds(columns, overrides)]).toEqual(["name"]);
    const updated = columns.map(col => col.id === "size" ? { ...col, defaultHidden: true } : col);
    expect([...hiddenColumnIds(updated, overrides)]).toEqual(["name", "size"]);
    expect([...hiddenColumnIds(columns, overrides)]).toEqual(["name"]);
  });
  it("defaultHiddenIds recoge las columnas ocultas por defecto", () => {
    expect([...defaultHiddenIds(columns)]).toEqual(["kind"]);
  });

  it("visibleColumnsOf excluye las ocultas", () => {
    expect(visibleColumnsOf(columns, new Set(["kind", "nosort"])).map((c) => c.id)).toEqual(["name", "size"]);
    expect(visibleColumnsOf(columns, new Set()).map((c) => c.id)).toEqual(["name", "size", "kind", "nosort"]);
  });
});

describe("nextSort", () => {
  it("primera pulsación = asc; repetir alterna asc/desc", () => {
    expect(nextSort(null, "name")).toEqual({ id: "name", dir: "asc" });
    expect(nextSort({ id: "name", dir: "asc" }, "name")).toEqual({ id: "name", dir: "desc" });
    expect(nextSort({ id: "name", dir: "desc" }, "name")).toEqual({ id: "name", dir: "asc" });
  });

  it("cambiar de columna vuelve a asc", () => {
    expect(nextSort({ id: "name", dir: "desc" }, "size")).toEqual({ id: "size", dir: "asc" });
  });
});
