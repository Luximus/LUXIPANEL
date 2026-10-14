// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — capability broker (Phase F3): the single, auditable trust surface.
 *
 * The sandboxed child holds NO `Executor`, NO secret and NO network route. Its
 * `ctx.server.*` / `ctx.storage.*` / `ctx.http.fetch` shims merely emit a
 * `capCall` frame on fd 3 and block on the `capResult`. EVERY authorization
 * decision happens HERE, panel-side, in one exhaustive `switch (cap)` whose
 * `default` is DENY, with a per-deny audit log.
 *
 * This broker is STRICTER than `module-sdk`'s `buildCtx` (RUNTIME-DESIGN §6.1).
 * `buildCtx` is an unconfined bridge for HUMAN-REVIEWED modules: it runs
 * arbitrary `server.exec`/`server.sudo`/`server.fs.write` gated only by the
 * author's own manifest. Reusing it for an UNREVIEWED preview is exactly the
 * confused-deputy RCE-on-target the design forbids. Therefore previews are
 * DENIED `exec`/`sudo`/`fs.write` unconditionally; `fs.read` is path-confined;
 * `storage` is namespaced `preview:<ownerUserId>:<moduleId>`; `http` is DENY
 * unless an operator sidecar opts in, behind resolve-then-pin anti-SSRF.
 *
 * We import the `Capability` TYPE from `module-sdk` so the closed set never
 * drifts. The allowlist matcher semantics come from `shared/net/host-allowlist.ts`
 * — the SAME code the in-process `module-sdk` path runs (it used to be a
 * hand-maintained "faithful copy" here); only the preview-specific error wording
 * stays local. Likewise the anti-SSRF resolve→screen→pin routine is the shared
 * `shared/net/resolve-host.ts`.
 *
 * Ver `RUNTIME-DESIGN.md` §6 (mediación), §8 (matriz fail-closed), §12 (riesgos).
 */
import type dns from "node:dns";
import path from "node:path";
import type { Capability } from "../module-sdk/index.js";
import { checkUrlAllowlisted } from "../net/host-allowlist.js";
import { resolveAndPinHost, type HostBlockReason } from "../net/resolve-host.js";
import { isPathUnder } from "../utils/path-containment.js";
import type { Executor } from "../executor/types.js";
import { getContextExecutor, runWithExecutor } from "../executor/context.js";
import { kv } from "../kv-store/index.js";
import { createModuleLogger } from "../logger/index.js";
import { panelConfigDir } from "../../config/paths.js";
import { env } from "../../config/env.js";
import type { SessionUser } from "../types/index.js";

const log = createModuleLogger("preview-sandbox:broker");

/**
 * Injectable accessor for the runtime's monotonic session epoch (RUNTIME-DESIGN
 * §6.2 step 1, §6.5, matrix row 17). The broker must NOT import `runtime.ts`
 * (that would create an import cycle: runtime → broker → runtime), so the runtime
 * INJECTS its `currentEpoch` reader here at bootstrap. Until injected, the getter
 * returns `NaN` so that `session.sessionEpoch !== currentEpoch()` is ALWAYS true
 * ⇒ every capCall is DENIED — fail-closed by construction (a broker wired before
 * the epoch source is one that authorizes nothing).
 */
let currentEpochGetter: () => number = () => Number.NaN;
export function setSessionEpochSource(getter: () => number): void {
  currentEpochGetter = getter;
}
function currentEpoch(): number {
  return currentEpochGetter();
}

/** Closed set of capabilities, mirrors `module-sdk`'s `Capability`. */
const KNOWN_CAPS: ReadonlySet<string> = new Set<Capability>([
  "server.exec",
  "server.sudo",
  "server.fs.read",
  "server.fs.write",
  "storage",
  "http",
]);

