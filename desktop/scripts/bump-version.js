// Sube el patch de `version` en package.json (lo que electron-builder usa como
// versión del instalador en Windows/macOS/Linux). Se ejecuta UNA vez por
// release (`pnpm release:patch`), NO dentro de cada `dist:*`, para que los tres
// SO salgan con la MISMA versión. ESM porque el paquete es "type": "module".
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = pkg.version;

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(typeof current === "string" ? current : "");
if (!match) {
  throw new Error(`package.json version debe ser major.minor.patch. Valor actual: ${current}`);
}

const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`desktop version bumped: ${current} -> ${next}`);
