import { expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/api-client.js?v=20260506a", () => ({
  resolvePanelApiPath: (path: string) => path,
  scopeHeaders: () => ({}),
}));

it("opens a source file from the project tree without images", async () => {
  document.body.innerHTML = `
    <div id="project-explorer-root"><div id="pe-tree"></div><div id="pe-results"></div>
      <input id="pe-search"><p id="pe-search-status"></p><nav id="pe-breadcrumb"></nav>
      <h2 id="pe-title"></h2><span id="pe-meta"></span><div id="pe-message"></div>
      <div id="pe-folder"></div><div id="pe-code-wrap" class="hidden"><pre id="pe-line-numbers"></pre><code id="pe-code"></code></div>
    </div>`;
  Element.prototype.scrollIntoView = vi.fn();
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    const path = url.searchParams.get("path") || "";
    const data = url.pathname.endsWith("/tree")
      ? { path, entries: path ? [{ name: "server.ts", path: "backend/server.ts", kind: "file" }] : [{ name: "backend", path: "backend", kind: "directory" }], truncated: false }
      : { path, name: "server.ts", size: 20, content: "export const app = 1;", language: "TypeScript", binary: false, truncated: false };
    return { ok: true, json: async () => ({ ok: true, data }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  await import("./index-script1");
  await vi.waitFor(() => expect(document.querySelector('[data-pe-tree-path="backend"]')).not.toBeNull());
  (document.querySelector('[data-pe-tree-path="backend"]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.querySelector('[data-pe-tree-path="backend/server.ts"]')).not.toBeNull());
  (document.querySelector('[data-pe-tree-path="backend/server.ts"]') as HTMLButtonElement).click();
  await vi.waitFor(() => expect(document.getElementById("pe-code")?.textContent).toBe("export const app = 1;"));
  expect(document.getElementById("pe-line-numbers")?.textContent).toBe("1");
  expect(document.querySelector("#project-explorer-root img")).toBeNull();
  vi.unstubAllGlobals();
});
