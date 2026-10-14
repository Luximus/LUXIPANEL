/**
 * Tests de `html-lite`: HTML saneado del blog → bloques nativos. El input
 * simula la salida real de `sanitizeBlogHtml` del backend (TipTap / IA):
 * whitelist p/br/h1–h4/ul/ol/li/strong/b/em/i/u/s/blockquote/a/code/pre/img/
 * hr/span/figure/figcaption/iframe(YouTube/Vimeo).
 */
import { describe, expect, it } from "vitest";
import { decodeEntities, parseBlogHtml, type HtmlBlock } from "./html-lite";
import type { MdBlock } from "./markdown-lite";

function md(blocks: HtmlBlock[]): MdBlock[] {
  return blocks.filter((b): b is MdBlock => b.t !== "image" && b.t !== "embed");
}

describe("decodeEntities", () => {
  it("decodifica entidades con nombre y numéricas", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x2192; f&nbsp;g")).toBe(
      "a & b <c> \"d\" 'e' → f\u00a0g",
    );
  });
  it("deja intactas las secuencias desconocidas", () => {
    expect(decodeEntities("&foo; &#zz;")).toBe("&foo; &#zz;");
  });

  it("code points fuera de rango Unicode no lanzan RangeError: quedan crudos", () => {
    expect(decodeEntities("a &#999999999; b &#x110000; c &#x10FFFF;")).toBe(
      "a &#999999999; b &#x110000; c \u{10FFFF}",
    );
    expect(parseBlogHtml("<p>rota &#999999999; y &#x110000; siguen</p>")).toEqual([
      { t: "p", lines: [[{ t: "text", text: "rota &#999999999; y &#x110000; siguen" }]] },
    ]);
  });

  it("decodifica entidades tipográficas y de símbolos comunes", () => {
    expect(decodeEntities("&copy; 2026 &middot; 10&times;5 &raquo; 9&euro; &reg;&trade; 45&deg;")).toBe(
      "© 2026 · 10×5 » 9€ ®™ 45°",
    );
  });

  it("decodifica las letras acentuadas Latin-1 (paridad con el navegador en posts ES/FR/DE)", () => {
    expect(decodeEntities("espa&ntilde;ol caf&eacute; &Eacute;xito ma&ntilde;ana")).toBe(
      "español café Éxito mañana",
    );
    expect(decodeEntities("fran&ccedil;ais &agrave; c&ocirc;t&eacute; s&uuml;&szlig; &Uuml;ber")).toBe(
      "français à côté süß Über",
    );
    expect(parseBlogHtml("<p>espa&ntilde;ol y franc&eacute;s</p>")).toEqual([
      { t: "p", lines: [[{ t: "text", text: "español y francés" }]] },
    ]);
    // Case-sensitive como en HTML: la variante con mayúscula es OTRA letra.
    expect(decodeEntities("&Ntilde; vs &ntilde;")).toBe("Ñ vs ñ");
  });
});

describe("parseBlogHtml — bloques", () => {
  it("párrafos con inlines y <br> como salto de línea", () => {
    const [p] = parseBlogHtml("<p>Hola <strong>mundo</strong> con <em>estilo</em><br/>segunda línea</p>");
    expect(p).toMatchObject({ t: "p" });
    if (p.t !== "p") throw new Error("no p");
    expect(p.lines).toHaveLength(2);
    expect(p.lines[0]).toEqual([
      { t: "text", text: "Hola " },
      { t: "bold", children: [{ t: "text", text: "mundo" }] },
      { t: "text", text: " con " },
      { t: "italic", children: [{ t: "text", text: "estilo" }] },
    ]);
    expect(p.lines[1]).toEqual([{ t: "text", text: "segunda línea" }]);
  });

  it("headings h1–h4 con su nivel", () => {
    const blocks = md(parseBlogHtml("<h1>Uno</h1><h2>Dos</h2><h3>Tres</h3><h4>Cuatro</h4>"));
    expect(blocks.map((b) => (b.t === "heading" ? b.level : null))).toEqual([1, 2, 3, 4]);
  });

  it("listas anidadas con <li><p>…</p></li> (TipTap) aplanado", () => {
    const [list] = parseBlogHtml("<ul><li><p>Primero</p></li><li><p>Segundo</p><ol><li><p>Sub</p></li></ol></li></ul>");
    if (list.t !== "list") throw new Error("no list");
    expect(list.ordered).toBe(false);
    expect(list.items[0].children).toEqual([{ t: "text", text: "Primero" }]);
    expect(list.items[1].nested?.ordered).toBe(true);
    expect(list.items[1].nested?.items[0].children).toEqual([{ t: "text", text: "Sub" }]);
  });

  it("blockquote de varios párrafos → quote multilínea", () => {
    const [q] = parseBlogHtml("<blockquote><p>Una</p><p>Dos</p></blockquote>");
    if (q.t !== "quote") throw new Error("no quote");
    expect(q.lines).toHaveLength(2);
  });

  it("pre/code → codeblock con entidades decodificadas", () => {
    const [cb] = parseBlogHtml("<pre><code>if (a &lt; b) {\n  run();\n}</code></pre>");
    expect(cb).toEqual({ t: "codeblock", lang: "", code: "if (a < b) {\n  run();" + "\n}" });
  });

  it("hr, u (subrayado), s (tachado), a (link) y code inline", () => {
    const blocks = parseBlogHtml('<p><u>sub</u> <s>tachado</s> <a href="https://x.co">link</a> <code>cmd</code></p><hr/>');
    const [p, hr] = blocks;
    if (p.t !== "p") throw new Error("no p");
    expect(p.lines[0]).toEqual([
      { t: "u", children: [{ t: "text", text: "sub" }] },
      { t: "text", text: " " },
      { t: "strike", children: [{ t: "text", text: "tachado" }] },
      { t: "text", text: " " },
      { t: "link", text: "link", href: "https://x.co" },
      { t: "text", text: " " },
      { t: "code", text: "cmd" },
    ]);
    expect(hr).toEqual({ t: "hr" });
  });
});

