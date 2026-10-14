// Codegen: genera logos de marca (offline) para los módulos del panel que SON
// productos con marca propia (NGINX, Cloudflare, Obsidian).
//
// Mismo enfoque que `build-provider-icons.mjs`: emite SVG inline (sin CDN),
// dimensionado a 1em y con `fill="currentColor"` para heredar el color del
// texto circundante. Salidas (mismo contenido, dos mundos de bundle):
//   src/components/floating-assistant/module-icons.generated.ts   (React)
//   src/scripts/extracted/lib/module-icons.generated.ts           (extracted:
//     sidebar PanelLayout-define-vars-script1 y catálogo modules/index-script1
//     lo importan por URL como /scripts/extracted/lib/module-icons.generated.js)
//     - MODULE_ICON_SVGS: moduleId -> SVG inline
//
// Los paths provienen de simple-icons v16.23.0 (marcas oficiales, viewBox
// 0 0 24 24): nginx · cloudflare · obsidian · expo. `dns` es alias de nginx (el
// catálogo LP y el sidebar identifican el módulo NGINX con el código "dns").
// (openclaw usa un glifo de langosta inline propio; bitninja NO tiene logo en
//  simple-icons → sigue con Tabler.)
// Para actualizar/añadir un logo: reemplaza/añade su path aqui y corre
// `node scripts/build-module-icons.mjs` (lo invoca `build-extracted`).

import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  brandIconBanner,
  lucideIconSvg,
  simpleIconSvgs,
  writeGenerated,
} from "./lib/icon-codegen.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTS = [
  path.join(root, "src/components/floating-assistant/module-icons.generated.ts"),
  path.join(root, "src/scripts/extracted/lib/module-icons.generated.ts"),
];

// id de módulo -> path d (simple-icons, viewBox 0 0 24 24)
const MODULE_PATHS = {
  nginx: "M12 0L1.605 6v12L12 24l10.395-6V6L12 0zm6 16.59c0 .705-.646 1.29-1.529 1.29-.631 0-1.351-.255-1.801-.81l-6-7.141v6.66c0 .721-.57 1.29-1.274 1.29H7.32c-.721 0-1.29-.6-1.29-1.29V7.41c0-.705.63-1.29 1.5-1.29.646 0 1.38.255 1.83.81l5.97 7.141V7.41c0-.721.6-1.29 1.29-1.29h.075c.72 0 1.29.6 1.29 1.29v9.18H18z",
  cloudflare: "M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727",
  obsidian: "M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z",
  expo: "M0 20.084c.043.53.23 1.063.718 1.778.58.849 1.576 1.315 2.303.567.49-.505 5.794-9.776 8.35-13.29a.761.761 0 011.248 0c2.556 3.514 7.86 12.785 8.35 13.29.727.748 1.723.282 2.303-.567.57-.835.728-1.42.728-2.046 0-.426-8.26-15.798-9.092-17.078-.8-1.23-1.044-1.498-2.397-1.542h-1.032c-1.353.044-1.597.311-2.398 1.542C8.267 3.991.33 18.758 0 19.77Z",
};

const svgs = simpleIconSvgs(MODULE_PATHS);
// El catálogo LP / sidebar llaman "dns" al módulo NGINX.
svgs.dns = svgs.nginx;

// Iconos lucide (stroke-based, multi-elemento) — distintos a simple-icons:
// no usan un único path `fill`, sino varios elementos trazados con
// `stroke="currentColor"` y `fill="none"`. Por eso se construyen aparte.
// `database-backup` (lucide) para el módulo de backups.
const lucideBackupInner =
  `<ellipse cx="12" cy="5" rx="9" ry="3"/>` +
  `<path d="M3 12a9 3 0 0 0 5 2.69"/>` +
  `<path d="M21 9.3V5"/>` +
  `<path d="M3 5v14a9 3 0 0 0 6.47 2.88"/>` +
  `<path d="M12 12v4h4"/>` +
  `<path d="M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16"/>`;
const lucideBackupSvg = lucideIconSvg(lucideBackupInner);
// El módulo aparece como "backup" o "backups" según el sitio.
svgs.backup = lucideBackupSvg;
svgs.backups = lucideBackupSvg;

// openclaw NO tiene logo en simple-icons → usamos un glifo de langosta inline
// propio. MONOCROMO `currentColor` (como nginx/cloudflare/obsidian) para que en
// el menú/sidebar y el catálogo herede el mismo gris/primary que los demás
// iconos. Los ojos se "perforan" con una `<mask>` (id estático `oc-claw-eyes`;
// duplicados en el DOM colapsan al primero, visualmente idéntico) para que se
// distingan en un solo color.
const openclawLobsterSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="1em" height="1em" fill="currentColor" style="vertical-align:-0.125em" aria-hidden="true"><mask id="oc-claw-eyes"><rect width="120" height="120" fill="#fff"/><circle cx="45" cy="35" r="5.5" fill="#000"/><circle cx="75" cy="35" r="5.5" fill="#000"/></mask><g mask="url(#oc-claw-eyes)"><path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z"/><path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z"/><path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z"/></g><path d="M45 15 Q35 5 30 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M75 15 Q85 5 90 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
svgs.openclaw = openclawLobsterSvg;

const out =
  brandIconBanner("build-module-icons.mjs") +
  `export const MODULE_ICON_SVGS: Record<string, string> = ${JSON.stringify(svgs, null, 0)};\n`;

for (const OUT of OUTS) {
  writeGenerated(OUT, out);
  console.log(`[build-module-icons] OK - ${Object.keys(svgs).length} iconos -> ${path.relative(root, OUT)}`);
}
