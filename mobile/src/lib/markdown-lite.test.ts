import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMarkdownCache,
  parseInline,
  parseMarkdown,
  parseMarkdownCached,
  stableMarkdownBoundary,
  type MdBlock,
  type MdList,
} from "./markdown-lite";

describe("parseInline", () => {
  it("texto plano → un solo nodo text", () => {
    expect(parseInline("hola")).toEqual([{ t: "text", text: "hola" }]);
  });

  it("bold con ** y __", () => {
    expect(parseInline("a **b** c")).toEqual([
      { t: "text", text: "a " },
      { t: "bold", children: [{ t: "text", text: "b" }] },
      { t: "text", text: " c" },
    ]);
    expect(parseInline("__x__")).toEqual([{ t: "bold", children: [{ t: "text", text: "x" }] }]);
  });

  it("italic con * y _ (no dentro de palabras)", () => {
    expect(parseInline("*it*")).toEqual([{ t: "italic", children: [{ t: "text", text: "it" }] }]);
    expect(parseInline("_it_")).toEqual([{ t: "italic", children: [{ t: "text", text: "it" }] }]);
    // `_` pegado a alfanuméricos no es énfasis (snake_case intacto).
    expect(parseInline("var_name_here")).toEqual([{ t: "text", text: "var_name_here" }]);
  });

  it("strike con ~~", () => {
    expect(parseInline("~~no~~")).toEqual([{ t: "strike", children: [{ t: "text", text: "no" }] }]);
  });

  it("inline code gana al énfasis (no formatea dentro)", () => {
    expect(parseInline("`a **b**`")).toEqual([{ t: "code", text: "a **b**" }]);
  });

  it("links [texto](url)", () => {
    expect(parseInline("ver [docs](https://x.io/a) ya")).toEqual([
      { t: "text", text: "ver " },
      { t: "link", text: "docs", href: "https://x.io/a" },
      { t: "text", text: " ya" },
    ]);
  });

  it("énfasis anidado dentro de bold (delimitadores distintos)", () => {
    expect(parseInline("**a _b_**")).toEqual([
      { t: "bold", children: [{ t: "text", text: "a " }, { t: "italic", children: [{ t: "text", text: "b" }] }] },
    ]);
  });
});

describe("parseMarkdown — bloques", () => {
  it("párrafos separados por línea en blanco; líneas internas preservadas", () => {
    const blocks = parseMarkdown("a\nb\n\nc");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ t: "p", lines: [[{ t: "text", text: "a" }], [{ t: "text", text: "b" }]] });
    expect(blocks[1]).toEqual({ t: "p", lines: [[{ t: "text", text: "c" }]] });
  });

  it("headings con nivel", () => {
    const blocks = parseMarkdown("# T1\n### T3");
    expect(blocks[0]).toMatchObject({ t: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ t: "heading", level: 3 });
  });

  it("hr con --- / *** / ___", () => {
    for (const hr of ["---", "***", "___"]) {
      expect(parseMarkdown(hr)[0]).toEqual({ t: "hr" });
    }
  });

  it("blockquote agrupa líneas > consecutivas", () => {
    const blocks = parseMarkdown("> uno\n> dos");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ t: "quote" });
    expect((blocks[0] as Extract<MdBlock, { t: "quote" }>).lines).toHaveLength(2);
  });

  it("lista desordenada simple", () => {
    const list = parseMarkdown("- a\n- b")[0] as MdList;
    expect(list.t).toBe("list");
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
  });

  it("lista ordenada", () => {
    const list = parseMarkdown("1. a\n2. b")[0] as MdList;
    expect(list.ordered).toBe(true);
    expect(list.items.map((i) => i.children)).toEqual([
      [{ t: "text", text: "a" }],
      [{ t: "text", text: "b" }],
    ]);
  });

  it("lista anidada por indentación", () => {
    const list = parseMarkdown("- a\n  - a1\n  - a2\n- b")[0] as MdList;
    expect(list.items).toHaveLength(2);
    expect(list.items[0].nested).not.toBeNull();
    expect(list.items[0].nested!.items).toHaveLength(2);
    expect(list.items[1].nested).toBeNull();
  });

  it("bloque de código cercado con lenguaje", () => {
    const blocks = parseMarkdown("antes\n```bash\nls -la\necho hi\n```\ndespués");
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toEqual({ t: "codeblock", lang: "bash", code: "ls -la\necho hi" });
  });

  it("bloque de código sin cierre no se traga el resto en un loop", () => {
    const blocks = parseMarkdown("```\nsolo\ncodigo");
    expect(blocks).toEqual([{ t: "codeblock", lang: "", code: "solo\ncodigo" }]);
  });

  it("inline dentro de heading y lista", () => {
    const h = parseMarkdown("## **B**")[0] as Extract<MdBlock, { t: "heading" }>;
    expect(h.children[0]).toMatchObject({ t: "bold" });
    const list = parseMarkdown("- `code`")[0] as MdList;
    expect(list.items[0].children[0]).toEqual({ t: "code", text: "code" });
  });
});

