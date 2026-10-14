# LUXIPANEL Out-of-Process Preview Sandbox Runtime — Final Design

**Status:** implementation-ready · **Default:** ships **disabled** (`PREVIEW_SANDBOX_ENABLED=false`, `MODULE_DEV_PREVIEW_ENABLED=false`)

> **Estado: F2–F4 implementadas 2026-06-14, INERTE por `PREVIEW_SANDBOX_ENABLED=false`.**
> El runtime (`protocol.ts` · `config.ts` · `substrate.ts` Tier-1+Tier-2 · `selftest.ts` · `pool-supervisor.ts` · `broker.ts` · `preview-policy.repository.ts` · `child.mjs` · `runtime.ts` + cableado `server.ts`/notifications/`install.sh`) está completo y verificado por unit+integration (`npm run typecheck` exit 0; suites preview-sandbox verdes), pero **no se ejecuta**: ambos flags siguen en `false` por defecto y `isAvailable()` permanece `false`, así que `dispatchPreviewTool` sigue lanzando el `ForbiddenError` fail-closed. Falta **F5** (sign-off de seguridad + gate CI sobre el artefacto de release; §11/§12). Este encabezado documenta SOLO el estado de fases; el diseño de §1–§12 no cambia.
**Codename:** PIPS — Pooled Isolated Preview Sandbox
**Integration point (unchanged interface):** `backend/src/shared/preview-sandbox/runtime.ts`
**Author audience:** senior backend engineer implementing `pool-supervisor.ts` / `broker.ts` / `substrate.ts` / `child.mjs`.

> This document supersedes the original "PIPS seed." Four independent red-team passes returned **fundamentally-flawed** on the seed. The root causes were: (1) the documented default tier (plain `unshare`, no FS scrub) **leaks the persisted `LUXIPANEL_KEY` off disk**; (2) `systemd-run --user` is **unreachable on a no-session boot** (the production norm), silently degrading to that leaky tier; (3) the broker was specified as "literally `buildCtx`'s method bodies," which makes it a **confused deputy** that runs attacker-authored `server.exec`/`server.sudo`/`server.fs.write` as root on the connected tenant server. This design fixes **every** critical and high finding, and states honestly where process isolation is **not sufficient** (§12).

---

## 1. Goal & non-goals

