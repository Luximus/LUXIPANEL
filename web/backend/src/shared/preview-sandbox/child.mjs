// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — shim del worker sandbox (Fases F1 + F3). Código de CONFIANZA del panel
 * (NO es el módulo del autor). Se ejecuta YA confinado por el lanzador
 * (`setpriv … unshare --root=<scrubRoot> --net … -- node child.mjs`).
 *
 * Responsabilidad:
 *   1. F1 — VERIFICAR la frontera (fail-closed): el secreto no es legible, no
 *      hay red (ENETUNREACH), el environ es mínimo, y no hay fds heredados a
 *      rutas sensibles. Cualquier fallo ⇒ exit(≠0) ANTES de hacer nada más. El
 *      SO es la frontera; este shim sólo se niega a continuar si no está.
 *   2. F1 — Anunciar `ready` por fd 3 (con el self-hash de SHA-pin, ver abajo) y
 *      hacer eco de las tramas (prueba del canal IPC para el smoke).
 *   3. F3 — Al recibir un frame `{type:"dispatch"}` por fd 3: evaluar los BYTES
 *      DE FUENTE del módulo (FROZEN, vienen EN el frame — NUNCA se re-leen de
 *      disco) dentro de un realm `node:vm` con los globals scrubeados
 *      (process/require/module/fetch/Function ausentes). Construir un `ctx.*`
 *      que sólo emite `capCall` por fd 3 y BLOQUEA en `capResult`: SIN Executor,
 *      SIN secretos, SIN red en este espacio de direcciones. Toda autorización
 *      es panel-side (broker.ts). Devolver `{type:"result"}` (≤MAX_OUTPUT) o
 *      `{type:"error"}` sanitizado (sin stack).
 *
 * ── SHA-PIN (self-hash, RUNTIME-DESIGN §7.1 paso 1 / matriz fila 6) ───────────
 * NO hay codegen en build de la SHA: child.mjs se despacha tal cual (el build NO
 * lo transforma). En su lugar, ESTE shim hashea SUS PROPIOS bytes en runtime
 * (`sha256(readFileSync(__filename))`, donde __filename es argv[1], la MISMA ruta
 * que `buildTier1Command` lanza) y la publica en `ready.hostHash`. El panel
 * (selftest.ts) computa `sha256` del mismo child.mjs en disco y compara: una
 * copia tampereada/parcial ⇒ mismatch ⇒ `isAvailable()=false`. Es defensa en
 * profundidad: el rootfs scrub ya hace RO el bind, pero el self-hash detecta una
 * sustitución del propio shim antes de confiar en su `ready`.
 *
 * El framing está inlineado (no puede importar el protocol.ts compilado): debe
 * coincidir byte a byte con `protocol.ts` (uint32 BE length + JSON UTF-8, v:1).
 * Si divergen, el self-test (round-trip) lo detecta.
 */
import net from "node:net";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  readdirSync, accessSync, statSync, readlinkSync, readFileSync,
  writeFileSync, unlinkSync, existsSync, constants as fsc,
} from "node:fs";

const EXIT = { SECRET: 11, NETWORK: 12, ENVIRON: 13, FDS: 14, BOOT: 15 };

function die(code, msg) {
  try {
    process.stderr.write(`[pips-child] FAIL ${code}: ${msg}\n`);
  } catch {
    /* ignore */
  }
  process.exit(code);
  // Belt-and-suspenders: si `process.exit` fuera no-terminal (shim/frozen),
  // lanzar garantiza que NINGÚN check caiga-through hacia el dispatch loop.
  throw new Error(`unreachable after die(${code})`);
}

// ── 1. Verificación de frontera (fail-closed, prueba POSITIVA del scrub) ──────

// El dir de config (con shared-secrets.json, cache creds, ssh key) es
// CONFIGURABLE; el panel lo pasa por env (NO es secreto). Sin él, fail-closed:
// no podemos probar la ausencia estructural del dir real.
const CFG_DIR = process.env.LXP_CONFIG_DIR;
if (!CFG_DIR || !CFG_DIR.startsWith("/")) {
  die(EXIT.SECRET, "LXP_CONFIG_DIR ausente/!absoluto: no se puede probar el scrub");
}

