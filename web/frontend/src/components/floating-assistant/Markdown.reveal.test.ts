import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Markdown } from "./Markdown";

describe("Markdown with Scroll Reveal words", () => {
  const source = "Texto **fuerte** y [enlace](https://example.com) con `codigo`.\n\n- Elemento uno";

  it("preserves formatting and links while exposing text words to Scroll Reveal", () => {
    const html = renderToStaticMarkup(createElement(Markdown, { text: source, revealWords: true }));
    expect(html).toContain("<strong>");
    expect(html).toContain("<a href=\"https://example.com\"");
    expect(html).toContain("<code");
    expect(html).toContain("<li data-scroll-reveal-block=\"\">");
    expect(html.match(/data-scroll-reveal-block/g)).toHaveLength(2);
    expect(html).toContain("data-scroll-reveal-word");
    expect(html).toContain("fuerte</span>");
    expect(html).not.toContain("data-scroll-reveal-word=\"\">codigo");
  });

  it("leaves regular Markdown output unchanged when reveal is disabled", () => {
    const html = renderToStaticMarkup(createElement(Markdown, { text: source }));
    expect(html).not.toContain("data-scroll-reveal-word");
    expect(html).not.toContain("data-scroll-reveal-block");
    expect(html).toContain("<strong>fuerte</strong>");
  });

  it("renders each line of a concise final summary separately", () => {
    const html = renderToStaticMarkup(createElement(Markdown, {
      text: "Corregí el resumen.\nPubliqué el frontend.\nEl servicio responde.",
      revealWords: true,
    }));
    expect(html.match(/<br\s*\/>/g)).toHaveLength(2);
    expect(html).toContain("Corregí");
    expect(html).toContain('<br/><span data-scroll-reveal-word="">El</span>');
  });
});
