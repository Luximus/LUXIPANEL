#!/usr/bin/env node
/**
 * sync-eas-env.mjs — sincroniza las variables del archivo .env local hacia las
 * Environment Variables de EAS, para un entorno (development | preview | production).
 *
 * Se ejecuta automáticamente antes de cada `pnpm run build:*` (ver package.json),
 * de modo que el build de EAS siempre usa lo que tengas en app/.env. También
 * puede correrse a mano:  pnpm run eas:env:push:prod
 *
 * Uso:
 *   node scripts/sync-eas-env.mjs <environment> [opciones]
 *   <environment>  development | preview | production   (por defecto: production)
 *
 * Opciones:
 *   --file <ruta>      Archivo .env a leer (por defecto: app/.env junto a este script).
 *   --all              Sincroniza TODAS las variables (por defecto solo EXPO_PUBLIC_*).
 *   --visibility <v>   plaintext | sensitive | secret (por defecto: plaintext;
 *                      correcto para EXPO_PUBLIC_*, que son públicas por diseño).
 *   --dry-run          Muestra qué haría, sin tocar EAS.
 *   --continue-on-error No aborta si falla alguna variable (por defecto aborta).
 *
 * Variables de entorno:
 *   SKIP_EAS_ENV_SYNC=1   Salta la sincronización (útil para builds offline).
 *   EXPO_TOKEN=...        Token de acceso de Expo (alternativa a `eas login`).
 *
 * Requisitos: eas-cli instalado (este repo lo trae como devDependency) y sesión
 * iniciada (`pnpm exec eas login`) o EXPO_TOKEN exportado.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carga EXPO_TOKEN (auth no-interactiva de EAS) desde un archivo protegido si no
// está ya en el entorno: ~/.expo-token o app/.eas-token (ambos fuera de git).
// Así no hace falta `eas login` (que necesita navegador) ni tocar el perfil del shell.
const callerProvidedExpoToken = Boolean(process.env.EXPO_TOKEN);
(function loadExpoToken() {
  if (process.env.EXPO_TOKEN) return;
  for (const p of [resolve(homedir(), ".expo-token"), resolve(__dirname, "..", ".eas-token")]) {
    try {
      const t = readFileSync(p, "utf8").trim();
      if (t) { process.env.EXPO_TOKEN = t; return; }
    } catch {}
  }
})();

// ---------- args ----------
const argv = process.argv.slice(2);
const VALID_ENVS = ["development", "preview", "production"];
const positional = argv.filter((a) => !a.startsWith("--"));
const environment = positional[0] || "production";
const getOpt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const hasFlag = (name) => argv.includes(`--${name}`);

if (!VALID_ENVS.includes(environment)) {
  console.error(`✗ Entorno inválido: "${environment}". Usa uno de: ${VALID_ENVS.join(", ")}`);
  process.exit(1);
}
if (process.env.SKIP_EAS_ENV_SYNC === "1") {
  console.log("• SKIP_EAS_ENV_SYNC=1 → se omite la sincronización de EAS env.");
  process.exit(0);
}

const envFile = resolve(__dirname, "..", getOpt("file", ".env"));
const onlyPublic = !hasFlag("all");
const visibility = getOpt("visibility", "plaintext");
const dryRun = hasFlag("dry-run");
const continueOnError = hasFlag("continue-on-error");

// ---------- parse .env ----------
function parseEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`✗ No se pudo leer el archivo .env: ${path}`);
    process.exit(1);
  }
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// ---------- resolve eas binary ----------
// Devuelve { cmd, shell } o null. Estrategia robusta en Windows: ejecutar el
// entrypoint JS de eas-cli con el node actual (process.execPath) evita resolver
// los shims .CMD/.ps1 (que spawnSync no encuentra sin shell desde Node 22) y
// preserva el quoting de los argumentos — clave para los valores de env con
// espacios o caracteres especiales. Si no hay eas-cli local, cae a buscarlo en
// el PATH con shell:true (necesario para .cmd en Windows).
function resolveEas() {
  // The pnpm POSIX shim exports NODE_PATH for its dependency graph. Calling
  // eas-cli/bin/run directly skips that setup and breaks Expo config loading.
  if (process.platform !== "win32") {
    const shim = resolve(__dirname, "..", "node_modules", ".bin", "eas");
    if (existsSync(shim)) return { cmd: [shim], shell: false };
  }
  try {
    const require = createRequire(import.meta.url);
    const runJs = resolve(dirname(require.resolve("eas-cli/package.json")), "bin", "run");
    if (existsSync(runJs)) {
      const probe = spawnSync(process.execPath, [runJs, "--version"], {
        stdio: "ignore",
        cwd: resolve(__dirname, ".."),
      });
      if (probe.status === 0) return { cmd: [process.execPath, runJs], shell: false };
    }
  } catch {
    /* sin eas-cli local resoluble; probamos el PATH abajo */
  }

  const candidates = [["eas"], ["pnpm", "exec", "eas"], ["npx", "--no-install", "eas"]];
  for (const c of candidates) {
    const r = spawnSync(c[0], [...c.slice(1), "--version"], {
      stdio: "ignore",
      shell: true,
      cwd: resolve(__dirname, ".."),
    });
    if (r.status === 0) return { cmd: c, shell: true };
  }
  return null;
}