/** Method whitelist per capability (RUNTIME-DESIGN §6.2 step 3). */
const METHOD_WHITELIST: Record<string, ReadonlySet<string>> = {
  "server.exec": new Set(["exec"]),
  "server.fs.read": new Set(["readFile", "readdir", "stat"]),
  "server.fs.write": new Set(["writeFile", "mkdir", "rename", "unlink"]),
  storage: new Set(["get", "set", "list", "delete"]),
  http: new Set(["fetch"]),
  // server.sudo carries no methods of its own (it modifies exec); always DENY.
};

/**
 * Capabilities a preview may EVER exercise, regardless of what its manifest or
 * an operator sidecar declares. `exec`/`sudo`/`fs.write` are NEVER in this set:
 * those are mediated against the connected tenant's production server and the
 * OS boundary does nothing for them (RUNTIME-DESIGN §12 — policy is load-bearing).
 */
const PREVIEW_HARD_DENY: ReadonlySet<Capability> = new Set<Capability>([
  "server.exec",
  "server.sudo",
  "server.fs.write",
]);

/**
 * Absolute-path prefixes a preview's `fs.read` may NEVER touch even within its
 * operator read-prefix (defense in depth — secrets / persistence / creds).
 */
const FS_READ_BLOCKLIST: readonly string[] = [
  panelConfigDir(),
  "/etc/nginx/certs",
  "/etc/sudoers",
  "/etc/cron",
  "/var/spool/cron",
  "/root/.ssh",
];

/** Effective, frozen policy authorizing a single dispatch. */
export interface EffectivePolicy {
  /** The operator∩manifest capability set (author can only ever narrow). */
  capabilities: Set<Capability>;
  /** Operator-approved http allowlist host patterns. */
  http_allowlist: string[];
  /** Operator-set absolute read-prefix for `fs.read` (undefined ⇒ no read). */
  readPrefix?: string;
  /** Operator-named exec commands (NEVER honoured for previews; kept for audit). */
  execCommands?: string[];
}

/**
 * A request-bound session captured at `dispatch()` entry. The executor identity
 * and epoch are re-asserted on EVERY capCall so a queued/in-flight dispatch can
 * never be serviced after its originating request scope unwound or the session
 * logged out (RUNTIME-DESIGN §6.2 step 1, §6.5, matrix rows 17/18).
 */
export interface BrokerSession {
  executor: Executor;
  user: SessionUser | null;
  /** Monotonic epoch of the originating session; changes on logout/dispose. */
  sessionEpoch: number;
  owner: string;
  ownerUserId: string;
  moduleId: string;
  effectivePolicy: EffectivePolicy;
  /** sha256 of the frozen manifest the broker authorizes against. */
  manifestHash: string;
}

export interface CapCall {
  callId: number;
  cap: string;
  method: string;
  args: unknown;
}

export interface CapResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  code?: string;
}

/** Operator opt-in shape (sidecar; see preview-policy.repository.ts). */
export interface OperatorPolicy {
  capabilities?: Capability[];
  http_allowlist?: string[];
  readPrefix?: string;
  exec?: { commands: string[] };
}

/** Minimal manifest view the broker freezes/AND-s against. */
export interface FrozenManifest {
  capabilities?: Capability[];
  http_allowlist?: string[];
}

/**
 * `effectivePolicy = operatorPolicy ∩ frozenManifest.capabilities` — the author
 * can only ever NARROW, never widen (RUNTIME-DESIGN §6.1). With no operator
 * sidecar, the default table (read + storage, both still subject to the hard
 * deny on exec/sudo/fs.write) is the whole policy.
 */
