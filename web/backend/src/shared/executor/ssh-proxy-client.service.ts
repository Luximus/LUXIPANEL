// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSH proxy client — talks to LP-LICENSE-SERVER over HTTPS/WSS.
 */

import { Duplex } from "node:stream";
import WebSocket from "ws";
import path from "node:path";

import { env } from "../../config/env.js";
import { AuthError } from "../errors/index.js";
import { createModuleLogger } from "../logger/index.js";
import {
  agentsBaseUrl,
  postLicenseServerJson,
  licenseServerSocketTlsOptions,
} from "../license-server-tls.js";
import { getActive as getActiveSharedSecret } from "../../modules/secret-rotation/services/secret-store.service.js";
import type { ExecOptions, ExecResult, DirEntry, FileStat, WriteOptions, SftpBatchOperation, SftpBatchResult } from "./types.js";
import { errMessage } from "../utils/err-message.js";

type ProxyResponse<T> = {
  ok?: boolean;
  data?: T;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  message?: string;
};

const log = createModuleLogger("ssh-proxy-client");

type RawSftpAttrs = {
  size?: number;
  mode?: number;
  mtime?: number;
};

type RawSftpEntry = {
  filename?: string;
  longname?: string;
  attrs?: RawSftpAttrs;
  name?: string;
  path?: string;
  type?: "file" | "dir" | "symlink";
  isDir?: boolean;
  size?: number;
  mode?: string | number;
  mtime?: string | number | Date;
  isReadable?: boolean;
  isWritable?: boolean;
  isHidden?: boolean;
  hasGit?: boolean;
  gitStatus?: "new" | "modified" | "staged" | "deleted" | null;
};
type RawSftpListEntry = RawSftpEntry | string;
type RawBatchResult = {
  id: string;
  op: SftpBatchOperation["op"];
  ok: boolean;
  data?: unknown;
  error?: string;
};

const S_IFMT = 0o170000;
const S_IFDIR = 0o040000;
const S_IFLNK = 0o120000;

function toModeString(mode: number | undefined): string {
  if (typeof mode !== "number" || Number.isNaN(mode)) return "0000";
  return mode.toString(8).slice(-4).padStart(4, "0");
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    // SFTP mtime is usually epoch seconds.
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms);
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function detectType(mode: number | undefined, explicitIsDir?: boolean): DirEntry["type"] {
  if (explicitIsDir === true) return "dir";
  if (typeof mode !== "number") return "file";
  const kind = mode & S_IFMT;
  if (kind === S_IFDIR) return "dir";
  if (kind === S_IFLNK) return "symlink";
  return "file";
}

function normalizeDirEntry(entry: RawSftpListEntry, parentPath: string): DirEntry {
  if (typeof entry === "string") {
    const joinedPath = path.posix.join(parentPath, entry);
    return {
      name: entry,
      path: joinedPath,
      type: "file",
      isDir: false,
      size: 0,
      mode: "0000",
      mtime: new Date(),
      isReadable: true,
      isWritable: true,
      isHidden: entry.startsWith("."),
      hasGit: false,
      gitStatus: null,
    };
  }
  const name = (typeof entry.name === "string" && entry.name)
    || (typeof entry.filename === "string" && entry.filename)
    || "";
  const attrs = entry.attrs ?? {};
  const attrsMode = typeof attrs.mode === "number" ? attrs.mode : undefined;
  // A string `mode` is already a display string (passed through verbatim); a
  // numeric one is parsed octal for type detection and rendered for display.
  const entryMode = entry.mode;
  const rawMode = typeof entryMode === "number"
    ? entryMode
    : typeof entryMode === "string"
      ? Number.parseInt(entryMode, 8)
      : attrsMode;
  const mode = typeof entryMode === "string" ? entryMode : toModeString(rawMode);
  const type = detectType(rawMode, entry.isDir);
  const isDir = type === "dir";
  const fullPath = typeof entry.path === "string" && entry.path
    ? entry.path
    : path.posix.join(parentPath, name || ".");
  const size = typeof entry.size === "number"
    ? entry.size
    : typeof attrs.size === "number"
      ? attrs.size
      : 0;

  return {
    name,
    path: fullPath,
    type: entry.type ?? type,
    isDir,
    size,
    mode,
    mtime: toDate(entry.mtime ?? attrs.mtime),
    isReadable: entry.isReadable ?? true,
    isWritable: entry.isWritable ?? true,
    isHidden: entry.isHidden ?? name.startsWith("."),
    hasGit: entry.hasGit ?? false,
    gitStatus: entry.gitStatus ?? null,
  };
}

