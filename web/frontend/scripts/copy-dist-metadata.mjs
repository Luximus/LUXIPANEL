import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const files = ["package.json", "pnpm-lock.yaml", "tsconfig.json", "astro.config.mjs"];

// Guardia: aborta si el manifiesto SSR de Astro quedó sin reemplazar.
// Un `astro build` interrumpido puede dejar el token `@@ASTRO_MANIFEST_REPLACE@@`
// literal en el chunk de entrada → al arrancar, deserializeManifest recibe un
// string, `manifest.key`/`rootDir` son undefined y el proceso entra en
// crash-loop (puerto 4321 nunca levanta → nginx 502 en /sso/callback).
// Fallar aquí impide que `redeploy` (build && pm2 restart) despliegue un dist roto.
const chunksDir = path.join(dist, "server", "chunks");
const PLACEHOLDER = "@@ASTRO_MANIFEST_" + "REPLACE@@"; // partido para no auto-detectarse
let chunkFiles = [];
try {
  chunkFiles = (await readdir(chunksDir)).filter((f) => f.endsWith(".mjs"));
} catch {
  console.error(`[build-guard] No existe ${chunksDir} — el build SSR no se completó.`);
  process.exit(1);
}
for (const f of chunkFiles) {
  const content = await readFile(path.join(chunksDir, f), "utf8");
  if (content.includes(PLACEHOLDER)) {
    console.error(
      `[build-guard] FALLO: ${f} contiene el manifiesto SSR sin reemplazar ` +
        `(${PLACEHOLDER}). El build de Astro quedó incompleto; arrancarlo causaría ` +
        `crash-loop y 502. Reconstruye limpio: rm -rf dist && pnpm run build.`,
    );
    process.exit(1);
  }
}
console.log(`[build-guard] OK: manifiesto SSR reemplazado en ${chunkFiles.length} chunks.`);

await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(path.join(root, file), path.join(dist, file));
}

await import("./defer-editor-css.mjs");