// 1a. Prueba ESTRUCTURAL del scrub. Soporta los dos estilos:
//     - allowlist (`unshare --root`): el dir de config NO existe (ENOENT);
//     - overlay tmpfs: el dir existe pero está VACÍO.
//     Ambos prueban que ningún secreto del config dir es alcanzable. Cualquier
//     otra cosa (dir poblado, EACCES, ENOTDIR) ⇒ fail-closed (revisión C1/C2).
function assertFileAbsent(p, label) {
  try {
    accessSync(p, fsc.F_OK);
    die(EXIT.SECRET, `${label} presente dentro del sandbox: ${p}`);
  } catch (e) {
    if (!e || e.code !== "ENOENT") {
      die(EXIT.SECRET, `${label} no probó ausencia estructural (${e?.code}) en ${p}`);
    }
  }
}
function assertDirScrubbed(dir) {
  let st;
  try {
    st = statSync(dir);
  } catch (e) {
    if (e && e.code === "ENOENT") return; // allowlist: dir ausente ⇒ ok
    die(EXIT.SECRET, `config dir no probó ausencia estructural (${e?.code}): ${dir}`);
    return;
  }
  if (!st.isDirectory()) die(EXIT.SECRET, `config dir scrub: ${dir} no es directorio`);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (e) {
    die(EXIT.SECRET, `config dir scrub: no se pudo listar ${dir} (${e?.code})`);
    return;
  }
  if (entries.length > 0) {
    die(EXIT.SECRET, `config dir scrub: ${dir} existe y NO está vacío (${entries.length} entradas)`);
  }
}
assertDirScrubbed(CFG_DIR);
const SECRET_CANARIES = [
  `${CFG_DIR}/shared-secrets.json`,
  `${CFG_DIR}/ssh/server_key`,
  `${CFG_DIR}/.pips-canary`, // canario estructural del self-test (§7.1 paso 3)
  "/etc/nginx/certs/mtls/luxipanel-client.key",
  "/etc/nginx/certs/mtls/ca.key",
  "/etc/nginx/certs/mtls/luxipanel-client.crt",
];
for (const p of SECRET_CANARIES) assertFileAbsent(p, "ruta de secreto");

// 1b. Environ mínimo: subconjunto del set que fija el lanzador. Cualquier var
//     del panel (PANEL_*, LUXIPANEL*, *_KEY, *_PEM, REDIS*, etc.) ⇒ fuga.
const ALLOWED_ENV = new Set([
  "PATH", "NODE_OPTIONS", "LXP_PREVIEW_SANDBOX", "LXP_CONFIG_DIR",
  "LXP_SELFTEST_ONLY", "LXP_MAX_FRAME", "PWD", "_",
]);
for (const k of Object.keys(process.env)) {
  if (!ALLOWED_ENV.has(k)) die(EXIT.ENVIRON, `variable de entorno inesperada heredada: ${k}`);
}

// 1c. Tabla de fds: Node abre fds internos legítimos (epoll, eventfd, pipes,
//     sockets anónimos) en 4+, así que NO sirve contar. Lo que importa es que
//     ningún fd HEREDADO apunte a una ruta sensible del host (un fd abierto al
//     secreto burlaría el scrub de rutas de §1a). Toleramos anon_inode:/pipe:/
//     socket:/dev/null/proc-fd; rechazamos cualquier fd resuelto a una ruta de
//     secreto.
const SENSITIVE_PREFIXES = [
  CFG_DIR, "/etc/nginx", "/etc/ssl", "/root", "/home",
  "/var/www", // .env con LUXIPANEL_KEY/PEM base64 vive aquí
];
try {
  for (const n of readdirSync("/proc/self/fd")) {
    let target;
    try { target = readlinkSync(`/proc/self/fd/${n}`); } catch { continue; }
    if (!target.startsWith("/")) continue; // anon_inode:/pipe:/socket: ⇒ ok
    const real = target.replace(/ \(deleted\)$/, ""); // fd a secreto borrado igual lee
    if (SECRET_CANARIES.includes(real) || SENSITIVE_PREFIXES.some((p) => real === p || real.startsWith(p + "/"))) {
      die(EXIT.FDS, `fd ${n} heredado apunta a ruta sensible: ${target}`);
    }
  }
} catch {
  // Sin /proc no podemos auto-verificar ⇒ fail-closed.
  die(EXIT.FDS, "no se pudo enumerar /proc/self/fd (¿/proc no montado?)");
}

// 1d. Red: prueba ESTRUCTURAL (independiente del errno) + connect.
//     (i) `/proc/net/route` debe tener SOLO la cabecera (sin rutas) ⇒ netns
//         vacío. Es la prueba fuerte (revisión H1); no depende de qué errno
//         devuelva un connect concreto.
//     (ii) connect a loopback debe dar ENETUNREACH/EHOSTUNREACH (loopback DOWN).
//         ECONNREFUSED ⇒ hay loopback up (red) ⇒ fail. EAFNOSUPPORT/EADDRNOTAVAIL
//         NO se aceptan como prueba (pueden significar AF bloqueado, no netns
//         aislado).
function assertEmptyRouteTable() {
  let txt;
  try {
    txt = readFileSync("/proc/net/route", "utf8");
  } catch (e) {
    die(EXIT.NETWORK, `no se pudo leer /proc/net/route (${e?.code})`);
    return;
  }
  const rows = txt.split("\n").map((l) => l.trim()).filter(Boolean);
  // rows[0] = cabecera "Iface Destination ...". Cualquier fila extra = ruta.
  if (rows.length > 1) die(EXIT.NETWORK, `tabla de rutas NO vacía (${rows.length - 1} rutas): netns no aislado`);
}