function normalizeFileStat(raw: Record<string, unknown>, filePath: string): FileStat {
  const entry = normalizeDirEntry(raw as RawSftpEntry, path.posix.dirname(filePath));
  const name = entry.name || path.posix.basename(filePath) || filePath;
  return {
    ...entry,
    name,
    path: filePath,
  };
}

// Base URL for agent API calls. Uses LICENSE_SERVER_AGENTS_URL when set so
// calls bypass external proxies (Cloudflare) and stay within the IP allowlist
// LP-LS enforces on /api/agents/* endpoints. Falls back to LICENSE_SERVER_URL.
//
// SSOT: `shared/license-server-tls.ts#agentsBaseUrl` (its docstring already
// named this file as the copy to delete). Re-exported instead of re-derived so
// the trailing-slash normalization can no longer diverge (this copy stripped a
// SINGLE trailing slash, the canonical one strips them all, so a configured
// value ending in `//` produced two different base URLs).
export { agentsBaseUrl };

function proxyHeaders(): Record<string, string> {
  // Lee primero del shared-secret store (rotación push). Si está vacío
  // (boot temprano o reinstalación), cae al env como bootstrap.
  const activeFromStore = getActiveSharedSecret("luxipanel_key");
  const key = activeFromStore || env.LUXIPANEL_KEY;
  if (!key) {
    throw new AuthError("LUXIPANEL_KEY is required for SSH proxy operations");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Per-SESSION cache of the target's sudo passphrase (fetched from LP). Keyed
// by sessionId — which is per operator session, NOT the shared server id — so
// one operator's passphrase can never be served to another. Short TTL keeps
// the value fresh while avoiding an LP round-trip on every privileged command.
const sudoPassphraseCache = new Map<string, { value: string | null; expiresAt: number }>();
const SUDO_PASSPHRASE_TTL_MS = 5 * 60 * 1000;

async function proxyJson<T>(path: string, body: unknown, timeoutMs = env.SSH_PROXY_TIMEOUT_MS): Promise<T> {
  const startedAt = Date.now();
  const sessionId = typeof body === "object" && body && "sessionId" in body ? String((body as { sessionId?: unknown }).sessionId ?? "") : "";
  log.debug({ path, sessionId }, "SSH proxy request started");

  let lastError: unknown;
  let json: ProxyResponse<T> | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      json = await postLicenseServerJson<ProxyResponse<T>>(
        path,
        body,
        timeoutMs,
        proxyHeaders(),
        agentsBaseUrl(),
      );
      break;
    } catch (err) {
      lastError = err;
      const message = errMessage(err);
      // A pooled keep-alive socket can be closed by LP/nginx between
      // requests; reusing it surfaces as ECONNRESET / "socket hang up".
      // These are safe to retry once on idempotent kv ops — the request
      // never reached LP. The keep-alive agent then dials a fresh socket.
      const retryable = message.includes("Connection lost before handshake")
        || message.includes("License server request timed out")
        || message.includes("ECONNRESET")
        || message.includes("socket hang up")
        || message.includes("EPIPE");
      if (!retryable || attempt === 2) {
        throw err;
      }
      log.warn({ path, sessionId, attempt, err: message }, "SSH proxy transient failure, retrying once");
      await wait(250);
    }
  }
  if (!json) {
    throw (lastError instanceof Error ? lastError : new Error("SSH proxy request failed"));
  }
  if (json.ok === false) {
    throw new AuthError(json.message ?? "SSH proxy request failed");
  }
  log.info({
    path,
    sessionId,
    durationMs: Date.now() - startedAt,
    ok: true,
  }, "SSH proxy request completed");
  if (json.data !== undefined) return json.data;
  return json as T;
}

class WebSocketDuplex extends Duplex {
  private readonly ws: WebSocket;
  closed = false;