### Goal
Execute an **adversarial** module-preview's JavaScript (`module-dev` Modo B) such that:
- It runs in a **separate OS process** that never holds the panel's secrets or any tenant's `Executor`.
- Every host effect it requests is **mediated back to the panel** over a framed `AF_UNIX` channel and re-authorized against an **operator-approved** policy (not the author's own manifest).
- The runtime is **fail-closed by construction**: any condition that cannot be positively proven safe ⇒ `isAvailable()=false` ⇒ `dispatchPreviewTool` throws the existing `ForbiddenError`. There is no fail-open path.
- It fits the existing `PreviewSandboxRuntime` interface verbatim; `preview.service.ts` and `community-loader.service.ts` need **zero** changes.

### Non-goals
- **Not** a general module runtime. Approved (human-reviewed) community modules continue to run in-process via `buildCtx`; PIPS is **only** for unreviewed previews.
- **Not** a microVM. Firecracker needs `/dev/kvm` (absent on the deploy host); gVisor needs a shipped Go binary + ptrace/KVM platform. Both add a per-customer rootfs/kernel artifact that violates the `install.sh` portability mandate. The VM's headline value (preventing host-memory secret theft) is **moot**: the child holds zero secrets and zero Executor. Do not reopen the VM debate.
- **Not** an in-process isolate. `isolated-vm` shares the host V8 heap; a V8/addon 0-day = same-process RCE = cross-tenant secret theft. Rejected by three prior reviews and by `runtime.ts` lines 19–22. Not revisited.
- **Not** streaming. `executor.spawn` / pty / `batchSftp` are **not** exposed to previews.
- **Does not** by itself contain the confused-deputy RCE-on-target for `server.exec`/`server.sudo`/`server.fs.write`. That is contained by **policy** (§6, §12), not by the OS boundary.

---

## 2. Threat model (concise)

| Asset in panel heap / on panel host | Why catastrophic if reached | Defended by |
|---|---|---|
| `LUXIPANEL_KEY` (env **and** persisted `${LUXIPANEL_CONFIG_DIR}/shared-secrets.json` 0600) | Authenticates panel→LP as the panel; cross-customer pivot | Clean env (§4.4) **+ mount-scrubbed rootfs so the file is not in the namespace** (§4.3) |
| mTLS client key/cert (`/etc/nginx/certs/mtls/*`, env base64) | Impersonate the installation to LP | Same: clean env + path absent from mount ns |
| `JWT_SECRET`, `REDIS_URL`, cache Redis creds (`/etc/luxipanel/cache/*`) | Decrypt SSH-cred cache; reach per-server write-queue `cred` (passphrase) | Same + no network (empty netns) |
| Live `Executor` instances of **other** tenants (heap `Map`s) | Cross-tenant root on other customers' servers | **Separate process** — never in child address space |
| The **connected tenant's own** `Executor` (request-scoped) | Root RCE on *that* customer's prod server | **Policy**: previews are denied `exec`/`sudo`/`fs.write` (§6, §12) — the OS boundary does **not** help here |

**Adversary capability:** writes arbitrary JS in the preview, writes the preview's own `module.manifest.json` (`capabilities[]`, `http_allowlist[]`), and can re-install (re-vendorize) the same `moduleId`. Self-install only (`ownerUserId === self`); no human review.

**Boundary stance:** the OS-process + empty-netns + mount-scrub boundary protects the **panel host's secrets and other tenants**. It does **not** reduce blast radius for effects the broker is *willing to perform on the connected tenant's behalf* — those are contained by denying dangerous capabilities to previews (§6).

---

## 3. Chosen architecture

### 3.1 Substrate decision (host-probed ground truth)

Deploy host: Debian, systemd 257 PID1, Node 22.22.2 (ABI 127 / V8 12.4.254.21), **panel runs non-root uid 1003**, **no non-interactive sudo password**, `max_user_namespaces=15357`, `unprivileged_userns_clone=1`, **no `/dev/kvm`**, no docker/podman/nsjail/bwrap/firejail/gVisor. systemd-run **`--user` is unreachable on a no-session boot** (pm2 is a *system* service, `Linger=no` ⇒ `/run/user/1003` + `DBUS_SESSION_BUS_ADDRESS` absent; `systemd-run --user` returns "Failed to connect to user scope bus").

**Hard conclusions baked into `substrate.ts`:**

1. **The security floor is filesystem-scrubbed by construction, in every tier.** Plain `unshare --mount` inherits a *copy* of the host mount tree; with `--map-root-user` the child is uid 1003 = the owner of the 0600 secret sidecars ⇒ **it reads `shared-secrets.json` directly.** Therefore *plain unshare with the host mount visible is FORBIDDEN.* Every accepted tier **must `pivot_root` into a minimal scrubbed rootfs** where `/etc/luxipanel`, `/etc/nginx`, `/var/www`, the host `/proc`, etc. are **simply not present**. DAC/ownership is never relied upon.

2. **systemd Tier reinforces but never replaces the kernel-enforced cuts.** `systemd-run --user PrivateNetwork=yes` was probed to **silently no-op** under the unprivileged user manager (got `ECONNREFUSED`, not `ENETUNREACH`). So the **network cut and the FS scrub must come from `unshare --net` + `pivot_root`, never from a systemd property.** systemd-run, *when reachable*, adds cgroup limits + an independent seccomp/`InaccessiblePaths` belt — strictly additive, never load-bearing.

3. **No new runtime deps, no native addon.** Therefore in-child seccomp/landlock are **best-effort and never claimed load-bearing**; the floor rests on `pivot_root` (FS) + empty-netns (network) + clean env + `setpriv --no-new-privs` (privilege) + the panel-side broker.

### 3.2 Tier ladder (every accepted tier is FS-scrubbed + netns-isolated)

The tier is **probed live at `init()`** through the **exact production spawn builder** and recorded in `describe()`. `PREVIEW_SANDBOX_MIN_TIER` **defaults to the confining tier and can only be raised, never lowered below it.** There is **no plain-unshare / no-pivot tier.**

- **Tier 2 — `unshare`(`--user --map-root-user --net --pid --mount --uts --ipc --fork --kill-child`) + `pivot_root` + `setpriv` + cgroup/seccomp reinforcement via a transient unit.** Used only when a **reachable, confining** systemd path exists. On this deploy that requires **`loginctl enable-linger`** for the panel user (added to `install.sh`, §9) so `/run/user/<uid>` + the user manager exist without a login session; `init()` verifies `XDG_RUNTIME_DIR`+`DBUS_SESSION_BUS_ADDRESS` are present **and** that a probe unit's `PrivateNetwork` actually yields `ENETUNREACH` (else this tier is rejected, never trusted). The unit adds: `MemoryMax=128M MemoryHigh=112M MemorySwapMax=0 TasksMax=32 CPUQuota=50% NoNewPrivileges=yes CapabilityBoundingSet= AmbientCapabilities= RestrictAddressFamilies=AF_UNIX RestrictNamespaces=yes RestrictSUIDSGID=yes LockPersonality=yes SystemCallArchitectures=native SystemCallFilter=@system-service SystemCallFilter='~@privileged ~@resources ~@mount ~@swap ~@reboot ~@module ~@obsolete ~@clock ~@cpu-emulation ~@debug ~@raw-io ~@pkey' SystemCallErrorNumber=EPERM InaccessiblePaths=/etc/luxipanel:/etc/nginx/certs ProtectProc=invisible ProcSubset=pid`. **`DynamicUser` is dropped** (fails on the user bus, and `--map-root-user` already maps to a non-host-root uid). Blocked syscalls return **EPERM, not SIGSYS** (graceful JS error, not a crash that masquerades as a sandbox bug).

- **Tier 1 — `unshare` + `pivot_root` + `setpriv`, no cgroup unit (DEFAULT, `MIN_TIER=1`).**
  `setpriv --no-new-privs --inh-caps=-all --bounding-set=-all -- unshare --user --map-root-user --net --pid --mount --uts --ipc --fork --kill-child -- /init-jail` where `/init-jail` (logic inside `child.mjs`'s pre-exec stub, see §4.3) performs the `pivot_root` + fresh `/proc` + tmpfs `/scratch` + `umount -l` of the old root **before** any untrusted byte. Empty netns = network cut by construction; clean env = no secret inheritance; `pivot_root` = no secret file in the namespace; `--no-new-privs` = setuid bits inert; per-process `setrlimit` for memory/procs (best-effort, not the only line of defense — see the fork-bomb caveat §7.4). FD 3 = the `socketpair` (survives `exec`; no socket file).
  **Crucial:** Tier 1 is acceptable **only** because the self-test (§7.1) *positively proves* — through this exact builder — that the secret canary returns **EACCES** (structural deny via missing path), the netns yields `ENETUNREACH`, and writes outside `/scratch` fail. If `pivot_root` cannot be established (old util-linux, locked-down userns), Tier 1 **fails the self-test ⇒ `isAvailable()=false`**. There is no degrade to a non-scrubbed jail.

- **No tier below Tier 1.** A present-but-unverified runtime is observationally identical to absent.

> **Why Tier 1 can pivot_root as non-root:** inside `unshare --user --map-root-user` the child is uid 0 *in its own user namespace* with `CAP_SYS_ADMIN` in that namespace, which is sufficient for `pivot_root`/`mount` of new mounts **within** the namespace (it cannot affect the host). `setpriv --no-new-privs` is applied on the **outer** command so re-acquiring privilege via setuid is blocked; the in-namespace caps needed for the mount dance are exercised **before** dropping into untrusted code, after which no setuid path remains and netns/pidns are already established.

### 3.3 Process / pool model

- **Long-lived warm pool** (`PoolSupervisor`, plain TS in the panel, holds child *handles* only — never module code). Size = `clamp(1, floor(numCPUs/2), PREVIEW_SANDBOX_POOL_SIZE` default 2, hard cap 8`)`.
- Each worker runs the panel-shipped trusted `child.mjs`, **single-flight** (one dispatch at a time; the pool is the only concurrency unit).
- **Single-use by default** (`PREVIEW_SANDBOX_REUSE=once`): destroy-and-replace after **every** dispatch, eager warm refill off the critical path, so no hostile dispatch shares a V8 heap (or a userns/pidns) with the next tenant.
- **`PREVIEW_SANDBOX_REUSE=pooled`** (opt-in): reuse up to `PREVIEW_SANDBOX_WORKER_MAX_DISPATCHES` (default 20) but **unconditionally recycle on `moduleId` change AND on `owner` change**. Even pooled mode never mixes two realms or two tenants. **Every worker gets its own fresh userns + pidns** in both modes (closes cross-worker `ptrace`).
- Global concurrency cap == pool size; excess queues to a bounded FIFO (`PREVIEW_SANDBOX_QUEUE_MAX` default 16); over-queue ⇒ immediate "sandbox saturated" rejection (fail-closed). **Per-owner reservation:** at most `floor(poolSize/2)` workers per owner so one owner cannot starve the pool. **Queue-admission timeout is separate from the execution deadline** (queue wait is panel-controlled and does not consume the module's execution budget — prevents cross-tenant DoS, §7.4).
- Per-owner token bucket (`PREVIEW_SANDBOX_PER_OWNER_RATE` default 6/30s) + per-owner concurrency 1, checked in `preview.service`/supervisor **before** a worker is leased.
- Supervision: `Map<pid, WorkerState>`; on `exit`/`error`/socket-close/OOM(cgroup SIGKILL)/SIGSYS/deadline ⇒ reject in-flight dispatch with a typed error, reap, replenish with exponential backoff (250 ms→8 s). **A worker crash never touches the panel process and never falls back to in-process execution.**
- **Orphan reaping (crash-safe):** `--kill-child` does **not** fire when the *panel* is SIGKILLed (unshare reparents to PID1). Therefore: (a) Tier 2 spawns each worker under its own transient unit ⇒ systemd reaps the unit on panel exit; (b) **all tiers** set `PR_SET_PDEATHSIG=SIGKILL` in the immediate child **and** place workers in a dedicated panel-owned cgroup (`cgroup.kill` on shutdown); (c) `init()` scans for and kills any stale PIPS cgroup/units from a prior crashed instance **before** warming the pool.

### 3.4 ASCII: panel ↔ broker ↔ sandboxed child

```
 PANEL PROCESS (uid 1003, holds secrets + per-request Executor)
 ┌───────────────────────────────────────────────────────────────────────┐
 │ preview.service.dispatchPreviewTool(moduleId,tool,input,user)          │
 │   guard: registry owner == user, isAvailable(), tool/id regex          │
 │      │                                                                  │
 │      ▼  (inside the request's runWithExecutor ALS scope)               │
 │ runtime.dispatch(req):                                                  │
 │   • capture BrokerSession{ executor=getContextExecutor() [fail-closed], │
 │       user=getContextUser(), sessionEpoch, owner }                      │
 │   • open installedDir as O_PATH dirfd; openat manifest+entry from it;   │
 │     read+FREEZE manifest, hash it, read entry SOURCE bytes              │
 │   • load OPERATOR-APPROVED policy sidecar (owner,moduleId); AND it with │
 │     the frozen manifest → effectivePolicy (deny-by-default)             │
 │      │                                                                  │
 │      ▼                                                                  │
 │ PoolSupervisor.lease() → WorkerState ──fd3 socketpair (SEQPACKET)──┐    │
 │      │                                                             │    │
 │ BROKER (broker.ts, single switch, default: DENY)  ◄── capCall ─────┤    │
 │   re-assert getContextExecutor()===session.executor & epoch        │    │
 │   effectivePolicy gate → executor.exec/readFile/... (panel-side)   │    │
 │   serialize result host-side ── capResult ─────────────────────────►    │
 └───────────────────────────────────────────────────────────────────┼────┘
                                                                       │ fd3
 CHILD (separate OS proc · setpriv --no-new-privs · unshare --net --pid│--mount
 --user --map-root-user · pivot_root→scrub · clean env · /scratch tmpfs)│
 ┌───────────────────────────────────────────────────────────────────┴────┐
 │ child.mjs: pivot_root+/proc+scratch BEFORE any module byte; scrub       │
 │ globals (process/require/module/fetch removed in the module realm);     │
 │ node:vm realm evaluates SOURCE BYTES passed in the dispatch frame       │
 │ (not re-read from disk). ctx.* shims → emit capCall on fd3, block on     │
 │ capResult. NO Executor, NO secret, NO network route in this address     │
 │ space.                                                                   │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Isolation policy

### 4.1 Exact spawn (Tier 1, the default floor)

Outer wrapper applied by the panel via `child_process.spawn` (argv array, never a shell):

```
setpriv --no-new-privs --inh-caps=-all --bounding-set=-all --
  unshare --user --map-root-user --net --pid --mount --uts --ipc --fork --kill-child --
    <nodeBinAbsPath> --disallow-code-generation-from-strings --max-old-space-size=96
      /opt/.../preview-sandbox/child.mjs --jail
```

- `stdin=/dev/null`; `stdout`/`stderr` → size-capped ring buffers for **diagnostics only**, never parsed as protocol.
- `socketpair(AF_UNIX, SOCK_SEQPACKET)` created pre-spawn, child end dup'd to **fd 3** (`stdio: ['ignore','pipe','pipe', socket]`). SEQPACKET preserves message boundaries (eliminates frame-desync).
- **Env passed by allowlist-as-construction (deny-by-default):** the panel builds the child `env` object **from scratch** (`env -i` semantics) with ONLY: `PATH=/usr/bin:/bin`, `NODE_OPTIONS` (as above), `LANG=C`, `PREVIEW_JAIL=1`. **No subtraction from `process.env`.** A future secret added to `config/env.ts` cannot leak because nothing is inherited. (Self-test asserts the *entire* child environ is a subset of this tiny set — §7.1 step 2.)

### 4.2 Tier 2 reinforcement (when reachable & verified confining)

Same `setpriv … unshare …` inner command, launched as the `ExecStart` of a transient `systemd-run --user --service-type=exec --collect -p <props…>` unit with the property set in §3.2. FD-passing under the unit uses a single-accept unix socket in the unit's private scratch `BindPath`, then `unlink`. The unit's cgroup gives **enforced** `MemoryMax`/`TasksMax`/`CPUQuota` (verified to enforce on this host). systemd props are **additive**; the network cut and FS scrub still come from `--net` + `pivot_root`.

### 4.3 Filesystem view — mount scrub (load-bearing, every tier)

Performed inside `child.mjs`'s **pre-module stub** (uses `mount`/`pivot_root` from util-linux, which IS a Tier prerequisite), **before** importing or evaluating any module byte:

1. `mount --make-rprivate /` (in the new mount ns).
2. Build a minimal rootfs on a fresh `tmpfs` (size `PREVIEW_SANDBOX_ROOT_MB` default 64M, mode 0700): `mkdir /newroot/{proc,scratch,vendor,usr,lib,lib64,bin,dev}`.
3. **Read-only** bind the node binary's needed dirs (`/usr/bin/node` + `/usr/lib`/`/lib*` as RO binds) and a **read-only** bind of the single vendored `installedDir` at `/vendor` — **note:** the module SOURCE is *also* passed by value in the dispatch frame (§5); the RO `/vendor` bind exists only for assets the module may read, and is RO so the child can never widen its own manifest on disk.
4. `mount -t tmpfs tmpfs /newroot/scratch -o size=<scratchMB>,mode=0700`.
5. `mount -t proc proc /newroot/proc` (fresh `/proc` for the child's OWN pidns — **host PIDs absent**).
6. Minimal `/dev`: bind `/dev/null`, `/dev/zero`, `/dev/urandom` only (RO where applicable).
7. `pivot_root /newroot /newroot/oldroot` → `chdir('/')` → `umount -l /oldroot` (detach the entire host tree) → `rmdir /oldroot`.
8. `chmod 0700 /scratch`; drop into the Node entrypoint.

After this, `/etc/luxipanel`, `/etc/nginx`, `/var/www`, host `/proc`, host `/home` are **not in the mount table** — DAC ownership is irrelevant because the **path does not exist** in the namespace. Tier 2 additionally layers `InaccessiblePaths` + `ProtectProc=invisible` as belt-and-suspenders.

**If any step fails ⇒ the child exits non-zero ⇒ the probe worker fails the self-test ⇒ `isAvailable()=false`.** Never continue with the host root visible.

### 4.4 No-secret-inheritance — three independent layers (all asserted at boot)

1. **Clean env by construction** (§4.1) — nothing inherited; self-test enumerates the *whole* environ and asserts subset of the tiny known set.
2. **Closed fds** — only fd 0/1/2 + fd 3 (socketpair) cross `exec`; `child.mjs` verifies `fs.readdirSync('/proc/self/fd')` ⊆ `{0,1,2,3}` (against the fresh `/proc`).
3. **Mount scrub** (§4.3) — the secret files are not in the namespace; a **canary** test (§7.1 step 3) creates a panel-uid 0600 file under the real config dir and asserts the jail gets **EACCES/ENOENT proving structural absence**, *not* incidental file-absence.

### 4.5 Network cut

Empty netns from `unshare --net`: loopback exists but stays **DOWN** with no address and no route. AF_INET socket *creation* succeeds (the child is userns-root and could `ip link set lo up`), but **every connect/bind-to-route fails `ENETUNREACH`/`EADDRNOTAVAIL`**, and no abstract-namespace AF_UNIX of the panel is reachable (abstract sockets are netns-scoped). The self-test asserts exactly this (§7.1 step 4) — **`ECONNREFUSED` is treated as a FAIL** (it would prove a routable loopback). The child has **no** way to reach `127.0.0.1:8080` (panel), `127.0.0.1:7379` (cache Redis), or `169.254.169.254`.

### 4.6 In-child seccomp/landlock (best-effort, never load-bearing)

A landlock ruleset cannot be installed on this host without a native addon, so this is **omitted from the floor and never claimed**. `setpriv --no-new-privs` + bounding-set drop is the privilege control; Tier 2's `SystemCallFilter` is the only real seccomp and is additive.

---

## 5. IPC protocol

**Transport:** one `socketpair(AF_UNIX, SOCK_SEQPACKET)`, parent-created pre-spawn, child fd 3.
**Framing:** 4-byte big-endian `uint32` length + UTF-8 JSON body. Max frame `PREVIEW_SANDBOX_MAX_FRAME` = 1 MiB (over-cap ⇒ kill worker). All messages `{ v:1, id, ... }`; `v≠1` / unknown `type` / reused `id` ⇒ **immediate kill** (deny-by-default protocol). The panel **never `eval`/`Function`s** wire bytes — only `JSON.parse` into a value it structurally re-validates.

**Schemas**

panel→worker:
- `{ v:1, type:"dispatch", id, moduleId, tool, input, deadlineMs, source:{ entryBytes:string, manifestHash:string }, policy:{ capabilities, http_allowlist } }` — `source.entryBytes` carries the **frozen** module source (copy-by-value, not a path the child re-reads); `policy` is the **effective operator-AND-manifest** set, already narrowed host-side.
- `{ v:1, type:"capResult", id, callId, ok, value?, error?, code? }`
- `{ v:1, type:"ping", id }`

worker→panel:
- `{ v:1, type:"ready", node, abi, v8, hostHash }` (once at boot)
- `{ v:1, type:"capCall", id, callId, cap, method, args }`
- `{ v:1, type:"result", id, ok, output }` (terminal)
- `{ v:1, type:"selftest", step, ok, detail }`
- `{ v:1, type:"log", level, msg }`
- `{ v:1, type:"pong", id }`

**Copy-by-value guarantee** (`runtime.ts` lines 54–60): `output` and every `capResult.value` cross as plain JSON. The **panel** constructs values from its *own* Executor return and serializes host-side; on inbound `result` the panel `JSON.parse`s child bytes as **untrusted data** (depth-/size-limited) and **re-serializes** before returning — module code never runs `JSON.stringify` on the wire path. Buffers ⇒ `{"$b64":...}`. No functions/streams/MessagePorts cross.

**Caps:** `output` ≤ `PREVIEW_SANDBOX_MAX_OUTPUT` (256 KiB); capCalls/dispatch ≤ `MAX_CAPS_PER_DISPATCH` (64); **deny-budget/dispatch ≤ 20** (over-budget = hostile child ⇒ kill+fault); **one outstanding capCall at a time** (serialized per dispatch).

---

## 6. Capability mediation — deny-by-default broker (the auditable trust surface)

**The child holds NO Executor.** `ctx.server.*` / `ctx.storage.*` / `ctx.http.fetch` in the child realm are thin shims that emit a `capCall` and block on `capResult`. **All authorization is panel-side**, in **one file** `broker.ts` as a single exhaustive `switch(cap)` with `default: DENY` and per-deny audit log `{moduleId, owner, cap, method, decision}`.

### 6.1 The broker is STRICTER than `buildCtx` (NOT a parity clone)

> **Dropped from the seed:** the "broker === `buildCtx`" parity goal. `buildCtx` (`module-sdk/index.ts:107–139`) is an **unconfined** bridge designed for *human-reviewed* modules: `exec: (cmd,o)=>{ gate("server.exec"); if(o?.sudo) gate("server.sudo"); return exec().exec(cmd,o); }` — arbitrary `cmd`, arbitrary path, author-declared allowlist. Reusing it verbatim for unreviewed preview code is exactly what makes RCE-on-target a confused deputy. The broker **imports the `Capability` type and the `assertAllowlisted` matcher** from `module-sdk` (so allowlist semantics don't drift), but its **authorization policy is preview-specific and tighter**.

**Preview capability policy (default, enforced in the broker regardless of manifest):**

| Capability | Default for a `.preview.json` module | Rationale |
|---|---|---|
| `server.exec` | **DENY** | Arbitrary RCE on tenant server; author-declared ≠ authorization |
| `server.sudo` | **DENY** (always; no opt-in) | Root RCE; can read the tenant's own secrets/SSH keys |
| `server.fs.write` | **DENY** | Arbitrary write = `authorized_keys`/cron/sudoers persistence + escalation |
| `server.fs.read` | **Allowed, path-confined** to an operator-set read prefix; **never** under `/etc/luxipanel`, the SSH/mTLS dirs, `~/.ssh`, `/etc/sudoers*`, cron dirs | Read-only, confined |
| `storage` | **Allowed, namespaced separately** (`preview:<ownerUserId>:<moduleId>`) | Never collides with the published `community:<id>` sidecar (confused-deputy persistence) |
| `http` | **DENY unless operator-approved allowlist + anti-SSRF (§6.4)** | Panel-side fetch is an exfil channel |

**Operator opt-in:** a panel-host sidecar `preview-policy/<ownerUserId>:<moduleId>.json` (0600, written only via an authenticated operator endpoint, **outside `installedDir`**) may *raise* specific grants (e.g. enable `http` for a named operator-controlled domain, or enable a **non-sudo** `server.exec` for an explicit, operator-named command). The effective policy is `operatorPolicy ∩ frozenManifest.capabilities` — the **author can only ever narrow**, never widen. With no operator sidecar, the table above is the whole policy: read + storage + nothing else.

### 6.2 Per-`capCall` algorithm

1. **Re-assert session liveness:** `getContextExecutor() === BrokerSession.executor` **and** the session epoch is unchanged (not logged-out/disposed). If not ⇒ DENY + abort dispatch. A queued dispatch is **never** serviced after its originating request scope unwound (see §6.5).
2. **Closed-set:** `cap ∈ {server.exec, server.sudo, server.fs.read, server.fs.write, storage, http}` else DENY.
3. **Method whitelist:** exec→{exec}; fs.read→{readFile,readdir,stat}; fs.write→{writeFile,mkdir,rename,unlink}; storage→{get,set,list,delete}; http→{fetch}. Unknown method ⇒ DENY.
4. **Effective-policy gate:** `cap ∈ effectivePolicy.capabilities` (the **frozen, operator-AND'd** set — §6.1, §6.3). For `exec` with `sudo:true`, **DENY unconditionally** for previews.
5. **Arg sanitation & confinement:** JSON-only; paths are strings without NUL; resolve `fs.read` paths absolute and assert under the operator read-prefix, reject `..`/symlink-escape, reject the secret/cron/ssh blocklist; `{$b64}`→Buffer only for the (non-preview-default) writeFile path.
6. **Execute** with `BrokerSession.executor` inside `runWithExecutor(executor,…)` so `storage` resolves to `kv(executor).module("preview:"+ownerUserId+":"+moduleId)`. Result serialized host-side; errors **sanitized** (class + code, no raw stack/host paths), returned by value.

`ToolDef.permission` is enforced against `getContextUser()` **before** the dispatch frame is sent.

### 6.3 Manifest TOCTOU & atomic source/policy snapshot

At `dispatch()` entry the panel opens `installedDir` once as an **O_PATH dirfd**, `openat`s `module.manifest.json` **and** the entry source from that single dirfd, **hashes** the manifest, and passes **entry source bytes + frozen policy** into the dispatch frame (copy-by-value). The broker authorizes every `capCall` against the **frozen** policy — never re-reads per call. **Concurrent install on a `moduleId` with an in-flight dispatch is forbidden** (per-owner concurrency extended to cover install↔dispatch). The RO `/vendor` bind (§4.3) means the child cannot rewrite its own manifest on disk anyway. **Vendoring rejects non-regular files** (`lstat` each dest; refuse symlinks) — `assertSafeRel` only checks the rel string, not the resulting inode (install-side hardening, §9).

### 6.4 `http` SSRF defenses (only if operator-enabled)

The fetch runs **in the panel** (the child has no route). It is **DENY by default for previews.** When operator-enabled for a named domain:
1. **Resolve-then-pin:** custom `lookup` resolves once; reject any address in loopback / RFC1918 / CGNAT `100.64/10` / link-local `169.254` / ULA `fc00::/7` / IPv4-mapped IPv6 / `0.0.0.0` / `::` **before** connect; the TCP connect uses **exactly** the vetted IP (no second resolution — closes the rebind TOCTOU).
2. `assertAllowlisted(effectivePolicy, url)` against the **operator** allowlist (not the author's), **scheme pinned `https`**, port pinned.
3. **Manual redirects:** re-run allowlist + IP-vet on **every** `Location` hop, cap hops; strip `Authorization`/`Cookie` on **any** cross-origin hop; never forward a panel secret.
4. Response body capped; metered/audited as a potential exfil channel.

### 6.5 Confused-deputy & stale-executor defenses

- **Executor capture is request-bound, re-validated per capCall** (§6.2 step 1): identity `===` + session epoch token. Hook `disposeDirectExecutor`/logout to **cancel** queued + in-flight leases for that session.
- **Never lease a worker for a queued dispatch whose request scope has unwound.** The supervisor pins the dispatch to a continuation that re-enters the *same* `runWithExecutor` scope; if that scope is gone, the dispatch is rejected, not run with a bare executor reference.
- **Pooled recycle parity test:** unconditional recycle on `moduleId` change **and** `owner` change; no `capResult` deliverable after the originating dispatch's deadline fired.

---

## 7. Lifecycle & resource limits

### 7.1 `init()` boot self-test — the POSITIVE gate (runs through the EXACT production builder/tier)

`init()` (idempotent, **never throws**, whole body in try/catch ⇒ catch sets `available=false`): read+freeze config (incl. `PREVIEW_SANDBOX_ENABLED` kill-switch ⇒ early return if false) → record expected `node`/`modules`/`v8` + `child.mjs` SHA-256 → **kill any stale PIPS cgroup/units** → probe tier via the production spawn builder (else unavailable+return) → spawn one probe worker the **exact pool way** → run the 7-step self-test below (each step under its own deadline; a hang ⇒ unavailable) → on green, warm the pool; every worker's `ready.{node,abi,v8,hostHash}` must equal expected (any mismatch ⇒ tear down, `available=false`) → `available=true`, `reason="tier=N pool=K node=22.22.2"`. Install SIGTERM/exit dispose hook.

**All 7 must pass — these assertions are TIER-INDEPENDENT and identical across tiers (no per-tier weakening):**

1. **ABI/host-hash pin:** `ready.node/.modules/.v8` === pinned exact strings AND `ready.hostHash` === baked `child.mjs` SHA. Any drift ⇒ unavailable. (`process.versions.modules` is the real UB boundary; `init()` MAY accept patch drift within the *same* module-ABI to reduce pressure to loosen the pin, but a `modules` mismatch is hard-fail.)
2. **Realm scrub + clean environ:** in the realm that runs untrusted code, `typeof process==="undefined" && typeof require==="undefined" && typeof module==="undefined" && globalThis.fetch===undefined`; AND the **entire** child environ (read via syscall) is a **subset** of `{PATH,NODE_OPTIONS,LANG,PREVIEW_JAIL}` — any unexpected key ⇒ FAIL.
3. **Secret absence — CANARY, structural:** `init()` first creates a panel-uid **0600 canary** file under the real `LUXIPANEL_CONFIG_DIR` (e.g. `.pips-canary`). The jail attempts to open the canary **and** `shared-secrets.json` **and** the mTLS key. **Each must throw EACCES or ENOENT *because the path is not in the namespace*** — and the test asserts the *canary* specifically returns EACCES/ENOENT to prove the deny is **structural (mount-scrub)**, not incidental (file-absent). `init()` deletes the canary after. (This is what disqualifies any non-pivot tier.)
4. **Network cut — load-bearing:** connect `127.0.0.1:8080` and `1.1.1.1:443` ⇒ both must fail **`ENETUNREACH`/`EAFNOSUPPORT`**; **explicitly FAIL on `ECONNREFUSED`**. Also assert loopback is **DOWN** with no inet addr and `/proc/net/route` is empty (route-independent of port liveness).
5. **FS confinement:** write outside `/scratch` ⇒ EROFS/EPERM; write inside `/scratch` ⇒ succeeds; AND assert `/etc/luxipanel`, `/var/www`, the cache-engine dir are **not present** in the namespace.
6. **Timeout fires end-to-end:** dispatch a `while(true)` synthetic with a 200 ms deadline; assert the panel SIGKILLs it and surfaces a timeout, and `kill -0` confirms death (proves the kill path, not just the timer).
7. **Capability deny-by-default:** synthetic emits a `server.exec` capCall while its synthetic policy grants nothing ⇒ broker returns DENY; an unknown cap string ⇒ DENY+kill; **a synthetic preview-policy that lists `server.sudo` ⇒ DENY** (proves previews can't get sudo). Uses a throwaway executor stub so it runs at boot with no connected server.

**Additionally (Tier-2 only, additive):** spawn `> TasksMax` forks inside the unit and assert `EAGAIN` (cgroup `pids.max` enforces). On Tier 1, fork-bomb mitigation is `setrlimit(RLIMIT_NPROC)` per child **plus** the dedicated panel cgroup `pids.max` if cgroup delegation is available; **if neither bounds forks, Tier 1 still ships but the residual fork-pressure risk is documented (§12 R1).**

### 7.2 `dispatch(req)`

re-check `available` → per-owner rate-limit/concurrency → open dirfd, freeze manifest+source+policy (§6.3) → lease worker (or queue with **admission timeout**; full ⇒ throw "saturated") → capture `BrokerSession` → arm the **single aggregate wall-clock deadline** `PREVIEW_SANDBOX_DISPATCH_MS` (default 5000; covers load + execute + all cap round-trips; the module **cannot reset/extend it**) → send dispatch → pump capCall↔capResult through the broker → on `result`: clear timer, recycle per policy, return `{ok,output}` host-cloned → on deadline/protocol-violation/exit: SIGKILL + recycle, reject typed (never hang the panel).

### 7.3 `teardown/dispose()`

SIGTERM/exit ⇒ `cgroup.kill` the worker cgroup (and `systemctl --user stop` each Tier-2 unit), SIGKILL the unshare tree, `rm -rf` scratch, `available=false`. `PR_SET_PDEATHSIG` + cgroup ensure orphans die even on panel crash; `init()` re-scans on next boot.

### 7.4 Resource limits

- **Memory/CPU/procs:** Tier 2 cgroup `MemoryMax=128M`, `MemorySwapMax=0`, `TasksMax=32`, `CPUQuota=50%` (enforced). All tiers: child `NODE_OPTIONS=--disallow-code-generation-from-strings --max-old-space-size=96` + in-child `setrlimit(RLIMIT_AS/CPU/NOFILE=64/NPROC=16)` + the panel-owned cgroup's `pids.max`/`memory.max` when delegation is available.
- **Per-dispatch:** single 5 s aggregate deadline; output ≤256 KiB; frame ≤1 MiB; caps ≤64; denies ≤20.
- **Pool/queue:** concurrency == pool size; per-owner ≤ `floor(poolSize/2)`; **queue-admission timeout distinct from execution deadline** (no cross-tenant starvation); bounded FIFO ⇒ saturation rejection.
- **Scratch tmpfs** `size` 64M (root) / 32M (`/scratch`), mode 0700, wiped on recycle. **Network = zero.**

---

## 8. Fail-closed matrix (the heart of safety)

`isAvailable()` returns the latched `available`. **Any** row ⇒ `available=false` ⇒ `dispatchPreviewTool` throws the existing `ForbiddenError`. `init()` never throws.

| # | Condition | Result |
|---|---|---|
| 1 | `PREVIEW_SANDBOX_ENABLED=false` (default) or `MODULE_DEV_PREVIEW_ENABLED=false` | unavailable (early return) |
| 2 | `unshare`/util-linux absent, OR `max_user_namespaces==0`, OR `unprivileged_userns_clone==0` | unavailable |
| 3 | **`pivot_root` cannot be established** (old util-linux / locked userns) ⇒ self-test step 3/5 fails | unavailable (**no non-scrubbed fallback**) |
| 4 | Chosen tier `< PREVIEW_SANDBOX_MIN_TIER` (default = confining floor) | unavailable |
| 5 | Tier-2 selected but `PrivateNetwork` probe yields `ECONNREFUSED` (silent no-op) or user bus unreachable | reject Tier 2; if no confining tier remains ⇒ unavailable (**never** drop to a non-scrubbed jail) |
| 6 | `child.mjs` missing or SHA-256 ≠ baked constant | unavailable |
| 7 | Self-test **step 1** ABI/host-hash drift (`process.versions.modules` mismatch) | unavailable |
| 8 | Self-test **step 2** realm not scrubbed OR environ ⊄ tiny known set | unavailable |
| 9 | Self-test **step 3** canary/secret file readable (not EACCES/ENOENT) | unavailable |
| 10 | Self-test **step 4** network connect returns `ECONNREFUSED` (routable) or loopback UP / route present | unavailable |
| 11 | Self-test **step 5** write outside `/scratch` succeeds OR host paths present in ns | unavailable |
| 12 | Self-test **step 6** timeout/kill path does not fire | unavailable |
| 13 | Self-test **step 7** broker DENY-by-default or sudo-deny not proven | unavailable |
| 14 | Probe worker `ready.{node,abi,v8,hostHash}` ≠ expected | unavailable |
| 15 | Pool cannot warm ≥1 healthy worker; ≥N consecutive spawn failures in backoff window | latch unavailable until next boot |
| 16 | `getContextExecutor()` null at dispatch entry (no per-server executor in scope) | dispatch rejects (fail-closed; never `localExecutor`) |
| 17 | Per-capCall: `getContextExecutor() !== BrokerSession.executor` or session epoch changed (logout/dispose) | DENY + abort dispatch |
| 18 | Queued dispatch whose originating request scope unwound | reject (never run with bare executor) |
| 19 | Protocol violation (`v≠1`, unknown type, reused id, over-frame, over-deny-budget) | kill worker + reject dispatch |
| 20 | Manifest hash changed mid-dispatch / concurrent install on in-flight moduleId | reject |
| 21 | Any uncaught error in `init()` | catch ⇒ unavailable + actionable WARN |

---

## 9. Integration plan

### `runtime.ts` (three method bodies + private helpers; **interface unchanged**)
- `init()` (replaces the warn-only block at lines 104–118): read config; if `PREVIEW_SANDBOX_ENABLED===false` ⇒ set unavailable+return. Else `PoolSupervisor.bootstrap()` (kill stale units → probe tier through prod builder → ABI/host-hash pin → spawn probe → 7-step self-test → warm pool); `available=supervisor.healthy()`; set `reason`/`describe`. Keep `initialized` idempotency; **whole body in try/catch ⇒ never throws.** Already runs inside `runOnPanelHost` (correct — pool boot is instance-level panel-host state).
- `isAvailable()`: return latched `available`.
- `describe()`: same shape, richer reason (tier + abi + pool + node).
- `dispatch(req)` (lines 128–134): when available, **capture `ownerExecutor=getContextExecutor()` (fail-closed if null) and `getContextUser()` AT ENTRY** (we are inside the per-request executor scope set by `requireAuth`, *not* `runOnPanelHost` — proven by the call site at `preview.service.ts:392`), open `installedDir` dirfd, freeze manifest+source, load+AND the operator policy, delegate to `PoolSupervisor.dispatch({...req, source, policy, ownerExecutor, owner, deadlineMs})`, return `{ok,output}`. When not available, keep the existing fail-closed throw.

### New files under `backend/src/shared/preview-sandbox/`
`pool-supervisor.ts` (spawn/recycle/dispatch/IPC/orphan-reap), `broker.ts` (single-switch, **stricter than `buildCtx`**, imports `assertAllowlisted`+`Capability`), `substrate.ts` (tier probe + `setpriv`/`unshare`/`pivot_root` builders + Tier-2 `systemd-run --user` unit builder), `child.mjs` (pre-module mount-scrub stub + global scrub + fd-3 SEQPACKET + `node:vm` realm evaluating **frozen source bytes** + RPC `ctx` shims; built+SHA-pinned by the backend build), `selftest.ts`, `protocol.ts`, `config.ts`, `preview-policy.repository.ts` (operator opt-in sidecar).

### `preview.service.ts` — **zero contract change**
Already gates on `isAvailable()` (line 380) and calls `dispatch({moduleId, installedDir, tool, input})` (line 392) with `installedDir = getCommunityInstalledDir()/<id>`. The `loaded` field (line 296) now meaningfully reflects a real sandbox. **Install-side hardening** (in `install()`'s vendoring loop): add `lstat` per dest and **reject non-regular files (symlinks)** — closes the vendored-symlink finding. This is the only `preview.service.ts` edit and it is a security hardening, not a contract change.

### `community-loader.service.ts` — **unchanged**
Still never `import()`s previews; the broker is the only executor of preview code; its warn no longer fires once available.

### `server.ts`
Add `previewSandboxRuntime.dispose?.()` to the graceful-shutdown list.

### `config/env.ts` (Zod, safe defaults)
`PREVIEW_SANDBOX_ENABLED`(false), `_MIN_TIER`(1 = confining floor, never a non-pivot tier), `_POOL_SIZE`(2), `_REUSE`(once), `_DISPATCH_MS`(5000), `_MEM_MAX_MB`(128), `_CPU_QUOTA_PCT`(50), `_MAX_FRAME`(1 MiB), `_MAX_OUTPUT`(256 KiB), `_MAX_CAPS_PER_DISPATCH`(64), `_QUEUE_MAX`(16), `_PER_OWNER_RATE`("6/30s"), `_WORKER_MAX_DISPATCHES`(20), `_ROOT_MB`(64), `_SCRATCH_MB`(32), `_ABI`(pinned exact). Wire `PREVIEW_SANDBOX_DEGRADED`/`PREVIEW_SANDBOX_UNAVAILABLE` into `wireInternalNotifications` (mirrors `WRITE_QUEUE_DEGRADED`).

### `install.sh` / provisioning
- Probe at install: `unshare`, util-linux `pivot_root`, `setpriv`, `max_user_namespaces`, `unprivileged_userns_clone`; record results for operator visibility. **Never assume** they exist on a customer host.
- Run **`loginctl enable-linger <panel-user>`** so the systemd **user manager** + `/run/user/<uid>` exist at boot (enables Tier 2 without a login session). If linger cannot be enabled, the host runs Tier 1 — still confining.
- Do **not** make sandbox availability a hard install requirement; the panel boots and runs with previews inert if the substrate is missing.

### Unchanged
`module-sdk` `buildCtx` (still the in-process path for **approved** modules), `agent-capability` registry, the executor/factory/context layer, and the fail-closed loader gates.

---

## 10. Phased implementation plan

| Phase | Deliverable | Still disabled? | Gate to advance | Estado real (2026-06-14) |
|---|---|---|---|---|
| **F1** | `protocol.ts`, `config.ts`, `child.mjs` (scrub + pivot_root + fd-3 echo), `substrate.ts` Tier-1 builder. **No broker, no dispatch wired.** Behind `PREVIEW_SANDBOX_ENABLED=false`. | **Yes** | `child.mjs` SHA pinned; manual `setpriv…unshare…` smoke test shows pivot_root + empty-netns on the deploy host. | ✅ `protocol.ts:86` (`encodeFrame`) / `:146` (`FrameDecoder`), `substrate.ts:155` (`buildTier1Command`), `child.mjs:233` (`ready` con `hostHash` = SHA del propio archivo, `child.mjs:238`); smoke `f1-smoke.mjs`. |
| **F2** | `selftest.ts` (all 7 steps incl. canary) + `pool-supervisor.ts` bootstrap/probe/warm; `runtime.init()` runs the self-test but **`dispatch` still throws** (broker absent). | **Yes** | Self-test passes on the deploy host **and** on a CI matrix host with userns disabled (must yield `available=false`, not crash). | ✅ `selftest.ts:147` (`runSelfTest`, 7 pasos incl. canary), `pool-supervisor.ts:128` (`bootstrap` NUNCA lanza → `:217 healthy()` / `:234 describe()`). |
| **F3** | `broker.ts` (stricter-than-`buildCtx`, read+storage only by default) + `preview-policy.repository.ts` + `dispatch()` wired end-to-end; `preview.service.ts` symlink-reject hardening; O_PATH dirfd freeze. | **Yes** (`ENABLED=false`) | Escape/exfil/bridge-abuse/DoS suite (§11) green; the **broker-deny tests** (sudo/exec/fs.write denied to previews) green. | ✅ `broker.ts:459` (`handleCapCall`, `default:`DENY) con `PREVIEW_HARD_DENY` aplicado en `broker.ts:510` (exec/sudo/fs.write SIEMPRE denegados) + `:168 buildEffectivePolicy`; `preview-policy.repository.ts` (`loadPreviewPolicy`); `runtime.ts:238` (`dispatch`, `getContextExecutor` fail-closed `:249`, `loadPreviewPolicy` `:262`); symlink/no-regular reject en `preview.service.ts:280`. |
| **F4** | Tier-2 `systemd-run --user` unit builder + `install.sh` linger + orphan-reap cgroup; notifications wired. | **Yes** | Tier-2 self-test green on a lingered host; Tier-2 silent-no-op detection proven (rejects, doesn't trust). | ✅/parcial — código completo: `substrate.ts:285` (`buildTier2Command`) / `:233` (`tier2PropertySet`) / `:331` (`probeTier2`, rechaza el no-op silencioso) / `:437` (`reapOrphans`); `install.sh:144` (`probe_preview_sandbox`) + `:206` (`loginctl enable-linger`, non-fatal); `server.ts:216` (`previewSandboxRuntime.dispose?.()`); eventos `shared/events/index.ts:124/127` cableados en `notifications.service.ts:424/436`. **Parcial:** el self-test Tier-2 verde sobre host con linger real queda por verificar en despliegue (gate de la fila); el host de deploy corre Tier-1. |
| **F5** | **Flip `MODULE_DEV_PREVIEW_ENABLED=true` for opt-in operators, keep `PREVIEW_SANDBOX_ENABLED` operator-gated.** | Opt-in only | **All §12 "do NOT enable until" conditions met**, CI self-test gate (§11) green on the release artifact, and a security sign-off that previews receive **no** `exec`/`sudo`/`fs.write` without explicit per-(owner,module) operator policy. | ⏳ Pendiente — requiere sign-off de seguridad + gate CI sobre el artefacto de release (§11/§12) y que se cumplan las 8 condiciones del §12. Flags siguen en `false`; no encender. |

**Kill-switch:** `PREVIEW_SANDBOX_ENABLED=false` ⇒ every dispatch fail-closed, regardless of phase (mirrors `WRITE_QUEUE_ENABLED`).

---

## 11. Test plan

### Unit (vitest, alongside source; mock executor/redis/fs before import)
- `protocol.ts`: framing (length-prefix, SEQPACKET boundaries), reject `v≠1`/unknown type/reused id/over-frame.
- `broker.ts`: **default DENY**; previews denied `server.exec`/`server.sudo`/`server.fs.write` even when the (synthetic) manifest declares them; `effectivePolicy = operator ∩ manifest` narrows-only; fs.read path confinement rejects `..`/secret-blocklist/symlink; storage namespace is `preview:<owner>:<id>` (never `community:<id>`); http DENY by default; SSRF resolve-then-pin rejects loopback/RFC1918/metadata/rebind and re-vets each redirect.
- `pool-supervisor.ts`: single-flight; recycle-on-`once`; pooled recycle on moduleId/owner change; per-owner reservation; queue saturation rejection; admission-timeout ≠ execution deadline; stale-executor abort; deadline SIGKILL.
- `substrate.ts`: tier probe yields `available=false` when userns/pivot unavailable.

### Integration (`src/test/integration/`, real child processes on the test host)
- **escape:** child cannot read `.pips-canary`/`shared-secrets.json`/mTLS key (EACCES/ENOENT structural); host paths absent from mount ns; `/proc` shows no host PID.
- **exfil:** child cannot connect to `127.0.0.1:8080`/`:7379`/`1.1.1.1`/`169.254.169.254` (ENETUNREACH, **not** refused); environ ⊆ tiny set; no fd beyond 0–3.
- **bridge-abuse:** a preview declaring `server.exec`+`server.sudo` gets DENY for both; `ctx.server.exec('cat /etc/luxipanel/shared-secrets.json',{sudo:true})` ⇒ DENY; manifest rewrite mid-dispatch ⇒ rejected (frozen snapshot); cross-tenant executor reuse impossible (epoch re-check); storage write lands only in `preview:` namespace.
- **DoS:** `while(true)` ⇒ SIGKILL within deadline; fork attempt bounded (Tier-2 EAGAIN; Tier-1 setrlimit/cgroup); one owner cannot starve other owners' dispatches (reservation + admission timeout); over-deny-budget ⇒ worker killed.

### CI self-test gate
A CI job runs `runtime.init()` against the **release artifact** on (a) a userns-enabled host — must reach `available=true` and pass all 7 self-test steps including the canary; (b) a userns-disabled / no-pivot host — must yield `available=false` **without crashing**. The release is **blocked** if the canary/network/realm-scrub assertions do not hold, or if any broker-deny test (sudo/exec/fs.write for previews) regresses.

---

## 12. Residual risks & explicit "do NOT enable until"

### Honest statement: process isolation does NOT contain the confused-deputy RCE-on-target
The PIPS boundary protects the **panel host's secrets and other tenants**. It does **not** make it safe to grant an unreviewed preview `server.exec`/`server.sudo`/`server.fs.write`, because those capabilities are **mediated by the panel's own Executor against the connected tenant's production server**. A preview that obtained `exec`+`sudo` would run arbitrary root commands on that customer's server (read its `shared-secrets.json`, plant `authorized_keys`/cron, etc.) — the netns/seccomp/mount-scrub do nothing there. **Therefore the only safe default is to DENY `exec`/`sudo`/`fs.write` to previews entirely** (§6.1). This is a **policy** control, not an OS control, and it is load-bearing.

### Residual risks (accepted, documented)
- **R1 — Tier-1 fork pressure.** Without cgroup delegation, Tier-1 fork-bomb mitigation rests on per-child `setrlimit(RLIMIT_NPROC)`, which is per-uid (uid 1003 = the panel). A determined fork bomb could pressure the panel's process table before the 5 s deadline. *Mitigation if it bites:* require Tier 2 (cgroup `pids.max`) on affected hosts, or delegate a panel-owned cgroup at install.
- **R2 — In-child seccomp is best-effort on Tier 1.** No native addon ⇒ no BPF syscall filter on Tier 1; kernel syscall attack surface is reduced (no-new-privs, dropped bounding set, scrubbed mounts, empty netns) but not seccomp-filtered. Tier 2 closes this with `SystemCallFilter`.
- **R3 — Operator-granted `http` is an exfil channel** even with anti-SSRF (data can leave to an operator-approved public domain). Metered/audited, never silent.
- **R4 — Secrets remain in the panel process.** The cleanest containment of the confused-deputy class is to **move the panel's outbound secrets out of the backend process** (e.g. a separate broker process holding the mTLS key/`LUXIPANEL_KEY` and per-tenant Executors, reached over a local socket). PIPS does not require this, but it is the **only** control that would shrink the blast radius of a *panel-process* compromise itself. Recommended as a follow-on, out of scope here.

### Do NOT enable (`MODULE_DEV_PREVIEW_ENABLED=true` / `PREVIEW_SANDBOX_ENABLED=true`) until ALL hold:
1. Self-test **canary** (step 3) proves **structural** secret denial (EACCES/ENOENT because the path is not in the namespace) on the target host — i.e. `pivot_root` is established. If not, `available=false`; do not enable.
2. Network self-test (step 4) yields **ENETUNREACH/EAFNOSUPPORT**, never `ECONNREFUSED`, through the exact production builder.
3. Realm-scrub + **whole-environ subset** (step 2) and **fd ⊆ {0,1,2,3}** pass.
4. Broker proven (step 7 + integration) to **DENY `server.exec`/`server.sudo`/`server.fs.write` to previews by default**, with widening possible **only** via an operator-written per-(owner,module) policy sidecar outside `installedDir`.
5. Storage proven namespaced to `preview:<owner>:<id>` (never `community:<id>`).
6. Stale/cross-tenant executor reuse proven impossible (epoch re-check per capCall; queued-dispatch scope guard).
7. Orphan reaping proven (panel SIGKILL leaves no surviving jailed worker — `PR_SET_PDEATHSIG` + cgroup.kill; `init()` re-scan).
8. CI self-test gate green on the **release artifact**, including the userns-disabled host yielding `available=false` without crashing.

Until every box is checked, `isAvailable()` stays `false` and `dispatchPreviewTool` throws the existing `ForbiddenError` — the current, correct, fail-closed state.