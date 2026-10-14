import { describe, expect, it } from "vitest";
import { archiveKeyExtractor, compareEntries, sortEntries } from "./files-list-logic";

describe("compareEntries / sortEntries", () => {
  it("pone las carpetas antes que los archivos", () => {
    const out = sortEntries([
      { name: "zeta.txt", isDir: false },
      { name: "docs", isDir: true },
    ]);
    expect(out.map((e) => e.name)).toEqual(["docs", "zeta.txt"]);
  });

  it("dentro del mismo tipo ordena por nombre", () => {
    const out = sortEntries([
      { name: "b.txt", isDir: false },
      { name: "a.txt", isDir: false },
      { name: "zdir", isDir: true },
      { name: "adir", isDir: true },
    ]);
    expect(out.map((e) => e.name)).toEqual(["adir", "zdir", "a.txt", "b.txt"]);
  });

  it("no muta el array de entrada", () => {
    const input = [
      { name: "b", isDir: false },
      { name: "a", isDir: true },
    ];
    const copy = [...input];
    sortEntries(input);
    expect(input).toEqual(copy);
  });

  it("compareEntries es simétrico en el signo", () => {
    const dir = { name: "d", isDir: true };
    const file = { name: "a", isDir: false };
    expect(compareEntries(dir, file)).toBeLessThan(0);
    expect(compareEntries(file, dir)).toBeGreaterThan(0);
  });
});

describe("archiveKeyExtractor", () => {
  it("genera claves únicas aunque el comprimido repita la misma ruta", () => {
    const lines = ["dir/", "dir/", "dir/a.txt"];
    const keys = lines.map(archiveKeyExtractor);
    expect(new Set(keys).size).toBe(lines.length);
  });

  it("la clave es estable para la misma línea e índice", () => {
    expect(archiveKeyExtractor("dir/a.txt", 3)).toBe(archiveKeyExtractor("dir/a.txt", 3));
    expect(archiveKeyExtractor("dir/a.txt", 3)).toBe("dir/a.txt-3");
  });
});