  constructor(
    url: string,
    private readonly opts: { ignoreTextMessages?: boolean } = {},
  ) {
    super();
    // mTLS for the outbound WS MUST mirror the HTTP path: present the client
    // cert/key when usable, and NEVER pass the internal `ca` — doing so
    // replaces Node's default trust store and breaks verification of LP's
    // PUBLIC server cert, instantly closing the socket. That surfaced as the
    // terminal "Sesión terminada (exit 1)" with no other error.
    this.ws = new WebSocket(url, {
      headers: proxyHeaders(),
      ...licenseServerSocketTlsOptions(),
    });

    this.ws.on("open", () => this.emit("open"));
    this.ws.on("message", (data) => {
      if (typeof data === "string") {
        if (this.opts.ignoreTextMessages) {
          try {
            const parsed = JSON.parse(data) as { type?: string; message?: string };
            if (parsed.type === "error") {
              this.destroy(new Error(parsed.message ?? "Remote stream error"));
            }
          } catch {
            // ignore control frames
          }
          return;
        }
        this.push(Buffer.from(data));
        return;
      }
      if (data instanceof Buffer) {
        this.push(data);
        return;
      }
      if (ArrayBuffer.isView(data)) {
        this.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
        return;
      }
      this.push(Buffer.from(data as ArrayBuffer));
    });
    this.ws.on("close", (code, reason) => {
      if (code && code !== 1000 && code !== 1005) {
        log.warn({ url, code, reason: reason?.toString() }, "Remote stream WS closed abnormally");
      }
      this.closed = true;
      this.push(null);
    });
    this.ws.on("error", (err) => {
      log.error({ url, err: (err as Error).message }, "Remote stream WS error");
      this.destroy(err);
    });
  }

  _read(): void {}

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      callback(new Error("WebSocket is not open"));
      return;
    }
    this.ws.send(chunk, callback);
  }

  _final(callback: (error?: Error | null) => void): void {
    this.sendControl({ type: "eof" });
    this.ws.close();
    callback();
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    callback(error);
  }

  sendControl(payload: Record<string, unknown>): void {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }
}