function assertNoNetwork() {
  assertEmptyRouteTable();
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port: 9 });
    let settled = false;
    const done = (fn) => {
      if (settled) return;
      settled = true;
      try { s.destroy(); } catch { /* ignore */ }
      fn();
    };
    s.setTimeout(800);
    s.on("connect", () => done(() => die(EXIT.NETWORK, "connect TCP exitoso: hay red en el sandbox")));
    s.on("timeout", () => done(() => die(EXIT.NETWORK, "connect colgó (timeout): netns no aislado como se espera")));
    s.on("error", (e) => done(() => {
      if (e.code === "ENETUNREACH" || e.code === "EHOSTUNREACH") {
        resolve(); // señal correcta de netns vacío (loopback DOWN)
      } else {
        die(EXIT.NETWORK, `connect dio ${e.code} (se esperaba ENETUNREACH; el route-table check es la prueba fuerte)`);
      }
    }));
  });
}

// ── 2. Framing IPC por fd 3 (compatible byte-a-byte con protocol.ts) ─────────

const LEN = 4;
const MAX_FRAME = Number.parseInt(process.env.LXP_MAX_FRAME ?? "1048576", 10);
// Tope de salida del `result.output` (256 KiB por defecto, §5). El panel también
// lo re-valida; aquí lo aplicamos para no emitir una trama que el panel matará.
const MAX_OUTPUT = 262144;
// Topes del canal de capabilities (§5): un dispatch hostil no puede agotar el
// canal con capCalls ni con un solo capCall pendiente sin resolver.
const MAX_CAPS_PER_DISPATCH = 64;

function encode(msg) {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  const head = Buffer.allocUnsafe(LEN);
  head.writeUInt32BE(body.length, 0);
  return Buffer.concat([head, body]);
}

// ── 3. Self-hash para el SHA-pin (§7.1 paso 1) ───────────────────────────────
// Hashea los PROPIOS bytes del shim (argv[1] = la misma ruta que el lanzador
// invoca). El panel compara contra su sha256 del mismo fichero en disco.
function selfHash() {
  try {
    const self = fileURLToPath(import.meta.url);
    const bytes = readFileSync(self);
    return createHash("sha256").update(bytes).digest("hex");
  } catch {
    // Sin poder leer nuestros propios bytes no podemos probar integridad ⇒
    // fail-closed: el panel verá hostHash="" y rechazará (mismatch).
    return "";
  }
}

const READY = Object.freeze({
  v: 1,
  type: "ready",
  id: 0,
  node: process.version,
  abi: process.versions.modules,
  v8: process.versions.v8,
  hostHash: selfHash(),
});

// ── 4. Realm `node:vm` con globals scrubeados + shims ctx.* ──────────────────
//
// El código del autor corre en un contexto vm AISLADO (no en el scope global de
// este shim). Aun así eliminamos del realm cualquier puente a efectos: ni
// `process`/`require`/`module` (acceso a fs/red/env) ni `fetch`/`Function`/eval
// (NODE_OPTIONS ya pone --disallow-code-generation-from-strings, esto es defensa
// en profundidad y lo que el self-test paso 2 verifica). El ÚNICO puente es
// `ctx`, cuyos métodos marshalan JSON por fd 3.

function buildModuleRealm(ctx) {
  // Sandbox = el `globalThis` del realm. Sólo primitivas seguras + el `ctx`
  // mediado. Nada de process/require/module/fetch/Function global.
  const sandbox = {
    console: {
      log: (...a) => ctx.log("info", a.map(String).join(" ")),
      info: (...a) => ctx.log("info", a.map(String).join(" ")),
      warn: (...a) => ctx.log("warn", a.map(String).join(" ")),
      error: (...a) => ctx.log("error", a.map(String).join(" ")),
      debug: (...a) => ctx.log("debug", a.map(String).join(" ")),
    },
    // Temporizadores acotados: el deadline agregado del panel mata el worker;
    // estos sólo evitan ReferenceError en código benigno. No exponen efectos.
    setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask,
    // Constructores de datos puros que el código del módulo espera.
    Object, Array, String, Number, Boolean, Symbol, BigInt, Math, Date, JSON,
    RegExp, Map, Set, WeakMap, WeakSet, Promise, Error, TypeError, RangeError,
    Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView, TextEncoder, TextDecoder,
    structuredClone, URL, URLSearchParams,
    ctx,
    module: undefined,
    exports: undefined,
  };
  const context = vm.createContext(sandbox, {
    name: "pips-preview-realm",
    codeGeneration: { strings: false, wasm: false },
  });
  // Scrub explícito DENTRO del realm: aunque vm no inyecta process/require, un
  // global heredado por accidente quedaría aquí undefined. El self-test paso 2
  // lee estos `typeof` DESDE el realm para certificar el scrub.
  vm.runInContext(
    "void 0; typeof process; typeof require; typeof module; typeof globalThis.fetch;",
    context,
    { timeout: 1000 },
  );
  return context;
}

/**
 * Evalúa los bytes de fuente del autor en el realm y obtiene el `defineModule`
 * factory + el handler del tool pedido. El módulo expone
 * `export default defineModule((m)=>{ m.tool(...) })`; como el realm no tiene
 * sistema de módulos ESM, se evalúa como script CommonJS-like sin `require`:
 * `defineModule` se inyecta como global del realm y el resultado se recoge por
 * `globalThis.__lxpModule`.
 */
