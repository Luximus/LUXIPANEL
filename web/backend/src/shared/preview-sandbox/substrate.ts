// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — sustrato de aislamiento (Fase F1).
 *
 * Construye el comando que lanza un worker confinado y PROBA qué tier puede
 * sostener el host. Decisiones ancladas en verificación empírica sobre el host
 * de despliegue (ver RUNTIME-DESIGN.md §3.1, §4):
 *
 *   - `pivot_root(8)` NO está instalado como binario y Node puro NO puede
 *     invocar `chroot(2)`/`mount(2)` (no hay addon nativo; está prohibido).
 *     Por eso el confinamiento de FS lo hace el LANZADOR con
 *     `unshare --root=<scrubRoot>` (util-linux ≥2.38), no el child.
 *   - El child (`child.mjs`) NO realiza el scrub: lo VERIFICA (fail-closed si
 *     el secreto es legible, si hay red, si el environ no es mínimo o si hay
 *     fds extra). El SO es la frontera; el child sólo se niega a continuar si
 *     la frontera no está.
 *   - netns vacío ⇒ loopback DOWN ⇒ todo connect da ENETUNREACH (verificado),
 *     que es la señal que el self-test exige (NUNCA ECONNREFUSED).
 *
 * F1 expone `probeSubstrate()` + `buildTier1Command()`. NO spawnea nada en
 * import; el pool-supervisor (F2) usará esto. Tier 2 (systemd-run --user) se
 * añade en F4; aquí sólo se detecta su posible disponibilidad.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { panelConfigDir } from "../../config/paths.js";

export type Tier = 0 | 1 | 2;

export interface SubstrateProbe {
  /** Máximo tier que el host puede sostener (0 = ninguno → fail-closed). */
  tier: Tier;
  /** ¿Hay al menos el piso confinante (Tier 1)? */
  confining: boolean;
  reason: string;
  detail: {
    unshare: boolean;
    unshareSupportsRoot: boolean;
    setpriv: boolean;
    userns: boolean;
    maxUserNamespaces: number;
    systemdRun: boolean;
  };
}

