import { defineConfig } from "vitest/config";
import type { PluginOption } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Unit tests for pure frontend logic (lib/, utils/, helpers, validation,
// stores). Kept separate from the Playwright e2e suite under `e2e/` — the
// `test` script stays Playwright; `test:unit` runs Vitest.
//
// Extracted browser scripts import absolute runtime URLs under /scripts/.
// Resolve those URLs before Vite's public-dir guard sees them so unit tests can
// load the TypeScript sources (or a virtual Monaco stub).

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const filesScriptsDir = `${srcDir}/scripts/extracted/pages/panel/files`;
const extractedLibDir = `${srcDir}/scripts/extracted/lib`;

const runtimeSrcMap: Record<string, string> = {
  "/scripts/extracted/vendor/qrcode-browser.js": `${srcDir}/scripts/qrcode-browser.ts`,
  "/scripts/extracted/layouts/tornasol-animation.js": `${srcDir}/scripts/extracted/layouts/tornasol-animation.ts`,
  "/scripts/extracted/lib/sudo.js": "virtual:lxp-sudo-source",
  "/scripts/extracted/lib/api-client.js": `${srcDir}/lib/api-client.ts`,
  "/scripts/extracted/lib/confirm.js": `${srcDir}/lib/confirm.ts`,
  "/scripts/extracted/lib/assistant-request.js": `${srcDir}/lib/assistant-request.ts`,
  // Shared helpers the DRY pass factored out of the module scripts. They are
  // imported by their RUNTIME URL, which Vite refuses to resolve on its own
  // (`/public` JS is copied as-is), so every one of them needs an entry here or
  // the whole importing test suite fails to load.
  "/scripts/extracted/lib/search-catalog.js": `${srcDir}/lib/search-catalog.ts`,
  "/scripts/extracted/lib/search-target.js": `${srcDir}/lib/search-target.ts`,
  "/scripts/extracted/lib/page-i18n.js": `${srcDir}/lib/page-i18n.ts`,
  "/scripts/extracted/lib/toast.js": `${srcDir}/lib/toast.ts`,
  "/scripts/extracted/lib/dom.js": `${extractedLibDir}/dom.ts`,
  "/scripts/extracted/lib/escape.js": `${extractedLibDir}/escape.ts`,
  "/scripts/extracted/lib/module-deps.js": `${extractedLibDir}/module-deps.ts`,
  "/scripts/extracted/pages/panel/files/file-icons.generated.js": `${filesScriptsDir}/file-icons.generated.ts`,
};

const monacoStub = `
const __lxpMonacoStub = {
  host: null,
  diffHost: null,
  ensureMonaco() { return Promise.resolve(); },
  openFile() {},
  getValue() { return ""; },
  setValue() {},
  closeFile() {},
  markSaved() {},
  openDiff() {},
  closeDiff() {},
  isDirty() { return false; },
  gotoLine() {},
  layout() {},
  bindEscape() {},
};
export async function initFilesMonacoEditor(_opts) { return __lxpMonacoStub; }
export function getMonacoEditor() { return __lxpMonacoStub; }
`.trim();

function resolveExtractedLib(base: string): string | null {
  for (const candidate of [`${extractedLibDir}/${base}.ts`, `${srcDir}/lib/${base}.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const runtimeUrlResolver: PluginOption = {
  name: "lxp-runtime-url-resolver",
  enforce: "pre",
  transform(code: string, id: string) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(id) && id !== "\0lxp-sudo-source") return null;
    let mutated = code;
    for (const [runtimeUrl, sourcePath] of Object.entries(runtimeSrcMap)) {
      const escaped = runtimeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(["'])${escaped}(?:\\?[^"']*)?\\1`, "g");
      mutated = mutated.replace(pattern, `"${sourcePath}"`);
    }
    // Generic fallback for the shared libs: `/scripts/extracted/lib/<x>.js` →
    // `src/scripts/extracted/lib/<x>.ts`, else `src/lib/<x>.ts` (build-extracted
    // pulls from both). Explicit map entries above still win.
    const libPattern = /(["'])\/scripts\/extracted\/lib\/([A-Za-z0-9_.-]+)\.js(?:\?[^"']*)?\1/g;
    mutated = mutated.replace(libPattern, (_match: string, _quote: string, base: string) => {
      const candidate = resolveExtractedLib(base);
      return candidate ? `"${candidate}"` : _match;
    });
    const pagePattern = /(["'])\/scripts\/extracted\/pages\/panel\/files\/([A-Za-z0-9_.-]+)\.js(?:\?[^"']*)?\1/g;
    mutated = mutated.replace(pagePattern, (_match: string, _quote: string, base: string) => {
      if (base === "panel-files-monaco") return '"virtual:lxp-monaco-stub"';
      const candidate = `${filesScriptsDir}/${base}.ts`;
      return existsSync(candidate) ? `"${candidate}"` : _match;
    });
    return mutated === code ? null : { code: mutated, map: null };
  },
  resolveId(source: string) {
    if (source === "astro:middleware") return "\0lxp-astro-middleware";
    if (source === "virtual:lxp-sudo-source") return "\0lxp-sudo-source";
    const runtimePath = source.split("?", 1)[0] ?? source;
    const mapped = runtimeSrcMap[runtimePath];
    if (mapped) return mapped;
    if (runtimePath === "virtual:lxp-monaco-stub" || runtimePath === "/scripts/extracted/pages/panel/files/panel-files-monaco.js") {
      return "\0lxp-monaco-stub";
    }
    const libPrefix = "/scripts/extracted/lib/";
    if (runtimePath.startsWith(libPrefix) && runtimePath.endsWith(".js")) {
      const candidate = resolveExtractedLib(runtimePath.slice(libPrefix.length, -3));
      if (candidate) return candidate;
    }
    const prefix = "/scripts/extracted/pages/panel/files/";
    if (runtimePath.startsWith(prefix) && runtimePath.endsWith(".js")) {
      const candidate = `${filesScriptsDir}/${runtimePath.slice(prefix.length, -3)}.ts`;
      if (existsSync(candidate)) return candidate;
    }
    return null;
  },
  load(id: string) {
    if (id === "\0lxp-astro-middleware") return "export const defineMiddleware = (handler) => handler;";
    if (id === "\0lxp-sudo-source") {
      return readFileSync(fileURLToPath(new URL("./public/scripts/extracted/lib/sudo.js", import.meta.url)), "utf8");
    }
    return id === "\0lxp-monaco-stub" ? monacoStub : null;
  },
};

export default defineConfig({
  plugins: [runtimeUrlResolver],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