function evalModule(context, entryBytes, tool) {
  // `defineModule` mínimo, equivalente al de module-sdk pero SIN efectos: sólo
  // recolecta tools en un builder. (No importamos module-sdk: este realm no
  // tiene require; replicamos su superficie de recolección.)
  const installer = `
    (function(){
      var __tools = Object.create(null);
      function defineModule(setup){
        var m = {
          tool: function(suffix, def){ __tools[suffix] = def; },
          dataPanel: function(){},
          suggest: function(){},
        };
        setup(m);
        return { __luxModule: true, __tools: __tools };
      }
      globalThis.defineModule = defineModule;
      globalThis.__lxpCollectTools = function(factory){
        if (!factory || factory.__luxModule !== true) {
          throw new Error("el export por defecto no es defineModule(...)");
        }
        return factory.__tools;
      };
    })();
  `;
  vm.runInContext(installer, context, { timeout: 1000 });

  // El módulo del autor: lo envolvemos para capturar su `export default`. Soporta
  // tanto `export default defineModule(...)` (ESM textual, reescrito) como
  // `module.exports = defineModule(...)`/`return defineModule(...)`. Para no
  // depender de un transpiler, normalizamos: ejecutamos el cuerpo dentro de una
  // función que provee `module`/`exports` locales (NO los globales scrubeados) y
  // reescribimos `export default X` → `module.exports = X`.
  const normalized = String(entryBytes)
    .replace(/^\s*export\s+default\s+/m, "module.exports = ")
    .replace(/^\s*import\s+.*$/gm, ""); // descartar imports (no hay loader; sólo defineModule global)
  const wrapped = `
    (function(){
      var module = { exports: undefined };
      var exports = module.exports;
      (function(module, exports){
        ${normalized}
      })(module, module.exports);
      return __lxpCollectTools(module.exports);
    })();
  `;
  const tools = vm.runInContext(wrapped, context, { timeout: 1000, displayErrors: false });
  const def = tools && tools[tool];
  if (!def || typeof def.handler !== "function") {
    throw new Error(`tool "${tool}" no existe en el módulo`);
  }
  return def;
}

// ── 5. Dispatch runtime sobre fd 3 ──────────────────────────────────────────

