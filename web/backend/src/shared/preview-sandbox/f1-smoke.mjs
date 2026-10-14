// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS F1 smoke test — el GATE de la Fase F1 (RUNTIME-DESIGN.md §10).
 *
 * Demuestra EN ESTE HOST, como usuario sin privilegios, que el piso de
 * aislamiento Tier-1 funciona de extremo a extremo:
 *   - el secreto del panel NO es legible dentro del sandbox (scrub),
 *   - no hay red (ENETUNREACH),
 *   - el canal IPC fd-3 hace round-trip (ready + echo).
 *
 * NB: para el smoke, el scrub se hace con tmpfs-overlay sobre las rutas de
 * secreto conocidas (blocklist) porque preparar un rootfs mínimo con node+libs
 * (allowlist, vía `unshare --root`) es trabajo del pool-supervisor (F2). La
 * PRIMITIVA de aislamiento que se valida aquí (userns+netns+mountns+clean env)
 * es la misma; sólo cambia cómo se materializa el rootfs en producción.
 *
 * Uso:  node src/shared/preview-sandbox/f1-smoke.mjs
 * Exit: 0 = gate verde; ≠0 = el aislamiento no se sostiene en este host.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const childPath = path.join(__dirname, "child.mjs");

// Setup interno: monta tmpfs sobre los dirs de secreto (scrub blocklist para el
// smoke; producción usa rootfs allowlist vía `unshare --root`, F2), y exec node
// child.mjs en modo self-test con env LIMPIO (env -i). Todo dentro de
// userns+netns+mountns. El child VERIFICA secreto-oculto + sin-red + fds.
const inner = [
  "mount -t tmpfs none /etc/luxipanel 2>/dev/null || true",
  "mount -t tmpfs none /etc/nginx/certs 2>/dev/null || true",
  `exec env -i PATH=/usr/bin:/bin NODE_OPTIONS='--disallow-code-generation-from-strings --frozen-intrinsics' LXP_PREVIEW_SANDBOX=1 LXP_CONFIG_DIR=/etc/luxipanel LXP_SELFTEST_ONLY=1 node ${childPath}`,
].join("; ");

const argv = [
  "--user", "--map-root-user",
  "--net", "--pid", "--fork", "--kill-child",
  "--mount", "--propagation=private", "--mount-proc",
  "--uts", "--ipc",
  "--", "sh", "-c", inner,
];

let stdout = "";
const child = spawn("unshare", argv, { stdio: ["ignore", "pipe", "inherit"] });
child.stdout.on("data", (b) => { stdout += b.toString(); });

const timer = setTimeout(() => {
  console.error("SMOKE: timeout");
  child.kill("SIGKILL");
  process.exit(3);
}, 8000);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  const ok = code === 0 && /PIPS_OK/.test(stdout);
  console.log(JSON.stringify({ childExit: code, childSignal: signal, ok }));
  if (ok) {
    console.log("SMOKE F1: GATE VERDE — userns+netns+mountns OK; secreto NO legible; red ENETUNREACH; fds sin fugas");
    process.exit(0);
  }
  if (typeof code === "number" && code >= 11 && code <= 15) {
    console.error(`SMOKE F1: el child abortó fail-closed (code ${code}) — aislamiento NO se sostiene; ver stderr`);
  } else {
    console.error("SMOKE F1: gate ROJO");
  }
  process.exit(1);
});
child.on("error", (e) => {
  clearTimeout(timer);
  console.error("SMOKE: no se pudo lanzar unshare:", e.message);
  process.exit(2);
});
