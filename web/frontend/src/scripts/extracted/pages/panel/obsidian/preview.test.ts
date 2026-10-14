// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../../vendor/markdown";
import { linkWikilinks } from "./preview";

describe("Obsidian Markdown preview", () => {
  it("turns text wikilinks into inert note buttons without touching code", () => {
    const root = document.createElement("div");
    root.innerHTML = renderMarkdown('[[Ideas|Abrir]] `[[literal]]`');
    linkWikilinks(root);
    expect(root.querySelector("button[data-wikilink]")?.getAttribute("data-wikilink")).toBe("Ideas");
    expect(root.querySelector("code button")).toBeNull();
  });
});