export const sshProxyClient = {
  exec(sessionId: string, cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
    return proxyJson<ExecResult>("/api/agents/exec", { sessionId, cmd, opts }, opts.timeoutMs);
  },

  /**
   * Fetch the target's OS passphrase from LP so it can be injected as the
   * `sudo -S` password (LP's one-passphrase model). Cached per session.
   * Returns null when LP has no passphrase on file or the call fails — the
   * caller then degrades to `sudo -n` (NOPASSWD) / a UI prompt.
   */
  async getSudoPassphrase(sessionId: string): Promise<string | null> {
    const now = Date.now();
    const hit = sudoPassphraseCache.get(sessionId);
    if (hit && hit.expiresAt > now) return hit.value;
    let value: string | null = null;
    try {
      const data = await proxyJson<{ passphrase: string | null }>(
        "/api/agents/sudo-passphrase",
        { sessionId },
      );
      value = data?.passphrase ?? null;
    } catch (err) {
      log.warn({ sessionId, err: errMessage(err) }, "sudo passphrase fetch failed");
      value = null;
    }
    sudoPassphraseCache.set(sessionId, { value, expiresAt: now + SUDO_PASSPHRASE_TTL_MS });
    return value;
  },

  readFile(sessionId: string, filePath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    return proxyJson<string | Buffer>("/api/agents/sftp/readFile", { sessionId, path: filePath, encoding });
  },

  writeFile(sessionId: string, filePath: string, data: string | Buffer, opts: WriteOptions = {}): Promise<void> {
    return proxyJson<void>("/api/agents/sftp/writeFile", {
      sessionId,
      path: filePath,
      data: Buffer.isBuffer(data) ? data.toString("base64") : Buffer.from(data).toString("base64"),
      opts,
    }).then(() => undefined);
  },

  readdir(sessionId: string, filePath: string): Promise<DirEntry[]> {
    return proxyJson<RawSftpListEntry[]>("/api/agents/sftp/readdir", { sessionId, path: filePath }).then((entries) => {
      if (!Array.isArray(entries)) return [];
      return entries.map((entry) => normalizeDirEntry(entry ?? {}, filePath));
    });
  },

  stat(sessionId: string, filePath: string): Promise<FileStat> {
    return proxyJson<Record<string, unknown>>("/api/agents/sftp/stat", { sessionId, path: filePath })
      .then((raw) => normalizeFileStat(raw ?? {}, filePath));
  },

  mkdir(sessionId: string, filePath: string, opts: { recursive?: boolean } = {}): Promise<void> {
    // El contrato agents espera `recursive` en el nivel superior (anidarlo en
    // `opts` hacía que LP lo descartara y el mkdir nunca fuera recursivo →
    // "No such file" al crear rutas con padres inexistentes vía proxy).
    return proxyJson<void>("/api/agents/sftp/mkdir", {
      sessionId,
      path: filePath,
      recursive: opts.recursive === true,
    }).then(() => undefined);
  },

  unlink(sessionId: string, filePath: string): Promise<void> {
    return proxyJson<void>("/api/agents/sftp/unlink", { sessionId, path: filePath }).then(() => undefined);
  },

  rename(sessionId: string, from: string, to: string): Promise<void> {
    return proxyJson<void>("/api/agents/sftp/rename", { sessionId, from, to }).then(() => undefined);
  },

  sftpBatch(sessionId: string, operations: SftpBatchOperation[]): Promise<SftpBatchResult[]> {
    if (operations.length === 0) return Promise.resolve([]);

    const payloadOps = operations.map((op) => {
      if (op.op === "writeFile") {
        return {
          id: op.id,
          op: op.op,
          path: op.path,
          dataBase64: Buffer.isBuffer(op.data) ? op.data.toString("base64") : Buffer.from(op.data).toString("base64"),
          // Forward `mode` (when set) so a batched writeFile carries the same
          // POSIX bits the single-writeFile proxy path already sends via `opts`;
          // omitted when undefined so the remote keeps its default behaviour.
          ...(op.mode !== undefined ? { mode: op.mode } : {}),
        };
      }
      return op;
    });

    // Index the requested ops by id once (O(n)) so the per-result lookup below
    // is O(1) instead of an `operations.find()` scan per result (was O(n²)).
    const opById = new Map<string, SftpBatchOperation>();
    for (const op of operations) opById.set(op.id, op);

    return proxyJson<RawBatchResult[]>("/api/agents/sftp/batch", { sessionId, operations: payloadOps }).then((results) => {
      if (!Array.isArray(results)) return [];
      return results.map((result) => {
        if (!result?.ok) {
          return {
            id: String(result?.id ?? ""),
            op: (result?.op ?? "stat") as SftpBatchOperation["op"],
            ok: false,
            error: result?.error ?? "SFTP batch operation failed",
          } satisfies SftpBatchResult;
        }

        if (result.op === "readdir") {
          const batchOp = opById.get(result.id);
          const parentPath = batchOp?.op === "readdir" ? batchOp.path : "/";
          const entries = Array.isArray(result.data)
            ? result.data.map((entry) => normalizeDirEntry((entry ?? {}) as RawSftpListEntry, parentPath))
            : [];
          return { ...result, data: entries } satisfies SftpBatchResult;
        }

        if (result.op === "stat") {
          const batchOp = opById.get(result.id);
          const filePath = batchOp?.op === "stat" ? batchOp.path : "/";
          return {
            ...result,
            data: normalizeFileStat((result.data ?? {}) as Record<string, unknown>, filePath),
          } satisfies SftpBatchResult;
        }

        return result satisfies SftpBatchResult;
      });
    });
  },

  openShell(sessionId: string, opts: { tmuxName?: string } = {}): Duplex {
    log.info({ sessionId, tmux: Boolean(opts.tmuxName) }, "Opening remote shell stream");
    // `tmuxName` (opt-in) → el gateway de LP envuelve la shell en tmux (reattach).
    const tmuxParam = opts.tmuxName ? `&tmuxName=${encodeURIComponent(opts.tmuxName)}` : "";
    const stream = new WebSocketDuplex(
      `${agentsBaseUrl().replace(/^http/, "ws")}/api/agents/shell?sessionId=${encodeURIComponent(sessionId)}${tmuxParam}`,
    );
    const remoteShell = stream as unknown as Duplex & {
      resize?: (cols: number, rows: number) => void;
      kill?: (signal?: string) => void;
    };

    remoteShell.resize = (cols: number, rows: number) => {
      stream.sendControl({ type: "resize", cols, rows });
    };

    remoteShell.kill = (signal = "SIGHUP") => {
      stream.sendControl({ type: "signal", signal });
      stream.sendControl({ type: "eof" });
      stream.end();
    };

    return remoteShell;
  },

  openSftpStream(sessionId: string, filePath: string, mode: "read" | "write"): Duplex {
    log.info({ sessionId, filePath, mode }, "Opening remote SFTP stream");
    return new WebSocketDuplex(
      `${agentsBaseUrl().replace(/^http/, "ws")}/api/agents/sftp/stream?sessionId=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(filePath)}&mode=${encodeURIComponent(mode)}`,
      { ignoreTextMessages: true },
    );
  },
};