function runEas(eas, args) {
  return spawnSync(eas.cmd[0], [...eas.cmd.slice(1), ...args], {
    cwd: resolve(__dirname, ".."),
    encoding: "utf8",
    shell: eas.shell,
  });
}

// ---------- main ----------
const all = parseEnv(envFile);
const entries = Object.entries(all).filter(([k]) => (onlyPublic ? k.startsWith("EXPO_PUBLIC_") : true));

if (entries.length === 0) {
  console.error(`✗ No hay variables que sincronizar en ${envFile}${onlyPublic ? " (filtro EXPO_PUBLIC_*)" : ""}.`);
  process.exit(1);
}

console.log(`\n▶ Sincronizando ${entries.length} variable(s) → EAS env [${environment}] (visibility=${visibility})`);
console.log(`  archivo: ${envFile}${dryRun ? "  (DRY-RUN)" : ""}\n`);

if (dryRun) {
  for (const [k, v] of entries) console.log(`  ${k} = ${String(v).slice(0, 4)}…(${String(v).length} chars)`);
  console.log("\n(DRY-RUN: no se ejecutó ningún comando eas)");
  process.exit(0);
}

const easCmd = resolveEas();
if (!easCmd) {
  console.error("✗ eas-cli no está disponible. Instálalo (este repo lo trae como devDependency: `pnpm install`).");
  process.exit(1);
}

// auth check
let who;
if (!callerProvidedExpoToken && process.env.EXPO_TOKEN) {
  // A token saved on disk may have narrower permissions than an active local
  // Expo login. Prefer the login for env writes; retain the token as fallback.
  const savedToken = process.env.EXPO_TOKEN;
  delete process.env.EXPO_TOKEN;
  who = runEas(easCmd, ["whoami", "--non-interactive"]);
  if (who.status !== 0) {
    process.env.EXPO_TOKEN = savedToken;
    who = runEas(easCmd, ["whoami", "--non-interactive"]);
  }
} else {
  who = runEas(easCmd, ["whoami", "--non-interactive"]);
}
if (who.status !== 0) {
  console.error("✗ No hay sesión de EAS válida. Autentícate de una de estas formas:");
  console.error("  • Recomendado (server): crea un token en https://expo.dev/settings/access-tokens");
  console.error("    y guárdalo en el archivo:  umask 077 && printf %s 'TU_TOKEN' > ~/.expo-token");
  console.error("  • O exporta EXPO_TOKEN=<token> en el entorno.");
  console.error("  • O, si tu cuenta tiene contraseña, ejecuta:  pnpm exec eas login");
  process.exit(1);
}
console.log(`  cuenta EAS: ${String(who.stdout).trim()}\n`);

let ok = 0;
const failed = [];
for (const [name, value] of entries) {
  const args = [
    "env:create",
    "--name", name,
    "--value", value,
    "--environment", environment,
    "--visibility", visibility,
    "--type", "string",
    "--scope", "project",
    "--force",            // sobrescribe si ya existe → idempotente
    "--non-interactive",
  ];
  const r = runEas(easCmd, args);
  if (r.status === 0) {
    ok++;
    console.log(`  ✓ ${name}`);
  } else {
    failed.push(name);
    const msg = (r.stderr || r.stdout || "").trim().split("\n").slice(-2).join(" ");
    console.error(`  ✗ ${name} — ${msg}`);
    if (!continueOnError) {
      console.error(`\n✗ Abortado en ${name}. Corrige y reintenta (o usa --continue-on-error).`);
      process.exit(1);
    }
  }
}

console.log(`\n▶ Hecho: ${ok} OK${failed.length ? `, ${failed.length} con error: ${failed.join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