describe("parseBlogHtml — media", () => {
  it("img suelta → bloque imagen", () => {
    expect(parseBlogHtml('<img src="https://cdn/x.png" alt="foto"/>')).toEqual([
      { t: "image", src: "https://cdn/x.png", alt: "foto", caption: null },
    ]);
  });

  it("figure con img + figcaption → imagen con caption", () => {
    expect(parseBlogHtml('<figure><img src="https://cdn/y.jpg" alt=""/><figcaption>Pie de foto</figcaption></figure>')).toEqual([
      { t: "image", src: "https://cdn/y.jpg", alt: "", caption: "Pie de foto" },
    ]);
  });

  it("img dentro de un párrafo parte el párrafo EN SU POSICIÓN (orden del documento)", () => {
    const blocks = parseBlogHtml('<p>Antes <img src="https://cdn/z.png" alt=""/> después</p>');
    expect(blocks).toEqual([
      { t: "p", lines: [[{ t: "text", text: "Antes" }]] },
      { t: "image", src: "https://cdn/z.png", alt: "", caption: null },
      { t: "p", lines: [[{ t: "text", text: "después" }]] },
    ]);
  });

  it("iframe de YouTube → bloque embed", () => {
    expect(parseBlogHtml('<iframe src="https://www.youtube.com/embed/abc123" title="Demo"></iframe>')).toEqual([
      { t: "embed", src: "https://www.youtube.com/embed/abc123", title: "Demo" },
    ]);
  });

  it("<a> que solo envuelve <img> no evapora el bloque: la imagen sobrevive", () => {
    expect(parseBlogHtml('<p><a href="https://x.co"><img src="https://cdn/a.png" alt="linked"/></a></p>')).toEqual([
      { t: "image", src: "https://cdn/a.png", alt: "linked", caption: null },
    ]);
  });

  it("<a><img/>texto</a> conserva imagen Y link, en orden", () => {
    expect(parseBlogHtml('<p><a href="https://x.co"><img src="https://cdn/b.png" alt=""/>Ver más</a></p>')).toEqual([
      { t: "image", src: "https://cdn/b.png", alt: "", caption: null },
      { t: "p", lines: [[{ t: "link", text: "Ver más", href: "https://x.co" }]] },
    ]);
  });

  it("<a> que envuelve <iframe> conserva el embed", () => {
    expect(parseBlogHtml('<p><a href="https://x.co"><iframe src="https://www.youtube.com/embed/v1"></iframe></a></p>')).toEqual([
      { t: "embed", src: "https://www.youtube.com/embed/v1", title: null },
    ]);
  });

  it("figure con iframe + figcaption → embed con el caption como título", () => {
    expect(parseBlogHtml('<figure><iframe src="https://player.vimeo.com/video/99" title="hostname"></iframe><figcaption>Demo del panel</figcaption></figure>')).toEqual([
      { t: "embed", src: "https://player.vimeo.com/video/99", title: "Demo del panel" },
    ]);
  });

  it("imágenes dentro de <li> salen DESPUÉS de la lista completa, en orden", () => {
    const blocks = parseBlogHtml(
      '<ul><li><p>Uno <img src="https://cdn/1.png" alt=""/></p></li><li><p>Dos <img src="https://cdn/2.png" alt=""/></p></li></ul>',
    );
    expect(blocks.map((b) => b.t)).toEqual(["list", "image", "image"]);
    expect(blocks[1]).toMatchObject({ src: "https://cdn/1.png" });
    expect(blocks[2]).toMatchObject({ src: "https://cdn/2.png" });
    if (blocks[0].t !== "list") throw new Error("no list");
    expect(blocks[0].items.map((i) => i.children)).toEqual([
      [{ t: "text", text: "Uno" }],
      [{ t: "text", text: "Dos" }],
    ]);
  });

  it("img dentro de blockquote sale DESPUÉS de la cita", () => {
    const blocks = parseBlogHtml('<blockquote><p>Cita <img src="https://cdn/q.png" alt=""/></p></blockquote>');
    expect(blocks.map((b) => b.t)).toEqual(["quote", "image"]);
  });
});

describe("parseBlogHtml — robustez", () => {
  it("HTML vacío o solo espacios → sin bloques", () => {
    expect(parseBlogHtml("")).toEqual([]);
    expect(parseBlogHtml("  \n ")).toEqual([]);
  });

  it("cierres desbalanceados no rompen el parser", () => {
    const blocks = parseBlogHtml("<p>abierto <strong>fuerte</p></strong><p>siguiente</p>");
    expect(md(blocks).length).toBeGreaterThanOrEqual(2);
  });

  it("texto suelto a nivel raíz se vuelve párrafo", () => {
    const [p] = parseBlogHtml("texto sin tags");
    expect(p).toMatchObject({ t: "p" });
  });

  it("span passthrough y atributos con entidades", () => {
    const [p] = parseBlogHtml('<p><span>con</span> <a href="https://x.co/?a=1&amp;b=2">q</a></p>');
    if (p.t !== "p") throw new Error("no p");
    expect(p.lines[0]).toContainEqual({ t: "link", text: "q", href: "https://x.co/?a=1&b=2" });
  });
});