export function buildEffectivePolicy(
  operator: OperatorPolicy | null,
  manifest: FrozenManifest,
): EffectivePolicy {
  const manifestCaps = new Set<Capability>(manifest.capabilities ?? []);
  // Default-deny baseline: read + storage. The operator may add to this set,
  // but only within the manifest-declared caps (intersection below).
  const operatorCaps = new Set<Capability>(
    operator?.capabilities ?? ["server.fs.read", "storage"],
  );
  // Intersection: a capability is effective only if BOTH operator and author
  // declared it. (If no operator sidecar, operatorCaps is the safe baseline.)
  const effective = new Set<Capability>();
  for (const cap of operatorCaps) {
    if (manifestCaps.has(cap)) effective.add(cap);
  }
  // storage is the one preview-safe namespaced capability that does not require
  // a manifest grant to be useful and never escapes the namespace; allow it as
  // a baseline so a preview can persist its own state. (It is still subject to
  // the closed-set + method whitelist.)
  if (operatorCaps.has("storage")) effective.add("storage");

  // http allowlist is operator-owned (the author's manifest allowlist is never
  // trusted on its own for previews — §6.4). http is effective ONLY when the
  // operator AND the author both declared the `http` capability; the effective
  // host set is the operator's hosts intersected with the author's (author may
  // narrow, never widen). With no operator sidecar, http stays denied.
  const operatorHosts = operator?.http_allowlist ?? [];
  const manifestHosts = new Set((manifest.http_allowlist ?? []).map((h) => h.toLowerCase()));
  const effectiveHttp =
    operator && operatorCaps.has("http") && manifestCaps.has("http")
      ? operatorHosts.filter((h) => manifestHosts.has(h.toLowerCase()))
      : [];
  if (effectiveHttp.length) effective.add("http");

  return {
    capabilities: effective,
    http_allowlist: effectiveHttp,
    readPrefix: operator?.readPrefix,
    execCommands: operator?.exec?.commands,
  };
}

/**
 * Operator-allowlist gate. The matcher SEMANTICS are the shared ones in
 * `shared/net/host-allowlist.ts` (same code the in-process `module-sdk` path
 * runs, so the two can no longer drift — this used to be a hand-maintained
 * "faithful copy"). Only the preview-specific wording lives here. Throws on miss.
 */
function assertAllowlisted(allow: readonly string[], url: string): void {
  const { ok, host } = checkUrlAllowlisted(allow, url);
  if (host === null) throw new Error(`URL inválida: ${url}`);
  if (!ok) throw new Error(`host "${host}" no está en el allowlist del operador`);
}

