// Codegen: genera iconos de archivo (offline) para el módulo `files`.
//
// Lee el set `@iconify-json/vscode-icons` y emite
// `src/scripts/extracted/pages/panel/files/file-icons.generated.ts` con:
//   - FILE_ICON_SVGS:  iconName -> SVG inline (dimensionado a 1em)
//   - EXT_TO_ICON:     extensión (lower) -> iconName
//   - NAME_TO_ICON:    nombre de archivo exacto (lower) -> iconName
//   - DEFAULT_FILE_ICON: iconName de fallback
//
// El SVG va embebido (sin CDN). Para añadir/cambiar un tipo: edita los mapas de
// abajo y corre `node scripts/build-file-icons.mjs` (lo invoca `build-extracted`).
// Si un iconName no existe en el set, el script falla y lista los faltantes.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
import { getIconData, replaceIDs } from "@iconify/utils";
import { inlineSvg, writeGenerated } from "./lib/icon-codegen.mjs";

const require = createRequire(import.meta.url);
const iconSet = require("@iconify-json/vscode-icons/icons.json");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(
  root,
  "src/scripts/extracted/pages/panel/files/file-icons.generated.ts",
);

// ── Mapa por extensión (lower-case, sin punto) ───────────────────────────────
const EXT_TO_ICON = {
  // JS / TS y frameworks
  js: "file-type-js",
  mjs: "file-type-js",
  cjs: "file-type-js",
  ts: "file-type-typescript",
  mts: "file-type-typescript",
  cts: "file-type-typescript",
  jsx: "file-type-reactjs",
  tsx: "file-type-reactts",
  vue: "file-type-vue",
  svelte: "file-type-svelte",
  astro: "file-type-astro",
  // Web / markup
  html: "file-type-html",
  htm: "file-type-html",
  css: "file-type-css",
  scss: "file-type-scss",
  sass: "file-type-sass",
  less: "file-type-less",
  xml: "file-type-xml",
  svg: "file-type-svg",
  // Lenguajes
  py: "file-type-python",
  rb: "file-type-ruby",
  php: "file-type-php",
  java: "file-type-java",
  kt: "file-type-kotlin",
  kts: "file-type-kotlin",
  go: "file-type-go",
  rs: "file-type-rust",
  c: "file-type-c",
  h: "file-type-cheader",
  cpp: "file-type-cpp",
  cc: "file-type-cpp",
  hpp: "file-type-cppheader",
  cs: "file-type-csharp",
  swift: "file-type-swift",
  dart: "file-type-dartlang",
  r: "file-type-r",
  lua: "file-type-lua",
  pl: "file-type-perl",
  perl: "file-type-perl",
  scala: "file-type-scala",
  ex: "file-type-elixir",
  exs: "file-type-elixir",
  // Datos / config
  json: "file-type-json",
  json5: "file-type-json",
  jsonc: "file-type-json",
  yaml: "file-type-yaml",
  yml: "file-type-yaml",
  toml: "file-type-toml",
  ini: "file-type-ini",
  conf: "file-type-config",
  config: "file-type-config",
  env: "file-type-dotenv",
  sql: "file-type-sql",
  csv: "file-type-excel",
  xls: "file-type-excel",
  xlsx: "file-type-excel",
  // Docs
  md: "file-type-markdown",
  markdown: "file-type-markdown",
  mdx: "file-type-light-mdx",
  txt: "file-type-text",
  log: "file-type-log",
  pdf: "file-type-pdf2",
  // Shell / infra
  sh: "file-type-shell",
  bash: "file-type-shell",
  zsh: "file-type-shell",
  fish: "file-type-shell",
  tf: "file-type-terraform",
  vim: "file-type-vim",
  // Imágenes
  png: "file-type-image",
  jpg: "file-type-image",
  jpeg: "file-type-image",
  gif: "file-type-image",
  webp: "file-type-image",
  bmp: "file-type-image",
  ico: "file-type-favicon",
  avif: "file-type-image",
  // Video
  mp4: "file-type-video",
  webm: "file-type-video",
  mov: "file-type-video",
  m4v: "file-type-video",
  mkv: "file-type-video",
  avi: "file-type-video",
  wmv: "file-type-video",
  flv: "file-type-video",
  ogv: "file-type-video",
  // Audio
  mp3: "file-type-audio",
  wav: "file-type-audio",
  ogg: "file-type-audio",
  oga: "file-type-audio",
  m4a: "file-type-audio",
  flac: "file-type-audio",
  aac: "file-type-audio",
  opus: "file-type-audio",
  // Archivos comprimidos
  zip: "file-type-zip",
  gz: "file-type-zip",
  tar: "file-type-zip",
  tgz: "file-type-zip",
  rar: "file-type-zip",
  "7z": "file-type-zip",
  bz2: "file-type-zip",
  xz: "file-type-zip",
  // Fuentes
  woff: "file-type-font",
  woff2: "file-type-font",
  ttf: "file-type-font",
  otf: "file-type-font",
  eot: "file-type-font",
};