// ── Parseo incremental con caché (streaming) ────────────────────────────────
// El contrato NO NEGOCIABLE de `parseMarkdownCached` es: para CUALQUIER texto
// devuelve exactamente lo mismo que `parseMarkdown`. Lo demás (que reutilice
// bloques, que corte por prefijos estables) es solo coste.

/** Documento con TODOS los casos peligrosos del corte incremental:
 *  - una línea `| a | b |` que es párrafo hasta que llega la fila separadora
 *    (único lookahead del parser),
 *  - un bloque de código con una línea EN BLANCO dentro (no puede ser corte),
 *  - lista anidada, cita, hr y un último bloque a medias. */
const DOC = [
  "# Título",
  "",
  "Párrafo con **bold**, `code` y [link](https://x.io/a).",
  "Segunda línea del mismo párrafo.",
  "",
  "- item uno",
  "  - anidado",
  "- item dos",
  "",
  "| col a | col b |",
  "|:------|------:|",
  "| 1 | 2 |",
  "| 3 | 4 |",
  "",
  "> cita",
  "> más cita",
  "",
  "```ts",
  "const x = 1;",
  "",
  "const y = 2;",
  "```",
  "",
  "---",
  "",
  "Cierre a medias sin term",
].join("\n");

describe("stableMarkdownBoundary", () => {
  it("corta tras la última línea en blanco (nunca en la última línea, que aún crece)", () => {
    expect(stableMarkdownBoundary("a\n\nb")).toBe(3); // prefijo "a\n\n"
    expect(stableMarkdownBoundary("a\n\n")).toBe(3);
    // Sin línea en blanco no hay nada estable todavía.
    expect(stableMarkdownBoundary("una sola línea")).toBe(0);
    expect(stableMarkdownBoundary("")).toBe(0);
  });

  it("dentro de un fence SIN cerrar no hay corte (aunque haya líneas en blanco)", () => {
    expect(stableMarkdownBoundary("```\na\n\nb")).toBe(0);
    // La línea en blanco de dentro del fence no cuenta: el corte se queda en el
    // párrafo anterior.
    expect(stableMarkdownBoundary("p\n\n```\nx\n\ny")).toBe(3); // prefijo "p\n\n"
  });

  it("un fence YA cerrado sí deja cortar después de él", () => {
    expect(stableMarkdownBoundary("```\nx\n```\n\ny")).toBe(11); // prefijo "```\nx\n```\n\n"
  });

  it("reanudar desde un prefijo estable da el mismo corte que escanear todo", () => {
    expect(stableMarkdownBoundary(DOC, stableMarkdownBoundary(DOC, 0))).toBe(stableMarkdownBoundary(DOC, 0));
  });
});