/** Sanitize an error to {message, code} — never leak a host path or stack. */
function sanitizeError(err: unknown): { error: string; code: string } {
  const code =
    err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
      ? (err as { code: string }).code
      : "CAP_ERROR";
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "capability error";
  // Strip anything that looks like an absolute host path from the message.
  const scrubbed = message.replace(/\/[^\s"']+/g, "<path>");
  return { error: scrubbed, code };
}

function deny(session: BrokerSession, capCall: CapCall, why: string): CapResult {
  log.warn(
    {
      moduleId: session.moduleId,
      owner: session.owner,
      cap: capCall.cap,
      method: capCall.method,
      decision: "DENY",
      why,
    },
    "preview capability DENIED",
  );
  return { ok: false, error: `capability denied: ${why}`, code: "CAP_DENIED" };
}

// ── Anti-SSRF (RUNTIME-DESIGN §6.4) ───────────────────────────────────────────

/** Reject loopback / RFC1918 / CGNAT / link-local / ULA / mapped / unspecified /
 *  cloud metadata. Re-exported from the shared SSOT (`net/resolve-host.ts`) —
 *  the broker no longer owns a predicate of its own, so it cannot drift from the
 *  SSH-target host policy that used to declare a same-named private twin. */
export { isForbiddenAddress } from "../net/resolve-host.js";

/** Map the shared rejection reason to the broker's `SSRF:` wording. */
function throwPreviewSsrf(reason: HostBlockReason): never {
  switch (reason.kind) {
    case "empty":
      throw new Error("SSRF: empty hostname");
    case "unresolvable":
      throw new Error("SSRF: hostname could not be resolved");
    case "no-records":
      throw new Error("SSRF: hostname did not resolve to any address");
    default:
      throw new Error(
        "SSRF: resolved address is forbidden (loopback/private/metadata)",
      );
  }
}

/**
 * Resolve a hostname ONCE and return the address the socket must be pinned to.
 *
 * Uses the shared resolve→screen→pin routine, which is STRICTER than the
 * previous local copy: that one picked the first *non-forbidden* answer and
 * ignored the rest, so a record set mixing a public and a private address still
 * went through. Now ANY blocked answer rejects the request (an attacker cannot
 * hide a private A record behind a public one).
 */
async function resolvePinnedAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  const { pinnedAddress, family } = await resolveAndPinHost(hostname, {
    onBlocked: throwPreviewSsrf,
  });
  return { address: pinnedAddress!, family: family ?? 4 };
}

interface FetchInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Panel-side `http` request with resolve-then-pin SSRF defense. The request runs
 * in the panel (the child has no route). We use `node:https` with a custom
 * `lookup` so the TCP connect uses EXACTLY the vetted IP (no second DNS lookup —
 * closes the rebind TOCTOU) while TLS SNI + certificate validation still bind to
 * the real hostname. HTTPS-pinned; manual redirects re-vetted on every hop;
 * Authorization/Cookie stripped on any cross-origin hop. (RUNTIME-DESIGN §6.4.)
 *
 * Node's global `fetch` is NOT used here: it does not expose a per-request
 * `lookup`/`connect` hook without bundling undici, so pinning would be unsound.
 */
async function brokeredFetch(
  policy: EffectivePolicy,
  rawUrl: string,
  rawInit: unknown,
  maxOutput: number,
): Promise<{ status: number; headers: Record<string, string>; bodyB64: string }> {
  const https = await import("node:https");
  const MAX_HOPS = 5;
  let url = new URL(rawUrl);
  let init = sanitizeInit(rawInit);
  let origin = url.origin;

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (url.protocol !== "https:") throw new Error("SSRF: only https is allowed");
    assertAllowlisted(policy.http_allowlist, url.toString());
    const pinned = await resolvePinnedAddress(url.hostname);

    const result = await new Promise<{
      status: number;
      location: string | null;
      headers: Record<string, string>;
      body: Buffer;
    }>((resolve, reject) => {
      const req = https.request(
        {
          protocol: "https:",
          hostname: url.hostname, // SNI + cert validation use the real hostname
          servername: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: init.method,
          headers: init.headers,
          // Pin the vetted IP: the socket connects to EXACTLY this address.
          lookup: (_h: string, _o: dns.LookupOptions, cb: (e: Error | null, a: string, f: number) => void) =>
            cb(null, pinned.address, pinned.family),
          rejectUnauthorized: true,
          timeout: 10_000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let received = 0;
          res.on("data", (c: Buffer) => {
            received += c.length;
            // Cap the body to maxOutput + a small slack, then stop.
            if (received <= maxOutput + 65536) chunks.push(c);
            else res.destroy();
          });
          res.on("end", () => {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (typeof v === "string") headers[k] = v;
              else if (Array.isArray(v)) headers[k] = v.join(", ");
            }
            resolve({
              status: res.statusCode ?? 0,
              location: typeof res.headers.location === "string" ? res.headers.location : null,
              headers,
              body: Buffer.concat(chunks),
            });
          });
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy(new Error("request timeout"));
      });
      if (init.body) req.write(init.body);
      req.end();
    });

    // Manual redirect handling: re-vet every Location hop.
    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = new URL(result.location, url);
      if (next.origin !== origin) {
        init = stripCredentials(init); // never forward creds cross-origin
        origin = next.origin;
      }
      url = next;
      continue;
    }
    const capped = result.body.subarray(0, maxOutput);
    return { status: result.status, headers: result.headers, bodyB64: capped.toString("base64") };
  }
  throw new Error("SSRF: too many redirect hops");
}

