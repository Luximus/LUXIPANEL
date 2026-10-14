#!/usr/bin/env node
/**
 * os-compat-derive.mjs — derivación AUTOMÁTICA de os_compat/arch (decisión
 * 2026-06-09, ROADMAP §9.12): el dev NO declara compatibilidad de SO; el
 * pipeline la calcula analizando estáticamente los comandos que el módulo
 * ejecuta vía ctx.server.exec / submitMutation (literales de string en el
 * código del backend).
 *
 * Heurística (evidencia incluida en el verdict para el revisor IA/humano):
 *   - gestores de paquetes y herramientas distro-específicas acotan la
 *     familia (apt/dpkg/ufw → debian/ubuntu; dnf/yum/rpm → rhel-family;
 *     apk → alpine; pacman → arch linux; zypper → opensuse).
 *   - sin señales distro-específicas → baseline de la flota soportada
 *     (ubuntu>=22.04, debian>=12 — la misma de los docs/ejemplos).
 *   - arch: tokens explícitos x86_64/amd64 vs arm64/aarch64 en el código
 *     (p. ej. URLs de descarga de binarios). Ninguno o ambos → ambas.
 *
 * Gemelo de capability-diff.mjs (mismo contrato de pipeline): el verdict se
 * publica en el evento `intake` como detail.derived y LP lo persiste en el
 * manifest de la versión (marketplace.service.recordReviewEvent).
 *
 * Usage:
 *   node security/os-compat-derive.mjs <module-dir>
 * Exit code: 0 (derivación, no gate; 2 = error de uso). Verdict JSON a stdout:
 *   { os_compat, arch, evidence: [{file,line,token,family}], runtime_deps_hints }
 */
import fs from "node:fs";
import path from "node:path";

const [, , moduleDir] = process.argv;
if (!moduleDir || !fs.existsSync(moduleDir)) {
  console.error("usage: os-compat-derive.mjs <module-dir>");
  process.exit(2);
}

// token → familia de distros que implica
const FAMILY_TOKENS = new Map(Object.entries({
  "apt": "debian", "apt-get": "debian", "apt-cache": "debian", "dpkg": "debian",
  "ufw": "debian", "update-rc.d": "debian", "debconf-set-selections": "debian",
  "dnf": "rhel", "yum": "rhel", "rpm": "rhel", "firewall-cmd": "rhel",
  "apk": "alpine",
  "pacman": "archlinux",
  "zypper": "opensuse",
}));

const FAMILY_OS = {
  debian: ["ubuntu>=22.04", "debian>=12"],
  rhel: ["rhel>=9", "almalinux>=9", "rockylinux>=9"],
  alpine: ["alpine>=3.19"],
  archlinux: ["archlinux"],
  opensuse: ["opensuse>=15.5"],
};
const BASELINE = ["ubuntu>=22.04", "debian>=12"];

// binarios de servicio comunes → pista de runtime_deps (informativo, no gate)
const RUNTIME_HINTS = ["nginx", "mysql", "mariadb", "psql", "postgres", "redis-server", "redis-cli", "php", "certbot", "docker", "node", "python3"];

const SRC_RE = /\.(ts|js|mjs|cjs)$/;
const evidence = [];
const archHits = { x86_64: null, arm64: null };
const runtimeHints = new Map();

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (SRC_RE.test(e.name)) yield p;
  }
}

// extrae literales de string ('...' "..." `...`) con su línea
function* stringLiterals(source) {
  const simple = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1|`((?:\\.|[^\\`])*)`/gs;
  let m;
  while ((m = simple.exec(source)) !== null) {
    const text = m[2] ?? m[3] ?? "";
    if (!text) continue;
    const line = source.slice(0, m.index).split("\n").length;
    yield { text, line };
  }
}

const families = new Set();
for (const file of walk(moduleDir)) {
  const rel = path.relative(moduleDir, file);
  const src = fs.readFileSync(file, "utf8");
  for (const { text, line } of stringLiterals(src)) {
    // tokens de comando: palabras al inicio o tras separadores de shell
    for (const word of text.split(/[\s;|&()<>]+/)) {
      const tok = word.replace(/^sudo$/, "").trim();
      if (!tok) continue;
      const fam = FAMILY_TOKENS.get(tok);
      if (fam) {
        families.add(fam);
        evidence.push({ file: rel, line, token: tok, family: fam });
      }
      if (RUNTIME_HINTS.includes(tok) && !runtimeHints.has(tok)) runtimeHints.set(tok, `${rel}:${line}`);
    }
    if (/\b(x86_64|amd64)\b/.test(text) && !archHits.x86_64) archHits.x86_64 = `${rel}`;
    if (/\b(arm64|aarch64)\b/.test(text) && !archHits.arm64) archHits.arm64 = `${rel}`;
  }
}

const os_compat = families.size
  ? [...families].flatMap((f) => FAMILY_OS[f] ?? []).filter((v, i, a) => a.indexOf(v) === i)
  : BASELINE;

// arch: solo se acota si hay señal de UNA arquitectura y no de la otra
const arch = archHits.x86_64 && !archHits.arm64 ? ["x86_64"]
  : archHits.arm64 && !archHits.x86_64 ? ["arm64"]
  : ["x86_64", "arm64"];

const verdict = {
  os_compat,
  arch,
  baselineUsed: families.size === 0,
  families: [...families],
  evidence,
  archEvidence: archHits,
  runtime_deps_hints: [...runtimeHints.entries()].map(([cmd, loc]) => ({ cmd, firstUse: loc })),
};

console.log(JSON.stringify(verdict, null, 2));
process.exit(0);