// ── Mapa por nombre exacto de archivo (lower-case) ───────────────────────────
const NAME_TO_ICON = {
  dockerfile: "file-type-docker",
  ".dockerignore": "file-type-docker2",
  ".gitignore": "file-type-git",
  ".gitattributes": "file-type-git",
  ".gitmodules": "file-type-git",
  ".npmrc": "file-type-npm",
  ".nvmrc": "file-type-node",
  "package.json": "file-type-npm",
  "package-lock.json": "file-type-npm",
  "pnpm-lock.yaml": "file-type-pnpm",
  "pnpm-workspace.yaml": "file-type-pnpm",
  "yarn.lock": "file-type-yarn",
  "tsconfig.json": "file-type-tsconfig",
  ".eslintrc": "file-type-eslint",
  ".prettierrc": "file-type-prettier",
  "license": "file-type-license",
  "license.md": "file-type-license",
  "readme.md": "file-type-markdown",
  makefile: "file-type-makefile",
  ".env": "file-type-dotenv",
};

// ── Prefijos por nombre (startsWith) ─────────────────────────────────────────
const NAME_PREFIX_TO_ICON = [
  ["docker-compose", "file-type-docker"],
  [".github", "file-type-git"],
];

const DEFAULT_FILE_ICON = "default-file";

// ── Resolución y validación ──────────────────────────────────────────────────
const wanted = new Set([
  ...Object.values(EXT_TO_ICON),
  ...Object.values(NAME_TO_ICON),
  ...NAME_PREFIX_TO_ICON.map(([, icon]) => icon),
  DEFAULT_FILE_ICON,
]);

const svgs = {};
const missing = [];

for (const name of wanted) {
  const data = getIconData(iconSet, name);
  if (!data) {
    missing.push(name);
    continue;
  }
  const w = data.width ?? 32;
  const h = data.height ?? 32;
  const body = replaceIDs(data.body);
  // vscode-icons bodies carry their own fills, so no `fill` attribute here.
  svgs[name] = inlineSvg(body, { viewBox: `0 0 ${w} ${h}`, attrs: "" });
}

if (missing.length) {
  console.error(
    `[build-file-icons] iconos inexistentes en vscode-icons (${missing.length}):\n  ` +
      missing.sort().join("\n  "),
  );
  process.exit(1);
}

// ── Emitir módulo TS ─────────────────────────────────────────────────────────
const banner =
  "// AUTOGENERADO por scripts/build-file-icons.mjs — NO EDITAR A MANO.\n" +
  "// Iconos extraídos offline del set @iconify-json/vscode-icons.\n" +
  `// Regenerar: node scripts/build-file-icons.mjs (set v${iconSet.info?.version ?? "?"}).\n\n`;

const out =
  banner +
  `export const FILE_ICON_SVGS: Record<string, string> = ${JSON.stringify(svgs, null, 0)};\n\n` +
  `export const EXT_TO_ICON: Record<string, string> = ${JSON.stringify(EXT_TO_ICON, null, 0)};\n\n` +
  `export const NAME_TO_ICON: Record<string, string> = ${JSON.stringify(NAME_TO_ICON, null, 0)};\n\n` +
  `export const NAME_PREFIX_TO_ICON: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(NAME_PREFIX_TO_ICON, null, 0)};\n\n` +
  `export const DEFAULT_FILE_ICON = ${JSON.stringify(DEFAULT_FILE_ICON)};\n`;

writeGenerated(OUT, out);
console.log(
  `[build-file-icons] OK — ${Object.keys(svgs).length} iconos, ` +
    `${Object.keys(EXT_TO_ICON).length} ext, ${Object.keys(NAME_TO_ICON).length} nombres → ${path.relative(root, OUT)}`,
);
