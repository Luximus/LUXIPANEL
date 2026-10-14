import { describe, expect, it } from "vitest";
import { stripAnsi } from "./strip-ansi";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("stripAnsi", () => {
  it("deja el texto plano intacto", () => {
    expect(stripAnsi("hola mundo")).toBe("hola mundo");
    expect(stripAnsi("")).toBe("");
  });

  it("quita códigos de color SGR", () => {
    expect(stripAnsi(`${ESC}[36mcyan${ESC}[0m`)).toBe("cyan");
    expect(stripAnsi(`${ESC}[1;31mbold red${ESC}[39;49m`)).toBe("bold red");
  });

  it("quita colores 256 / truecolor", () => {
    expect(stripAnsi(`${ESC}[38;5;196mx${ESC}[0m`)).toBe("x");
    expect(stripAnsi(`${ESC}[38;2;255;0;0my${ESC}[0m`)).toBe("y");
  });

  it("quita movimientos de cursor y borrados", () => {
    expect(stripAnsi(`${ESC}[2J${ESC}[1;1Hclear`)).toBe("clear");
    expect(stripAnsi(`linea${ESC}[K`)).toBe("linea");
    expect(stripAnsi(`${ESC}[10Aup`)).toBe("up");
  });

  it("quita secuencias OSC (título de ventana / hyperlink)", () => {
    expect(stripAnsi(`${ESC}]0;mi titulo${BEL}texto`)).toBe("texto");
    expect(stripAnsi(`${ESC}]8;;https://x.io${BEL}link${ESC}]8;;${BEL}`)).toBe("link");
  });

  it("conserva saltos de línea y contenido multilínea", () => {
    const input = `${ESC}[32m$ ls${ESC}[0m\nfile1\nfile2`;
    expect(stripAnsi(input)).toBe("$ ls\nfile1\nfile2");
  });
});