function startWorker() {
  let sock;
  try {
    sock = new net.Socket({ fd: 3, readable: true, writable: true });
  } catch (e) {
    die(EXIT.BOOT, `no se pudo abrir el fd 3 (IPC): ${e?.message ?? e}`);
    return;
  }

  // Estado del dispatch en vuelo (single-flight: el panel garantiza un dispatch
  // por worker). `pendingCap` es el callId con un capCall pendiente de capResult.
  let dispatchId = 0; // id del dispatch en curso (0 = ninguno)
  let nextCallId = 1;
  let capCount = 0;
  let pending = null; // { callId, resolve } del capCall en vuelo

  const send = (msg) => {
    try { sock.write(encode(msg)); } catch { /* canal cerrado */ }
  };

  // Emite un capCall por fd 3 y devuelve una promesa que se resuelve con el
  // capResult correspondiente. UNO pendiente a la vez (§5). El broker (panel)
  // es quien autoriza; aquí sólo marshalamos.
  const capCall = (cap, method, args) => {
    if (pending) {
      // Violación del invariante single-outstanding: código del autor no puede
      // emitir dos capCalls concurrentes (las APIs de ctx.* son await-secuencia).
      return Promise.reject(new Error("capCall concurrente no permitido"));
    }
    if (++capCount > MAX_CAPS_PER_DISPATCH) {
      return Promise.reject(new Error("límite de capCalls por dispatch excedido"));
    }
    const callId = nextCallId++;
    return new Promise((resolve, reject) => {
      pending = {
        callId,
        settle: (res) => {
          pending = null;
          if (res.ok) resolve(res.value);
          else {
            const err = new Error(res.error || "capability denegada");
            if (res.code) err.code = res.code;
            reject(err);
          }
        },
      };
      send({ v: 1, type: "capCall", id: dispatchId, callId, cap, method, args });
    });
  };

  // `ctx` mediado: réplica de la superficie ModuleCtx de module-sdk, pero CADA
  // método sólo emite un capCall (NO hay Executor/kv/fetch en este proceso). El
  // gate real es panel-side (broker.ts, más estricto que buildCtx). El nombre
  // del cap/method debe coincidir con el whitelist del broker (§6.2 paso 3).
  const makeCtx = (frame) => ({
    runId: `pv_${frame.id}`,
    now: Date.now(),
    user: {}, // el linux user no se expone al realm (se resuelve panel-side)
    target: { id: frame.moduleId, name: frame.moduleId },
    log: (level, msg) => send({ v: 1, type: "log", id: frame.id, level: String(level), msg: String(msg).slice(0, 2048) }),
    server: {
      exec: (cmd, opts) => capCall("server.exec", "exec", { cmd, opts: opts ?? null }),
      readFile: (path, encoding) => capCall("server.fs.read", "readFile", { path, encoding: encoding ?? null }),
      readdir: (path) => capCall("server.fs.read", "readdir", { path }),
      stat: (path) => capCall("server.fs.read", "stat", { path }),
      writeFile: (path, data) => capCall("server.fs.write", "writeFile", { path, data: encodeData(data) }),
      mkdir: (path, opts) => capCall("server.fs.write", "mkdir", { path, opts: opts ?? null }),
      rename: (from, to) => capCall("server.fs.write", "rename", { from, to }),
      unlink: (path) => capCall("server.fs.write", "unlink", { path }),
    },
    storage: {
      get: (key) => capCall("storage", "get", { key }),
      set: (key, value) => capCall("storage", "set", { key, value }),
      list: (prefix) => capCall("storage", "list", { prefix: prefix ?? null }),
      delete: (key) => capCall("storage", "delete", { key }),
    },
    http: {
      fetch: async (url, init) => {
        // El fetch real corre en el panel (el child no tiene ruta). Devolvemos
        // un objeto Response-like de SÓLO datos (status/headers/body); no es un
        // Response WHATWG (no hay red aquí).
        const res = await capCall("http", "fetch", { url: String(url), init: sanitizeInit(init) });
        return res;
      },
    },
    events: {
      emit: (event, payload) => {
        // events.emit no es un efecto sobre el tenant: lo registramos como log
        // (el panel no expone un bus a previews). No emite capCall.
        send({ v: 1, type: "log", id: frame.id, level: "event", msg: JSON.stringify({ event, payload }).slice(0, 2048) });
      },
    },
  });

  // Serializa data de writeFile a JSON-safe ({$b64} para binarios), igual que el
  // contrato wire (§5). El panel re-hidrata. No usamos Buffer del realm.
  function encodeData(data) {
    if (typeof data === "string") return { kind: "utf8", value: data };
    if (data instanceof Uint8Array) {
      return { kind: "b64", value: Buffer.from(data).toString("base64") };
    }
    return { kind: "utf8", value: String(data) };
  }

  function sanitizeInit(init) {
    if (!init || typeof init !== "object") return null;
    const out = {};
    if (typeof init.method === "string") out.method = init.method;
    if (init.headers && typeof init.headers === "object") {
      const h = {};
      for (const [k, v] of Object.entries(init.headers)) h[String(k)] = String(v);
      out.headers = h;
    }
    if (typeof init.body === "string") out.body = init.body;
    return out;
  }

  // Termina el dispatch con un result (terminal). Aplica el tope de output.
  const finish = (frameId, ok, output) => {
    let serialized;
    try {
      serialized = JSON.stringify(output ?? null);
    } catch {
      send({ v: 1, type: "error", id: frameId, message: "output no serializable" });
      dispatchId = 0;
      return;
    }
    if (Buffer.byteLength(serialized, "utf8") > MAX_OUTPUT) {
      send({ v: 1, type: "error", id: frameId, message: "output excede el límite" });
      dispatchId = 0;
      return;
    }
    // Re-parse a dato plano (sin getters/prototipos del realm) antes de enviar.
    send({ v: 1, type: "result", id: frameId, ok: !!ok, output: JSON.parse(serialized) });
    dispatchId = 0;
  };

  const fail = (frameId, message) => {
    // Sanitizado: sin stack, sin rutas del host.
    send({ v: 1, type: "error", id: frameId, message: String(message).slice(0, 512) });
    dispatchId = 0;
  };

  // Acciona un dispatch real: evalúa la fuente FROZEN del frame en el realm y
  // corre el handler con el ctx mediado.
  const runDispatch = async (frame) => {
    const ctx = makeCtx(frame);
    try {
      const entryBytes = frame?.source?.entryBytes;
      if (typeof entryBytes !== "string") throw new Error("source.entryBytes ausente");
      const context = buildModuleRealm(ctx);
      const def = evalModule(context, entryBytes, frame.tool);
      // El handler corre en NUESTRO event loop pero su única vía de efecto es
      // `ctx` (capCall). El deadline agregado lo controla el panel (nos SIGKILL).
      const ret = await Promise.resolve(def.handler(frame.input, ctx));
      if (ret && typeof ret === "object" && "ok" in ret) {
        finish(frame.id, !!ret.ok, ret.output);
      } else {
        finish(frame.id, true, ret);
      }
    } catch (e) {
      fail(frame.id, e?.message ?? "error en el handler del preview");
    }
  };

  // ── Synthetic handlers para el self-test (§7.1 pasos 2/6/7) ───────────────
  // El panel los activa con `source.entryBytes` = uno de estos sentinelas. NO
  // son código del autor: prueban primitivas del propio shim a través del MISMO
  // camino de dispatch (realm + capCall) que producción.
  const SYNTH = {
    // Paso 2: reporta el scrub del realm leído DESDE el realm.
    "__pips_synthetic__:realm-scrub": async (frame) => {
      const context = buildModuleRealm(makeCtx(frame));
      const probe = vm.runInContext(
        `JSON.stringify({
           process: typeof process,
           require: typeof require,
           module: typeof module,
           fetch: typeof globalThis.fetch,
           Function: typeof Function,
         })`,
        context,
        { timeout: 1000 },
      );
      const realm = JSON.parse(probe);
      const env = {};
      for (const k of Object.keys(process.env)) env[k] = true;
      finish(frame.id, true, { realm, environ: Object.keys(env) });
    },
    // Paso 6: bucle infinito sincrónico ⇒ el panel debe SIGKILL por deadline.
    // (No devolvemos nunca; el panel mata el proceso.)
    "__pips_synthetic__:spin": async (_frame) => {
      // eslint-disable-next-line no-constant-condition
      while (true) { /* el panel SIGKILL por deadline; kill -0 lo confirma */ }
    },
    // Paso 7a: emite un server.exec capCall ⇒ el broker debe DENY.
    "__pips_synthetic__:exec-deny": async (frame) => {
      const ctx = makeCtx(frame);
      try {
        await ctx.server.exec("id");
        finish(frame.id, false, { denied: false });
      } catch (e) {
        finish(frame.id, true, { denied: true, code: e?.code ?? null, message: e?.message ?? null });
      }
    },
    // Paso 7b: emite un cap desconocido ⇒ el broker debe DENY (+kill panel-side).
    "__pips_synthetic__:unknown-cap": async (frame) => {
      const _ctx = makeCtx(frame);
      try {
        await capCall("server.tnt", "boom", {}); // cap fuera del closed-set
        finish(frame.id, false, { denied: false });
      } catch (e) {
        finish(frame.id, true, { denied: true, code: e?.code ?? null });
      }
    },
    // Paso 7c: emite un server.sudo capCall (preview pide sudo) ⇒ DENY siempre.
    "__pips_synthetic__:sudo-deny": async (frame) => {
      const _ctx = makeCtx(frame);
      try {
        await capCall("server.sudo", "exec", { cmd: "id" });
        finish(frame.id, false, { denied: false });
      } catch (e) {
        finish(frame.id, true, { denied: true, code: e?.code ?? null });
      }
    },
  };

  // ── Self-test step handlers (§7.1 pasos 2/3/4/5) ──────────────────────────
  // El panel (pool-supervisor.runWorkerSelftest) los activa con el `tool`
  // reservado `__selftest__:<kind>` y ESPERA un frame `{type:"selftest"}` de
  // vuelta (NO un `result`). Cada handler PRUEBA la frontera real desde dentro
  // del jail (realm scrub, environ, canary de secreto, corte de red, FS) y emite
  // `{v:1,type:"selftest",id,step,ok,detail}`. Un `tool` desconocido o un fallo
  // ⇒ ok:false (el panel engancha `available=false`, fail-closed).
  const sendSelftest = (frameId, step, ok, detail) =>
    send({ v: 1, type: "selftest", id: frameId, step, ok: !!ok, detail: String(detail).slice(0, 512) });

  const SELFTEST = {
    // Paso 2a: scrub del realm leído DESDE el realm que corre código no confiable.
    realm: (frame) => {
      try {
        const context = buildModuleRealm(makeCtx(frame));
        const probe = vm.runInContext(
          `JSON.stringify({
             process: typeof process, require: typeof require,
             module: typeof module, fetch: typeof globalThis.fetch,
             Function: typeof Function,
           })`,
          context,
          { timeout: 1000 },
        );
        const r = JSON.parse(probe);
        const ok =
          r.process === "undefined" && r.require === "undefined" &&
          r.module === "undefined" && r.fetch === "undefined";
        sendSelftest(frame.id, 2, ok, ok ? "realm scrubbed" : `realm NOT scrubbed: ${JSON.stringify(r)}`);
      } catch (e) {
        sendSelftest(frame.id, 2, false, `realm probe error: ${e?.message ?? e}`);
      }
    },
    // Paso 2b: el environ COMPLETO del child es subconjunto del set permitido.
    environ: (frame) => {
      const extra = Object.keys(process.env).filter((k) => !ALLOWED_ENV.has(k));
      sendSelftest(frame.id, 2, extra.length === 0, extra.length ? `unexpected env keys: ${extra.join(",")}` : "environ subset OK");
    },
    // Paso 3: canary estructural — el canary del panel + secretos reales DEBEN
    // dar EACCES/ENOENT (ausencia estructural, no incidental). El canary lo pasa
    // el panel por input.canaryPath (creado 0600 bajo el CONFIG_DIR real).
    canary: (frame) => {
      const canaryPath = frame?.input?.canaryPath;
      const targets = [
        canaryPath,
        `${CFG_DIR}/shared-secrets.json`,
        "/etc/nginx/certs/mtls/luxipanel-client.key",
      ].filter((p) => typeof p === "string" && p.length > 0);
      for (const p of targets) {
        try {
          accessSync(p, fsc.F_OK);
          sendSelftest(frame.id, 3, false, `secret/canary READABLE inside jail (scrub not structural): ${p}`);
          return;
        } catch (e) {
          if (e?.code !== "ENOENT" && e?.code !== "EACCES") {
            sendSelftest(frame.id, 3, false, `unexpected errno ${e?.code} for ${p} (not structural absence)`);
            return;
          }
        }
      }
      sendSelftest(frame.id, 3, true, "canary + secrets structurally absent (EACCES/ENOENT)");
    },
    // Paso 4: corte de red LOAD-BEARING. route table vacía + connect a
    // 127.0.0.1:8080 Y 1.1.1.1:443 ⇒ ambos ENETUNREACH/EAFNOSUPPORT. ECONNREFUSED
    // = FAIL (loopback up). (§7.1 paso 4 / §4.5.)
    network: async (frame) => {
      try {
        // (i) Prueba estructural: /proc/net/route sólo cabecera.
        const txt = readFileSync("/proc/net/route", "utf8");
        const rows = txt.split("\n").map((l) => l.trim()).filter(Boolean);
        if (rows.length > 1) {
          sendSelftest(frame.id, 4, false, `route table NOT empty (${rows.length - 1} routes): netns not isolated`);
          return;
        }
      } catch (e) {
        sendSelftest(frame.id, 4, false, `cannot read /proc/net/route (${e?.code})`);
        return;
      }
      // (ii) connect probes a loopback (panel) y a una IP enrutable (internet).
      const probe = (host, port) =>
        new Promise((resolve) => {
          const s = net.connect({ host, port });
          let settled = false;
          const done = (res) => {
            if (settled) return;
            settled = true;
            try { s.destroy(); } catch { /* ignore */ }
            resolve(res);
          };
          s.setTimeout(800);
          s.on("connect", () => done({ ok: false, why: `connect ${host}:${port} succeeded (network present)` }));
          s.on("timeout", () => done({ ok: false, why: `connect ${host}:${port} hung (timeout): netns not isolated` }));
          s.on("error", (e) => {
            if (e.code === "ENETUNREACH" || e.code === "EHOSTUNREACH" || e.code === "EAFNOSUPPORT" || e.code === "EADDRNOTAVAIL") {
              done({ ok: true });
            } else {
              // ECONNREFUSED ⇒ routable loopback ⇒ FAIL (§4.5).
              done({ ok: false, why: `connect ${host}:${port} gave ${e.code} (expected ENETUNREACH; ECONNREFUSED = routable = FAIL)` });
            }
          });
        });
      const panel = await probe("127.0.0.1", 8080);
      if (!panel.ok) { sendSelftest(frame.id, 4, false, panel.why); return; }
      const ext = await probe("1.1.1.1", 443);
      if (!ext.ok) { sendSelftest(frame.id, 4, false, ext.why); return; }
      sendSelftest(frame.id, 4, true, "network cut: empty route table + ENETUNREACH on loopback:8080 and 1.1.1.1:443");
    },
    // Paso 5: confinamiento de FS. escribir fuera de /scratch ⇒ EROFS/EPERM/
    // ENOENT (ruta ausente del ns); dentro de /scratch ⇒ éxito; rutas del host
    // (/etc/luxipanel, /var/www, cache dir) ausentes del ns.
    fs: (frame) => {
      try {
        // (a) escritura fuera de /scratch debe fallar.
        let outsideBlocked = false;
        try {
          writeFileSync("/pips-escape-test", "x");
          try { unlinkSync("/pips-escape-test"); } catch { /* ignore */ }
        } catch (e) {
          if (e?.code === "EROFS" || e?.code === "EPERM" || e?.code === "ENOENT" || e?.code === "EACCES") outsideBlocked = true;
          else { sendSelftest(frame.id, 5, false, `write outside /scratch gave unexpected ${e?.code}`); return; }
        }
        if (!outsideBlocked) { sendSelftest(frame.id, 5, false, "write outside /scratch SUCCEEDED (FS not confined)"); return; }
        // (b) escritura dentro de /scratch debe funcionar.
        try {
          writeFileSync("/scratch/.pips-w", "x");
          unlinkSync("/scratch/.pips-w");
        } catch (e) {
          sendSelftest(frame.id, 5, false, `write inside /scratch failed (${e?.code}): no scratch tmpfs`);
          return;
        }
        // (c) rutas del host ausentes del namespace.
        const hostPaths = [CFG_DIR, "/var/www", "/etc/luxipanel"];
        const present = hostPaths.filter((p) => { try { return existsSync(p) && readdirSync(p).length > 0; } catch { return false; } });
        if (present.length) { sendSelftest(frame.id, 5, false, `host paths present in ns: ${present.join(",")}`); return; }
        sendSelftest(frame.id, 5, true, "FS confined: write outside blocked, /scratch writable, host paths absent");
      } catch (e) {
        sendSelftest(frame.id, 5, false, `fs probe error: ${e?.message ?? e}`);
      }
    },
  };

  const dispatch = (frame) => {
    if (dispatchId !== 0) {
      // Ya hay un dispatch en curso (el panel viola single-flight) ⇒ fail-closed.
      die(EXIT.BOOT, "segundo dispatch antes de terminar el anterior (single-flight roto)");
      return;
    }
    // Self-test step: el panel pide un paso interno por el `tool` reservado
    // `__selftest__:<kind>` y espera un frame `{type:"selftest"}`. Estos NO son
    // código del autor: prueban la frontera real desde el mismo proceso jailed.
    const tool = typeof frame?.tool === "string" ? frame.tool : "";
    if (tool.startsWith("__selftest__:")) {
      const kind = tool.slice("__selftest__:".length);
      // `loop` reusa el camino de spin (paso 6): el panel SIGKILLea por deadline.
      if (kind === "loop") {
        dispatchId = frame.id;
        // eslint-disable-next-line no-constant-condition
        while (true) { /* el panel SIGKILL por deadline; kill -0 lo confirma */ }
      }
      const handler = SELFTEST[kind];
      if (!handler) {
        sendSelftest(frame.id, 0, false, `unknown selftest kind: ${kind}`);
        return;
      }
      dispatchId = frame.id;
      nextCallId = 1;
      capCount = 0;
      pending = null;
      Promise.resolve(handler(frame))
        .catch((e) => sendSelftest(frame.id, 0, false, `selftest(${kind}) threw: ${e?.message ?? e}`))
        .finally(() => { dispatchId = 0; });
      return;
    }
    const synth = typeof frame?.source?.entryBytes === "string"
      ? SYNTH[frame.source.entryBytes]
      : undefined;
    const runner = synth ?? runDispatch;
    // Estado per-dispatch limpio (los synthetic no llaman runDispatch).
    dispatchId = frame.id;
    nextCallId = 1;
    capCount = 0;
    pending = null;
    Promise.resolve(runner(frame)).catch((e) => fail(frame.id, e?.message ?? "dispatch falló"));
  };

  let buf = Buffer.alloc(0);
  let lastId = -1;
  sock.on("data", (chunk) => {
    buf = buf.length === 0 ? chunk : Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < LEN) break;
      const len = buf.readUInt32BE(0);
      if (len > MAX_FRAME) { die(EXIT.BOOT, `trama IPC sobre-dimensionada: ${len}`); return; }
      if (buf.length < LEN + len) break;
      if (len === 0) { die(EXIT.BOOT, "trama IPC de longitud cero"); return; }
      const body = buf.subarray(LEN, LEN + len);
      buf = buf.subarray(LEN + len);
      let msg;
      // Paridad con protocol.ts: una trama malformada es fail-closed (mata al
      // worker), NUNCA un `continue` silencioso (eso desincroniza y oculta un
      // emisor hostil).
      try { msg = JSON.parse(body.toString("utf8")); }
      catch { die(EXIT.BOOT, "cuerpo de trama IPC no es JSON válido"); return; }
      if (msg === null || typeof msg !== "object") { die(EXIT.BOOT, "trama IPC no es objeto"); return; }
      if (msg.v !== 1) { die(EXIT.BOOT, `versión de protocolo no soportada: ${msg.v}`); return; }
      if (typeof msg.id !== "number" || !Number.isInteger(msg.id) || msg.id < 0) {
        die(EXIT.BOOT, `id de trama inválido: ${msg.id}`); return;
      }
      // capResult lleva callId, no id monótono de dispatch; sólo exigimos la
      // monotonía de id en frames de control (dispatch/ping/echo).
      switch (msg.type) {
        case "dispatch": {
          if (msg.id <= lastId) { die(EXIT.BOOT, `id de dispatch no monótono: ${msg.id}`); return; }
          lastId = msg.id;
          dispatch(msg);
          break;
        }
        case "capResult":
        case "capReturn": {
          // Respuesta del broker al capCall en vuelo. Debe coincidir el callId.
          if (!pending) { die(EXIT.BOOT, "capResult sin capCall pendiente"); return; }
          if (msg.callId !== pending.callId) { die(EXIT.BOOT, `capResult con callId desfasado: ${msg.callId}`); return; }
          pending.settle({ ok: !!msg.ok, value: msg.value, error: msg.error, code: msg.code });
          break;
        }
        case "ping": {
          if (msg.id <= lastId) { die(EXIT.BOOT, `id de ping no monótono: ${msg.id}`); return; }
          lastId = msg.id;
          send({ v: 1, type: "pong", id: msg.id });
          break;
        }
        case "echo": {
          // Compatibilidad con el smoke F1: eco simple.
          if (msg.id <= lastId) { die(EXIT.BOOT, `id de echo no monótono: ${msg.id}`); return; }
          lastId = msg.id;
          send({ v: 1, type: "echo", id: msg.id, payload: msg.payload ?? null });
          break;
        }
        default:
          die(EXIT.BOOT, `tipo de trama desconocido: ${msg.type}`);
          return;
      }
    }
  });
  sock.on("error", () => process.exit(0));
  sock.on("close", () => process.exit(0));
  // Anunciar listo (con el self-hash para el SHA-pin del panel).
  send(READY);
}

// Modo self-test (gate F1): tras pasar las verificaciones de frontera, anuncia
// PIPS_OK y termina, SIN requerir el socketpair fd-3 (que arma el pool-supervisor
// en F2). Permite validar las primitivas de aislamiento en el host de forma
// aislada del canal IPC.
function finishSelftest() {
  process.stdout.write("PIPS_OK\n");
  process.exit(0);
}

const after = process.env.LXP_SELFTEST_ONLY === "1" ? finishSelftest : startWorker;
assertNoNetwork().then(after).catch((e) => die(EXIT.BOOT, `arranque falló: ${e?.message ?? e}`));