function hasBin(name: string): boolean {
  const dirs = (process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin").split(":");
  return dirs.some((d) => d && existsSync(`${d}/${name}`));
}

function readIntFile(path: string): number | null {
  try {
    const n = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Detecta el tier sostenible SIN spawnear (probe estructural). El self-test
 * POSITIVO que realmente habilita el runtime (canary de secreto, red, realm)
 * vive en `selftest.ts` (F2) y corre un worker real. Aquí sólo verificamos que
 * las primitivas existan; si faltan ⇒ Tier 0 ⇒ `isAvailable()` jamás true.
 */
export function probeSubstrate(): SubstrateProbe {
  const unshare = hasBin("unshare");
  const setpriv = hasBin("setpriv");
  const systemdRun = hasBin("systemd-run");

  // userns sin privilegios: `max_user_namespaces>0`. En Debian moderno el
  // sysctl `unprivileged_userns_clone` puede no existir (default permitido);
  // tratamos su ausencia como "no bloquea", y `max_user_namespaces` como gate.
  const maxUserNs = readIntFile("/proc/sys/user/max_user_namespaces") ?? 0;
  const unprivClone = readIntFile("/proc/sys/kernel/unprivileged_userns_clone");
  const userns = maxUserNs > 0 && unprivClone !== 0;

  // `unshare --root` (chroot integrado) requiere util-linux ≥ 2.38. Lo probamos
  // de forma barata: presencia del binario + el flag en --help no es fiable sin
  // spawnear; usamos la presencia como necesaria y dejamos la confirmación
  // definitiva al self-test (F2), que SÍ lanza un worker.
  const unshareSupportsRoot = unshare; // confirmación real → selftest

  const detail = {
    unshare,
    unshareSupportsRoot,
    setpriv,
    userns,
    maxUserNamespaces: maxUserNs,
    systemdRun,
  };

  if (!unshare || !setpriv) {
    return { tier: 0, confining: false, reason: "unshare/setpriv ausentes", detail };
  }
  if (!userns) {
    return {
      tier: 0,
      confining: false,
      reason: `user namespaces no disponibles (max_user_namespaces=${maxUserNs}, unprivileged_userns_clone=${unprivClone ?? "n/a"})`,
      detail,
    };
  }
  // Tier 2 (systemd-run --user) se valida de verdad en F4; aquí sólo se reporta
  // su posible presencia. El piso aceptado en F1 es Tier 1.
  return {
    tier: 1,
    confining: true,
    reason: systemdRun ? "Tier 1 (unshare); Tier 2 systemd-run posible (validar en F4)" : "Tier 1 (unshare)",
    detail,
  };
}

export interface Tier1Spec {
  /** Rootfs scrub YA preparado por el supervisor: contiene node + child + el
   *  dir del módulo (ro) y NADA del host (sin /etc/luxipanel, etc.). */
  scrubRoot: string;
  /** Ruta del binario node DENTRO de scrubRoot (p.ej. "/node"). */
  nodePathInRoot: string;
  /** Ruta de child.mjs DENTRO de scrubRoot (p.ej. "/child.mjs"). */
  childPathInRoot: string;
}

export interface SpawnPlan {
  file: string;
  argv: string[];
  /** Entorno EXACTO del child: mínimo, sin secretos del panel. El caller debe
   *  pasar esto como `env` a spawn (NO heredar process.env). */
  env: Record<string, string>;
}

/**
 * Construye el plan de spawn Tier-1. NO ejecuta. El confinamiento:
 *   setpriv --no-new-privs --bounding-set=-all   (sin caps nuevas ni bounding)
 *     -- unshare
 *          --user --map-root-user                      (userns; map 1->0 sin
 *                                                       privilegios reales fuera;
 *                                                       implica --setgroups=deny)
 *          --net                                       (netns vacío ⇒ ENETUNREACH)
 *          --pid --fork --kill-child                   (pidns; muere con el padre)
 *          --mount --propagation=private --mount-proc  (mountns aislado + /proc)
 *          --uts --ipc                                 (uts/ipc ns)
 *          --root=<scrubRoot>                          (chroot integrado, sin pivot_root)
 *          -- <node> <child.mjs>
 *
 * Por qué `--map-root-user` (no un uid dedicado tipo nobody): sin privilegios,
 * mapear a un uid arbitrario exige `/etc/subuid`+`newuidmap` (provisión de F4).
 * El piso F1 mapea 1→0 EN EL USERNS: es root sólo dentro del ns (sin privilegio
 * real en el host) y queda confinado igual. F4 puede endurecer a un uid sin
 * mapear vía subuid como defensa en profundidad.
 *
 * `env` se fija a un set mínimo; el child además VERIFICA (defensa en
 * profundidad) que no haya fugas.
 */
export function buildTier1Command(spec: Tier1Spec): SpawnPlan {
  const argv = [
    "--no-new-privs",
    "--inh-caps=-all",
    "--bounding-set=-all",
    "--",
    "unshare",
    "--user",
    "--map-root-user",
    "--net",
    "--pid",
    "--fork",
    "--kill-child",
    "--mount",
    "--propagation=private",
    "--mount-proc",
    "--uts",
    "--ipc",
    `--root=${spec.scrubRoot}`,
    "--",
    spec.nodePathInRoot,
    spec.childPathInRoot,
  ];
  return {
    file: "setpriv",
    argv,
    env: {
      // Mínimo absoluto. Sin PANEL_*, sin LUXIPANEL_KEY, sin TLS, sin nada del
      // host. El child re-verifica que el environ sea subconjunto de esto.
      // LXP_CONFIG_DIR NO es secreto: el child lo necesita para PROBAR (canary)
      // que ese dir fue scrubbed; el caller lo inyecta con env.LUXIPANEL_CONFIG_DIR.
      PATH: "/usr/bin:/bin",
      NODE_OPTIONS: "--disallow-code-generation-from-strings --frozen-intrinsics",
      LXP_PREVIEW_SANDBOX: "1",
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Tier 2 (F4) — systemd-run --user transient unit reinforcement
// ──────────────────────────────────────────────────────────────────────────
//
// Tier 2 wraps the EXACT same Tier-1 inner command (`setpriv … unshare …`) as
// the `ExecStart` of a transient `systemd-run --user --service-type=exec
// --collect` unit (RUNTIME-DESIGN §3.2, §4.2). The unit adds an INDEPENDENT
// cgroup limit + seccomp/InaccessiblePaths belt — STRICTLY ADDITIVE: the
// network cut and FS scrub still come from `--net` + the integrated chroot,
// never from a systemd property (§3.1.2: PrivateNetwork was probed to silently
// no-op under the unprivileged user manager).
//
// Hard rules baked here:
//   - `DynamicUser` is DROPPED (fails on the user bus, and `--map-root-user`
//     already maps to a non-host-root uid).
//   - Blocked syscalls return EPERM (`SystemCallErrorNumber=EPERM`), NOT SIGSYS:
//     a graceful JS error, not a crash that masquerades as a sandbox bug.
//   - Tier 2 is accepted ONLY if `probeTier2()` positively proves the user bus
//     is reachable AND a probe unit's `PrivateNetwork` yields ENETUNREACH; a
//     silent no-op (ECONNREFUSED) ⇒ REJECT, never trust (§4.2, matrix row 5).

export interface Tier2Spec extends Tier1Spec {
  /** Nombre de la unidad transitoria (p.ej. `pips-w1-<rand>`). El supervisor
   *  garantiza unicidad; debe empezar por el prefijo PIPS para el reap. */
  unitName: string;
  /** Propiedades extra de la unidad (sobre el set base §3.2), si las hay. */
  props?: Record<string, string>;
}

/** Prefijo de unidad/cgroup que identifica un worker PIPS (para el reap). */
export const PIPS_UNIT_PREFIX = "pips-";

/**
 * Conjunto de propiedades systemd del §3.2 — ENDURECIMIENTO ADITIVO.
 *
 * Devuelto como pares `["-p", "<Key=Value>"]` listos para `systemd-run`. NUNCA
 * incluye `PrivateNetwork` (probado como no-op silencioso) ni `DynamicUser`
 * (rompe el bus de usuario). El corte de red y el scrub de FS son del comando
 * interno `--net`/`--root`, no de estas props.
 */
export function tier2PropertySet(spec: Tier2Spec): string[] {
  const props: Record<string, string> = {
    MemoryMax: "128M",
    MemoryHigh: "112M",
    MemorySwapMax: "0",
    TasksMax: "32",
    CPUQuota: "50%",
    NoNewPrivileges: "yes",
    // Cap bounding set vacío: el child no puede readquirir capacidades.
    CapabilityBoundingSet: "",
    AmbientCapabilities: "",
    // Sólo AF_UNIX (la IPC fd3); el netns ya es vacío de todas formas.
    RestrictAddressFamilies: "AF_UNIX",
    RestrictNamespaces: "yes",
    RestrictSUIDSGID: "yes",
    LockPersonality: "yes",
    SystemCallArchitectures: "native",
    // Seccomp ADITIVO (única seccomp real; Tier 1 no tiene BPF — §4.6, R2).
    SystemCallFilter: "@system-service",
    // EPERM, NO SIGSYS: error JS recuperable, no crash que parezca bug de sandbox.
    SystemCallErrorNumber: "EPERM",
    // Belt-and-suspenders sobre el scrub estructural del mountns.
    InaccessiblePaths: `${panelConfigDir()}:/etc/nginx/certs`,
    ProtectProc: "invisible",
    ProcSubset: "pid",
    ...(spec.props ?? {}),
  };
  const out: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    out.push("-p", `${k}=${v}`);
  }
  // El segundo SystemCallFilter (denylist) NO cabe en un objeto (clave repetida):
  // se añade como prop independiente. Lista negra de familias peligrosas (§3.2).
  out.push(
    "-p",
    "SystemCallFilter=~@privileged ~@resources ~@mount ~@swap ~@reboot ~@module ~@obsolete ~@clock ~@cpu-emulation ~@debug ~@raw-io ~@pkey",
  );
  return out;
}

/**
 * Construye el plan de spawn Tier-2. NO ejecuta.
 *
 *   systemd-run --user --service-type=exec --collect --unit=<name> -p <props…>
 *     -- setpriv --no-new-privs … unshare … --root=<scrub> -- <node> <child.mjs>
 *
 * El argv interno (`setpriv … unshare … node child.mjs`) es EXACTAMENTE el de
 * `buildTier1Command(spec)` — el endurecimiento systemd es aditivo, no reemplaza
 * el confinamiento kernel-enforced. `env` se hereda del Tier-1 (mínimo, sin
 * secretos); systemd-run lo propaga a `ExecStart` vía `--setenv` para no
 * arrastrar el environ del manager.
 */
export function buildTier2Command(spec: Tier2Spec): SpawnPlan {
  const inner = buildTier1Command(spec);
  const argv: string[] = [
    "--user",
    "--service-type=exec",
    "--collect",
    `--unit=${spec.unitName}`,
    ...tier2PropertySet(spec),
  ];
  // Propaga SÓLO el environ mínimo del Tier-1 a la unidad (sin heredar el del
  // user-manager, que podría arrastrar secretos del operador).
  for (const [k, v] of Object.entries(inner.env)) {
    argv.push("--setenv", `${k}=${v}`);
  }
  argv.push("--", inner.file, ...inner.argv);
  return {
    file: "systemd-run",
    argv,
    // El environ del PROCESO systemd-run (no del child): el child recibe el suyo
    // vía --setenv. Aun así lo dejamos mínimo para no filtrar nada al manager.
    env: { ...inner.env },
  };
}

export interface Tier2Probe {
  /** ¿El bus de usuario es alcanzable (XDG_RUNTIME_DIR + DBUS + systemd-run)? */
  reachable: boolean;
  /** ¿Una unidad de prueba demostró confinar la red de verdad (ENETUNREACH)? */
  confining: boolean;
  reason: string;
}

/**
 * Verifica SI Tier 2 es utilizable Y CONFINANTE — nunca asume, nunca confía.
 *
 * Dos puertas (RUNTIME-DESIGN §3.1.2 / §4.2 / matrix row 5):
 *   1. `XDG_RUNTIME_DIR` + `DBUS_SESSION_BUS_ADDRESS` presentes (sin login-linger
 *      el user-manager no existe ⇒ `systemd-run --user` da "Failed to connect to
 *      user scope bus"). Si faltan ⇒ NO reachable ⇒ Tier 2 rechazado.
 *   2. Una unidad transitoria de prueba intenta `connect()` a una IP enrutable
 *      DENTRO de su netns; con `--net` (unshare) el resultado DEBE ser
 *      `ENETUNREACH`. Un `ECONNREFUSED`/éxito silencioso ⇒ el aislamiento NO se
 *      aplicó ⇒ Tier 2 RECHAZADO (no se degrada a un jail no confinante).
 *
 * NUNCA lanza: cualquier fallo ⇒ `{reachable:false}` ⇒ el caller cae a Tier 1.
 */
export function probeTier2(): Tier2Probe {
  try {
    const xdg = process.env.XDG_RUNTIME_DIR;
    const dbus = process.env.DBUS_SESSION_BUS_ADDRESS;
    if (!xdg || !dbus) {
      return {
        reachable: false,
        confining: false,
        reason: "user bus ausente (sin XDG_RUNTIME_DIR/DBUS_SESSION_BUS_ADDRESS; falta loginctl enable-linger)",
      };
    }
    if (!hasBin("systemd-run")) {
      return { reachable: false, confining: false, reason: "systemd-run ausente" };
    }
    // Confirma que el bus de usuario realmente acepta unidades (no sólo que el
    // binario exista). `--wait` bloquea hasta que la unidad termina; el comando
    // es trivial (`true`) y NO toca el host. Timeout corto: si cuelga ⇒ no usable.
    const ping = spawnSync(
      "systemd-run",
      ["--user", "--quiet", "--collect", "--wait", "--service-type=exec", "--", "true"],
      { timeout: 4000, stdio: "ignore" },
    );
    if (ping.error || ping.status !== 0) {
      return {
        reachable: false,
        confining: false,
        reason: `bus de usuario no acepta unidades (${ping.error?.message ?? `status=${String(ping.status)}`})`,
      };
    }
    // Prueba de confinamiento REAL: una unidad con `--net` (vía el wrapper unshare
    // que el supervisor usa en producción) debe dar ENETUNREACH al conectar. Como
    // aquí no montamos el scrubRoot completo, ejecutamos `unshare --net` directo y
    // observamos el código de error de un connect a una IP enrutable. ECONNREFUSED
    // o éxito ⇒ el netns NO se aplicó ⇒ NO confinante.
    const netProbe = spawnSync(
      "systemd-run",
      [
        "--user",
        "--quiet",
        "--collect",
        "--wait",
        "--service-type=exec",
        "-p",
        "PrivateNetwork=yes",
        "--",
        "unshare",
        "--user",
        "--map-root-user",
        "--net",
        "--",
        process.execPath,
        "-e",
        // connect a 1.1.1.1:443 dentro del netns vacío: ENETUNREACH ⇒ exit 0.
        // ECONNREFUSED o connect ⇒ exit 1 (no confinante).
        "const net=require('net');const s=net.connect(443,'1.1.1.1');" +
          "s.on('error',e=>process.exit(e.code==='ENETUNREACH'||e.code==='EAFNOSUPPORT'?0:1));" +
          "s.on('connect',()=>process.exit(1));" +
          "setTimeout(()=>process.exit(1),1500);",
      ],
      { timeout: 6000, stdio: "ignore" },
    );
    const confining = !netProbe.error && netProbe.status === 0;
    return {
      reachable: true,
      confining,
      reason: confining
        ? "Tier 2 confinante (bus de usuario + netns ENETUNREACH verificados)"
        : "Tier 2 RECHAZADO: PrivateNetwork no-op silencioso (no ENETUNREACH) ⇒ no se confía",
    };
  } catch (err) {
    return { reachable: false, confining: false, reason: `probeTier2 error: ${(err as Error).message}` };
  }
}

/**
 * Helper PDEATHSIG (RUNTIME-DESIGN §3.3): cada child inmediato debe morir si el
 * panel muere. `--kill-child` de unshare NO dispara cuando el PANEL es SIGKILLed
 * (unshare reparenta a PID1), así que reforzamos con `PR_SET_PDEATHSIG=SIGKILL`
 * en el child inmediato.
 *
 * Node no expone `prctl(2)` sin addon nativo (prohibido). Lo aplicamos vía
 * `setpriv --pdeathsig=SIGKILL` (util-linux ≥2.33), que ya es nuestro wrapper
 * externo. Esta función devuelve los flags que el caller DEBE inyectar al
 * principio del argv de `setpriv` (antes de `--no-new-privs`). El reap por
 * cgroup (`cgroup.kill`) + el re-scan en `init()` son las otras dos capas.
 */
export function pdeathsigSetprivFlags(): string[] {
  return ["--pdeathsig=SIGKILL"];
}

/**
 * Mata cualquier worker PIPS huérfano de una instancia previa del panel (crash
 * o reinicio) ANTES de calentar el pool (RUNTIME-DESIGN §3.3, §7.3, matrix req 7).
 *
 * Tres caminos, todos best-effort (NUNCA lanza):
 *   (a) `systemctl --user stop <unit>` de toda unidad transitoria PIPS reachable
 *       (sólo si el bus de usuario existe);
 *   (b) `cgroup.kill` del cgroup propiedad del panel donde viven los workers
 *       (si la delegación de cgroup está disponible);
 *   (c) un re-scan/SIGKILL de procesos `unshare` con la firma del child PIPS
 *       que hayan quedado reparentados a PID1.
 *
 * Idempotente: si no hay huérfanos, es un no-op silencioso. El supervisor (A1)
 * lo invoca en bootstrap; si el helper falla, el boot continúa (fail-open SÓLO
 * para el reap — no afecta la decisión fail-closed de availability).
 */
export async function reapOrphans(): Promise<void> {
  // (a) Unidades transitorias Tier-2 huérfanas en el user-manager.
  try {
    if (process.env.XDG_RUNTIME_DIR && process.env.DBUS_SESSION_BUS_ADDRESS && hasBin("systemctl")) {
      const list = spawnSync(
        "systemctl",
        ["--user", "list-units", "--all", "--no-legend", "--plain", `${PIPS_UNIT_PREFIX}*`],
        { timeout: 4000, encoding: "utf8" },
      );
      if (!list.error && list.status === 0 && typeof list.stdout === "string") {
        for (const line of list.stdout.split("\n")) {
          const unit = line.trim().split(/\s+/)[0];
          if (unit && unit.startsWith(PIPS_UNIT_PREFIX)) {
            spawnSync("systemctl", ["--user", "stop", unit], { timeout: 4000, stdio: "ignore" });
            // `--collect` debería recogerla, pero forzamos el reset por si quedó failed.
            spawnSync("systemctl", ["--user", "reset-failed", unit], { timeout: 4000, stdio: "ignore" });
          }
        }
      }
    }
  } catch {
    /* best-effort */
  }

  // (b) cgroup.kill del cgroup propiedad del panel (si está delegado). El path
  //     se deriva del cgroup actual del proceso + el sub-árbol PIPS.
  try {
    const selfCg = readFileSync("/proc/self/cgroup", "utf8");
    // cgroup v2: una sola línea `0::/<path>`.
    const m = /^0::(.+)$/m.exec(selfCg);
    if (m && m[1]) {
      const base = `/sys/fs/cgroup${m[1].trim()}`.replace(/\/+$/, "");
      const killPath = `${base}/pips/cgroup.kill`;
      if (existsSync(killPath)) {
        // Escribir "1" mata TODO el sub-árbol de una vez (cgroup v2).
        try {
          (await import("node:fs/promises")).writeFile(killPath, "1");
        } catch {
          /* delegación ausente o ya vacío */
        }
      }
    }
  } catch {
    /* cgroup v1 / no delegado ⇒ se cubre por (c) */
  }

  // (c) Re-scan: procesos `unshare` reparentados a PID1 con la firma PIPS. Sin
  //     /proc no hay scan posible; en ese caso confiamos en (a)/(b).
  try {
    const { readdirSync } = await import("node:fs");
    const { kill } = process;
    let pids: string[];
    try {
      pids = readdirSync("/proc").filter((p) => /^\d+$/.test(p));
    } catch {
      return;
    }
    for (const pid of pids) {
      try {
        const cmdline = readFileSync(`/proc/${pid}/cmdline`, "utf8");
        // Firma: nuestro wrapper unshare ejecutando el child PIPS. Buscamos el
        // marcador inequívoco LXP_PREVIEW_SANDBOX en el environ del proceso.
        if (!cmdline.includes("unshare") && !cmdline.includes("child.mjs")) continue;
        const environ = readFileSync(`/proc/${pid}/environ`, "utf8");
        const ppid = readFileSync(`/proc/${pid}/stat`, "utf8").split(" ")[3];
        // Sólo huérfanos (reparentados a PID1) con nuestra firma de sandbox.
        if (environ.includes("LXP_PREVIEW_SANDBOX=1") && ppid === "1") {
          try {
            kill(Number.parseInt(pid, 10), "SIGKILL");
          } catch {
            /* ya muerto / sin permiso */
          }
        }
      } catch {
        /* proceso ajeno o desaparecido ⇒ skip */
      }
    }
  } catch {
    /* best-effort */
  }
}