function sanitizeInit(rawInit: unknown): FetchInit {
  const out: FetchInit = { method: "GET", headers: {} };
  if (!rawInit || typeof rawInit !== "object") return out;
  const src = rawInit as Record<string, unknown>;
  if (typeof src.method === "string" && /^(GET|HEAD|POST|PUT|PATCH|DELETE)$/i.test(src.method)) {
    out.method = src.method.toUpperCase();
  }
  if (src.headers && typeof src.headers === "object") {
    for (const [k, v] of Object.entries(src.headers as Record<string, unknown>)) {
      if (typeof v === "string") out.headers[k] = v;
    }
  }
  if (typeof src.body === "string") out.body = src.body;
  return out;
}

function stripCredentials(init: FetchInit): FetchInit {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(init.headers)) {
    const lk = k.toLowerCase();
    if (lk === "authorization" || lk === "cookie") continue;
    headers[k] = v;
  }
  return { ...init, headers };
}

// ── fs.read confinement ───────────────────────────────────────────────────────

function assertReadPathConfined(policy: EffectivePolicy, raw: string): string {
  if (typeof raw !== "string" || raw.includes("\0")) {
    throw new Error("invalid path");
  }
  const prefix = policy.readPrefix;
  if (!prefix) throw new Error("no operator read-prefix configured");
  // Resolve absolute; reject any traversal escape from the prefix.
  const abs = path.resolve(prefix, raw.startsWith("/") ? `.${raw}` : raw);
  if (!isPathUnder(prefix, abs, path.sep)) {
    throw new Error("path escapes operator read-prefix");
  }
  for (const blocked of FS_READ_BLOCKLIST) {
    if (isPathUnder(blocked, abs, path.sep)) {
      throw new Error("path is on the secret/cron/ssh blocklist");
    }
  }
  return abs;
}

// ── The single switch (default DENY) ──────────────────────────────────────────

/**
 * Authorize and execute ONE capCall for a dispatch. Returns a host-cloned,
 * sanitized result. Never throws on a denied capability (returns ok:false); only
 * the session-liveness abort signals the supervisor to tear the dispatch down.
 *
 * @param maxOutput byte cap for http bodies (from config); 0 ⇒ default 256 KiB.
 */