describe("parseMarkdownCached", () => {
  beforeEach(() => { __resetMarkdownCache(); });

  it("mismo resultado que parseMarkdown (caché fría y caliente)", () => {
    expect(parseMarkdownCached(DOC)).toEqual(parseMarkdown(DOC));
    expect(parseMarkdownCached(DOC)).toEqual(parseMarkdown(DOC)); // 2ª vez: cacheada
  });

  it("STREAMING: cada prefijo del texto parsea igual que el parseo completo", () => {
    // Simula el stream token a token (carácter a carácter, el caso más duro):
    // el árbol incremental debe ser IDÉNTICO al del parseo entero en CADA paso.
    for (let i = 0; i <= DOC.length; i++) {
      const partial = DOC.slice(0, i);
      expect(parseMarkdownCached(partial)).toEqual(parseMarkdown(partial));
    }
  });

  it("STREAMING de un bloque de código sin cerrar (caso peligroso)", () => {
    const doc = "intro\n\n```bash\nls -la\n\necho hi\ncat /etc/hosts\n";
    for (let i = 0; i <= doc.length; i++) {
      expect(parseMarkdownCached(doc.slice(0, i))).toEqual(parseMarkdown(doc.slice(0, i)));
    }
    // Y sigue siendo un codeblock abierto que se traga la línea en blanco.
    expect(parseMarkdownCached(doc)[1]).toEqual({
      t: "codeblock", lang: "bash", code: "ls -la\n\necho hi\ncat /etc/hosts\n",
    });
  });

  it("STREAMING de una tabla a medias (fila separadora que aún no ha llegado)", () => {
    const steps = [
      "| a | b |",                       // todavía es un párrafo
      "| a | b |\n|---",                 // separadora incompleta → sigue siendo párrafo
      "| a | b |\n|---|---|",            // AHORA la línea de arriba pasa a cabecera
      "| a | b |\n|---|---|\n| 1 |",     // fila a medias
      "| a | b |\n|---|---|\n| 1 | 2 |", // tabla completa
    ];
    for (const s of steps) expect(parseMarkdownCached(s)).toEqual(parseMarkdown(s));
    expect(parseMarkdownCached(steps[0])[0]).toMatchObject({ t: "p" });
    expect(parseMarkdownCached(steps[4])[0]).toMatchObject({ t: "table" });
  });

  it("reutiliza la IDENTIDAD de los bloques ya cerrados (esto es lo que salva el render)", () => {
    const a = parseMarkdownCached("uno\n\ndos");
    const b = parseMarkdownCached("uno\n\ndos tres");
    // El párrafo "uno" ya está cerrado: mismo objeto ⇒ `React.memo(BlockView)`
    // se salta su re-render mientras la IA sigue escribiendo.
    expect(b[0]).toBe(a[0]);
    // El bloque vivo (el último) sí se re-parsea.
    expect(b[1]).not.toBe(a[1]);
    expect(b[1]).toEqual(parseMarkdown("uno\n\ndos tres")[1]);
  });

  it("mismo texto ⇒ mismo array (identidad estable para useMemo)", () => {
    const x = parseMarkdownCached(DOC);
    expect(parseMarkdownCached(DOC)).toBe(x);
  });

  it("no muta el árbol cacheado del prefijo al seguir creciendo el texto", () => {
    const a = parseMarkdownCached("uno\n\ndos");
    const snapshot = JSON.parse(JSON.stringify(a)) as MdBlock[];
    parseMarkdownCached("uno\n\ndos tres\n\n# cuatro\n\ncinco");
    expect(a).toEqual(snapshot);
    expect(a).toHaveLength(2);
  });

  it("normaliza CRLF igual que parseMarkdown", () => {
    const crlf = "uno\r\n\r\ndos\r\ntres";
    expect(parseMarkdownCached(crlf)).toEqual(parseMarkdown(crlf));
  });

  it("textos vacíos / solo espacios", () => {
    expect(parseMarkdownCached("")).toEqual(parseMarkdown(""));
    expect(parseMarkdownCached("\n\n\n")).toEqual(parseMarkdown("\n\n\n"));
    expect(parseMarkdownCached("   ")).toEqual(parseMarkdown("   "));
  });

  it("streams entrelazados (dos mensajes creciendo a la vez) no se contaminan", () => {
    const a = "AAA\n\nprimera";
    const b = "BBB\n\nsegunda";
    for (let i = 1; i <= Math.max(a.length, b.length); i++) {
      const pa = a.slice(0, Math.min(i, a.length));
      const pb = b.slice(0, Math.min(i, b.length));
      expect(parseMarkdownCached(pa)).toEqual(parseMarkdown(pa));
      expect(parseMarkdownCached(pb)).toEqual(parseMarkdown(pb));
    }
  });
});
