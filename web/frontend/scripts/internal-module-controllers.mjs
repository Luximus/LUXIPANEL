// SPDX-License-Identifier: AGPL-3.0-only
// Bundle existing API controllers into explicit, disposable module factories.
import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function internalModuleControllers() {
  const cache = new Map();
  let imports;
  return {
    name: "lxp-internal-module-controllers",
    resolveId(id) {
      if (id.startsWith("virtual:lxp-controller/")) return "\0" + id;
    },
    async load(id) {
      if (!id.startsWith("\0virtual:lxp-controller/")) return null;
      const name = id.slice("\0virtual:lxp-controller/".length);
      if (cache.has(name)) return cache.get(name);
      const manifest = JSON.parse(
        await fs.readFile(
          path.join(root, "src/components/workspace/controller-entries.json"),
          "utf8",
        ),
      );
      const entry = manifest[name];
      if (!entry) throw new Error(`Missing internal controller ${name}`);
      imports ??= new Map(
        [
          ...String(
            await fs.readFile(
              path.join(root, "scripts/build-extracted.mjs"),
              "utf8",
            ),
          ).matchAll(
            /entry:\s*["']([^"']+)["'][\s\S]*?outfile:\s*["']([^"']+)["']/g,
          ),
        ].map((match) => [
          "/" + match[2].replace(/^public\//, ""),
          path.join(root, match[1]),
        ]),
      );
      const bundled = await build({
        stdin: {
          contents: entry.scripts.join("\n"),
          resolveDir: path.join(root, entry.directory),
          loader: "ts",
        },
        write: false,
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "es2022",
        logLevel: "warning",
        outdir: path.join(root, "public/internal-controller-assets"),
        loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
        plugins: [
          {
            name: "scope-source",
            setup(b) {
              b.onResolve({ filter: /^\/scripts\// }, async (args) => {
                const clean = args.path.split("?")[0];
                let target =
                  imports.get(clean) ||
                  path.join(
                    root,
                    "src",
                    clean.slice(1).replace(/\.js$/, ".ts"),
                  );
                try {
                  await fs.access(target);
                } catch {
                  target = path.join(root, "public", clean.slice(1));
                }
                return b.resolve(target, { kind: args.kind, resolveDir: root });
              });
              b.onResolve({ filter: /^@\// }, (args) =>
                b.resolve(path.join(root, "src", args.path.slice(2)), {
                  kind: args.kind,
                  resolveDir: root,
                }),
              );
              b.onLoad({ filter: /\.(ts|js)$/ }, async (args) => {
                if (
                  !args.path.startsWith(path.join(root, "src/scripts/")) &&
                  !args.path.startsWith(path.join(root, "public/scripts/"))
                )
                  return;
                const source = await fs.readFile(args.path, "utf8");
                // Delegated named actions replace global inline row handlers.
                return {
                  contents: source.replace(
                    /\bon(click|change|input)="/g,
                    'data-lxp-handler-$1="',
                  ),
                  loader: args.path.endsWith(".ts") ? "ts" : "js",
                };
              });
            },
          },
        ],
      });
      const code = bundled.outputFiles.find((file) =>
        file.path.endsWith(".js"),
      ).text;
      for (const asset of bundled.outputFiles.filter(
        (file) => !file.path.endsWith(".js"),
      )) {
        await fs.mkdir(path.dirname(asset.path), { recursive: true });
        await fs.writeFile(asset.path, asset.contents);
      }
      const css = bundled.outputFiles.find((file) =>
        file.path.endsWith(".css"),
      );
      const result = `${css ? `import ${JSON.stringify(css.path)};` : ""}\nexport function mount(scope) { const {document,window,location,history,fetch,setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame,EventSource,WebSocket,MutationObserver,ResizeObserver}=scope;\n${code}\n}`;
      cache.set(name, result);
      return result;
    },
    handleHotUpdate() {
      cache.clear();
    },
  };
}