export async function handleCapCall(
  session: BrokerSession,
  capCall: CapCall,
  maxOutput = env.PREVIEW_SANDBOX_MAX_OUTPUT,
): Promise<CapResult> {
  // (1) Re-assert session liveness (RUNTIME-DESIGN §6.2 step 1, §6.5, matrix
  // row 17). The AUTHORITATIVE, scope-independent invariant is the EPOCH: if the
  // runtime's monotonic session epoch advanced since this dispatch was admitted
  // (logout / executor disposal / pool dispose bumps it), the session is revoked
  // ⇒ DENY + abort. This is the check that actually fires on logout, and it works
  // regardless of AsyncLocalStorage scope.
  //
  // CRITICAL: the broker runs from the pool-supervisor's `socket.on("data")` pump
  // callback, which was registered at WORKER SPAWN (panel-host scope), NOT inside
  // the originating request's `runWithExecutor` ALS scope. So `getContextExecutor()`
  // here is normally `null` (out of scope) — it is NOT the per-request executor.
  // Therefore the executor-identity check must NOT fail-close on a `null` context
  // (that would deny EVERY capCall in production). It is kept only as a positive
  // defense-in-depth: deny if the ambient executor is non-null AND differs (a real
  // cross-session bleed). The epoch above is what guarantees revocation.
  if (session.sessionEpoch !== currentEpoch()) {
    log.warn(
      { moduleId: session.moduleId, owner: session.owner, was: session.sessionEpoch },
      "preview capCall ABORTED — session epoch advanced (logout/dispose) ⇒ revoked",
    );
    return { ok: false, error: "session epoch stale", code: "SESSION_EPOCH_STALE" };
  }
  const ambient = getContextExecutor();
  if (ambient !== null && ambient !== session.executor) {
    log.warn(
      { moduleId: session.moduleId, owner: session.owner },
      "preview capCall ABORTED — ambient executor differs from captured session",
    );
    return { ok: false, error: "session executor changed", code: "SESSION_EXECUTOR_MISMATCH" };
  }

  const { cap, method } = capCall;

  // (2) Closed-set capability check.
  if (typeof cap !== "string" || !KNOWN_CAPS.has(cap)) {
    return deny(session, capCall, `unknown capability "${String(cap)}"`);
  }

  // (3) Method whitelist (server.sudo has none → always denied below).
  const methods = METHOD_WHITELIST[cap];
  if (!methods || typeof method !== "string" || !methods.has(method)) {
    return deny(session, capCall, `method "${String(method)}" not allowed for ${cap}`);
  }

  // (4) Effective-policy gate. Hard-deny exec/sudo/fs.write for previews
  // REGARDLESS of manifest or operator sidecar (load-bearing policy control).
  if (PREVIEW_HARD_DENY.has(cap as Capability)) {
    return deny(session, capCall, `${cap} is hard-denied for previews`);
  }
  if (!session.effectivePolicy.capabilities.has(cap as Capability)) {
    return deny(session, capCall, `${cap} not in effective policy`);
  }

  const args = capCall.args;

  try {
    // (6) Execute inside the captured executor's scope so storage/exec resolve
    // to the right per-server context.
    return await runWithExecutor(session.executor, async () => {
      switch (cap as Capability) {
        case "server.fs.read": {
          const a = (args ?? {}) as { path?: unknown; encoding?: unknown };
          const abs = assertReadPathConfined(session.effectivePolicy, String(a.path ?? ""));
          if (method === "readFile") {
            const enc = typeof a.encoding === "string" ? (a.encoding as BufferEncoding) : undefined;
            const data = await session.executor.readFile(abs, enc);
            const value =
              typeof data === "string" ? data : { $b64: Buffer.from(data).toString("base64") };
            return { ok: true, value };
          }
          if (method === "readdir") {
            const entries = await session.executor.readdir(abs);
            // Serialize host-side to plain JSON (strip Date etc.).
            return { ok: true, value: JSON.parse(JSON.stringify(entries)) };
          }
          // stat
          const st = await session.executor.stat(abs);
          return { ok: true, value: JSON.parse(JSON.stringify(st)) };
        }

        case "storage": {
          // Namespaced to preview:<ownerUserId>:<moduleId> — NEVER community:<id>.
          const store = kv(session.executor)
            .module(`preview:${session.ownerUserId}:${session.moduleId}`)
            .collection("data");
          const a = (args ?? {}) as { key?: unknown; value?: unknown };
          if (method === "get") {
            return { ok: true, value: await store.get(String(a.key ?? "")) };
          }
          if (method === "set") {
            const saved = await store.set(
              String(a.key ?? ""),
              (a.value ?? {}) as Record<string, unknown>,
            );
            return { ok: true, value: JSON.parse(JSON.stringify(saved)) };
          }
          if (method === "list") {
            return { ok: true, value: JSON.parse(JSON.stringify(await store.list())) };
          }
          // delete
          return { ok: true, value: await store.delete(String(a.key ?? "")) };
        }

        case "http": {
          const a = (args ?? {}) as { url?: unknown; init?: unknown };
          const result = await brokeredFetch(
            session.effectivePolicy,
            String(a.url ?? ""),
            a.init,
            maxOutput || env.PREVIEW_SANDBOX_MAX_OUTPUT,
          );
          return { ok: true, value: result };
        }

        // exec/sudo/fs.write are hard-denied above and never reach here.
        default:
          return deny(session, capCall, `${cap} reached executor switch (should be unreachable)`);
      }
    });
  } catch (err) {
    const { error, code } = sanitizeError(err);
    log.warn(
      { moduleId: session.moduleId, owner: session.owner, cap, method, code },
      "preview capCall failed",
    );
    return { ok: false, error, code };
  }
}
