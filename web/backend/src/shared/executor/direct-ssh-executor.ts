// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Direct SSH executor — runs commands and SFTP ops over ssh2 directly,
 * using credentials cached at /login time (no LP proxy involved).
 *
 * One ssh2 Client per executor instance, opened lazily on first use.
 */

import { closePersistentCache } from "../remote-cache/persistent-client.js";
import { forgetVersioned } from "../remote-cache/versioned-read.js";
import { Client, type SFTPWrapper } from "ssh2";
import { Duplex } from "node:stream";
import { Buffer } from "node:buffer";
import type {
  DirEntry,
  ExecOptions,
  ExecResult,
  Executor,
  FileStat,
  SftpBatchOperation,
  SftpBatchResult,
  WriteOptions,
} from "./types.js";
import type { SshConnectionMaterial } from "../../modules/auth/services/ssh-credentials-cache.service.js";
import { quoteArg } from "./quote.js";
import { EXEC_OUTPUT_MAX_BYTES } from "./constants.js";
import { SSH_CONNECT_TIMEOUT_MS } from "../constants.js";
import { createModuleLogger } from "../logger/index.js";
import { recordActivity } from "../worklog/worklog-recorder.service.js";

const log = createModuleLogger("direct-ssh-executor");

/** SSH handshake / channel-open timeout, in milliseconds (= 15 s). Applied to
 *  the ssh2 `readyTimeout` on connect and the exec-probe channel watchdog.
 *  SSOT: shared/constants.ts. */
const SSH_READY_TIMEOUT_MS = SSH_CONNECT_TIMEOUT_MS;

export class DirectSshExecutor implements Executor {
  readonly target: { id: string; name: string };
  private client: Client | null = null;
  private sftpClient: SFTPWrapper | null = null;
  private connecting: Promise<Client> | null = null;
  /** In-flight SFTP subsystem open, memoized like {@link connecting}. Without
   *  this, two concurrent kv reads each call `client.sftp()` and the second
   *  overwrites `this.sftpClient`, orphaning the first channel (a channel leak).
   */
  private sftpConnecting: Promise<SFTPWrapper> | null = null;
  /** Per-connection cache of whether the SFTP server advertises the OpenSSH
   *  `posix-rename@openssh.com` extension (atomic rename that OVERWRITES the
   *  destination). `null` = not yet probed. Set to `false` on a genuine
   *  "unsupported" throw so we skip straight to the `mv -f` fallback and never
   *  pay the synchronous throw again on this executor. Same server across
   *  reconnects → the capability doesn't change, so we keep the cache. */
  private posixRenameSupported: boolean | null = null;
  /** Wall-clock start of the live SSH session (worklog open/close pairing).
   *  Non-null only while a session is open and its close wasn't recorded. */
  private sessionStartedAt: number | null = null;

  constructor(targetId: string, targetName: string, private readonly mat: SshConnectionMaterial) {
    this.target = { id: targetId, name: targetName };
  }

  /** Linux username of this SSH session (scopes per-user bookkeeping). */
  get sshUsername(): string | undefined {
    return this.mat.username || undefined;
  }

  /**
   * Privilege-drop config when this is a SERVICE-key session (hosting login):
   * the owner to drop into + its HOME root. `null` for normal direct sessions.
   * Exposed so the factory can wrap with {@link PrivilegeDropExecutor} without
   * re-reading the cached material from Redis.
   *
   * SECURITY: the owner becomes an argv element of `sudo -u <owner>`; defence in
   * depth, re-validate it here against the SAME Linux-username grammar enforced
   * at hosting-account creation (`^[a-z][a-z0-9_-]{2,31}$`). The cached material
   * comes from Redis / a per-VPS sidecar; a tampered value MUST fail closed
   * rather than reach sudo, even though argv elements never hit a shell.
   */
  get privilegeDrop(): { owner: string; homeRoot: string; jailEnabled: boolean } | null {
    if (!this.mat.owner) return null;
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(this.mat.owner)) {
      throw new Error(`Invalid cached privilege-drop owner: ${JSON.stringify(this.mat.owner)}`);
    }
    return {
      owner: this.mat.owner,
      homeRoot: this.mat.homeRoot ?? `/home/${this.mat.owner}`,
      // Track 2: interactive-shell jail flag. The factory passes it to the
      // PrivilegeDropExecutor; env.JAIL_SHELL_ENABLED is the global gate.
      jailEnabled: this.mat.jailEnabled === true,
    };
  }

  /**
   * Panel/user this session's measured bytes belong to, for usage reporting to
   * LP. Null when the cached material predates metering (no accessSubdomain) —
   * those sessions simply aren't reported.
   */
  get usageAttribution(): { accessSubdomain: string; linuxUsername: string } | null {
    const accessSubdomain = this.mat.accessSubdomain;
    if (!accessSubdomain) return null;
    return { accessSubdomain, linuxUsername: this.mat.username };
  }

  /**
   * The login passphrase for this session — also valid as the `sudo -S`
   * password on the target (LP's one-passphrase model). Read live from this
   * instance's connection material so it stays scoped to the operator who
   * opened the session. Returns `undefined` for a key with no passphrase.
   */
  getSudoPasswordHint(): string | undefined {
    // One-passphrase model: the key passphrase doubles as the sudo password.
    // For password-auth targets the login password serves the same role.
    return this.mat.passphrase || this.mat.password || undefined;
  }

  /**
   * Validate that `password` is the actual Linux password of `username` on THIS
   * managed server — used before generating a login keypair so the private key
   * isn't encrypted with the wrong passphrase. Mirrors the /login validator:
   *   1) open a password-auth SSH connection as `username@host` (PAM-equivalent);
   *   2) if the server denies password auth ("All configured authentication
   *      methods failed"), fall back to `su <username> -c true` over a PTY on
   *      the already-open admin connection — works for any account.
   * Returns true on match, false on mismatch. Fails CLOSED (false) whenever the
   * password cannot be verified (su can't run / admin connection unavailable):
   * "could not verify" is NOT "verified", and treating it as valid would let an
   * unverified passphrase encrypt a login key. A transient inability makes the
   * caller retry rather than mint a key against an unproven password.
   */
  async verifyAccountPassword(username: string, password: string): Promise<boolean> {
    if (!/^[a-z_][a-z0-9_-]*\$?$/.test(username)) return false;
    if (!password) return false;
    const { host, port } = this.mat;

    const passwordAuth = await new Promise<boolean | "denied">((resolve) => {
      const c = new Client();
      let settled = false;
      const finish = (v: boolean | "denied") => { if (settled) return; settled = true; try { c.end(); } catch { /* ignore */ } resolve(v); };
      c.on("ready", () => finish(true));
      c.on("error", (err) => {
        const msg = (err as { message?: string }).message ?? String(err);
        // Server doesn't allow password auth → can't decide here; fall back.
        finish(/All configured authentication methods failed/i.test(msg) ? "denied" : false);
      });
      try {
        c.connect({ host, port, username, password, readyTimeout: SSH_READY_TIMEOUT_MS, tryKeyboard: true, authHandler: ["password", "keyboard-interactive"] as never });
      } catch { finish(false); }
    });

    if (passwordAuth === true) return true;
    if (passwordAuth === false) return false;

    // Fallback: `su <user> -c true` over a PTY on the admin connection.
    try {
      const client = await this.connect();
      return await new Promise<boolean>((resolve) => {
        client.exec(`su ${username} -c 'exit 0'`, { pty: true }, (err, stream) => {
          if (err) { resolve(false); return; } // can't run su → fail-CLOSED (unverifiable ≠ valid)
          let out = ""; let sent = false; let settled = false;
          const done = (v: boolean) => { if (settled) return; settled = true; clearTimeout(timer); resolve(v); };
          const send = () => { if (sent) return; sent = true; try { stream.write(`${password}\n`); } catch { /* closed */ } };
          const onData = (chunk: Buffer) => { out += chunk.toString("utf8"); if (/password:/i.test(out)) send(); };
          stream.on("data", onData);
          stream.stderr.on("data", onData);
          stream.on("close", (code: number) => done(code === 0));
          stream.on("error", () => done(false));
          setTimeout(send, 500);
          const timer = setTimeout(() => { try { stream.close(); } catch { /* noop */ } done(false); }, SSH_READY_TIMEOUT_MS);
        });
      });
    } catch {
      return false; // admin connection unavailable → fail-CLOSED (unverifiable ≠ valid)
    }
  }

  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<Client>((resolve, reject) => {
      const client = new Client();
      let settled = false;
      const onReady = () => {
        if (settled) return;
        settled = true;
        log.debug({ host: this.mat.host, port: this.mat.port, user: this.mat.username }, "Direct SSH client ready");
        this.client = client;
        this.connecting = null;
        // After ready, swap the connect-only error handler for a permanent
        // one that logs but never throws — async ssh2 errors from completed
        // ops (e.g. SFTP "No such file") would otherwise crash the request.
        client.removeListener("error", onError);
        client.on("error", (err) => {
          log.warn({ host: this.mat.host, err: (err as Error).message }, "ssh2 client emitted error after ready");
        });
        client.on("close", () => {
          log.debug({ host: this.mat.host }, "ssh2 client closed");
          this.recordSessionClose();
          this.client = null;
          this.sftpClient = null;
          this.sftpConnecting = null;
        });
        // Worklog: significant access event. ssh2 callbacks run outside the
        // request ALS scope, so pass the attribution explicitly (fail-open:
        // unattributed sessions are simply not logged).
        this.sessionStartedAt = Date.now();
        const attr = this.usageAttribution;
        if (attr) {
          void recordActivity({
            module: "ssh",
            action: "session_open",
            category: "access",
            linuxUsername: attr.linuxUsername,
            accessSubdomain: attr.accessSubdomain,
          });
        }
        resolve(client);
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        this.connecting = null;
        reject(err);
      };
      client.on("ready", onReady);
      client.on("error", onError);
      // Key auth when a private key is present; otherwise password auth (used by
      // the assistant's locally-registered servers). ssh2 needs the key path to
      // omit `password` entirely, so branch the auth fields.
      const authFields = this.mat.privateKeyPem
        ? { privateKey: this.mat.privateKeyPem, passphrase: this.mat.passphrase || undefined }
        : { password: this.mat.password, tryKeyboard: true as const };
      // Opt-in TOFU host-key pinning: only when the material carries an
      // expected fingerprint (standalone target vault). Absent (managed flow)
      // ⇒ no hostVerifier, byte-identical to the legacy connect. On mismatch
      // we FAIL CLOSED (verify(false) → ssh2 aborts the handshake).
      const expected = this.mat.expectedHostFingerprint;
      const hostKeyFields = expected
        ? {
            hostHash: "sha256" as const,
            hostVerifier: (hashedKey: Buffer | string): boolean => {
              const hex = typeof hashedKey === "string" ? hashedKey : hashedKey.toString("hex");
              const ok = hex === expected;
              if (!ok) {
                log.error(
                  { host: this.mat.host, expected, got: hex },
                  "Host key fingerprint MISMATCH — refusing SSH connection",
                );
              }
              return ok;
            },
          }
        : {};
      client.connect({
        host: this.mat.host,
        port: this.mat.port,
        username: this.mat.username,
        ...authFields,
        ...hostKeyFields,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        keepaliveInterval: 30_000,
      });
    });
    return this.connecting;
  }

  private async sftp(): Promise<SFTPWrapper> {
    if (this.sftpClient) return this.sftpClient;
    // Deduplicate concurrent opens (mirrors `connect()`): a single in-flight
    // `client.sftp()` is shared by all callers so we never open two subsystems
    // and orphan the first.
    if (this.sftpConnecting) return this.sftpConnecting;
    this.sftpConnecting = (async () => {
      const client = await this.connect();
      return await new Promise<SFTPWrapper>((resolve, reject) => {
        client.sftp((err, sftp) => {
          if (err) {
            this.sftpConnecting = null;
            return reject(err);
          }
          // Attach a permanent error listener so async SFTP failures
          // (e.g. "No such file" after readFile) don't crash the process.
          (sftp as unknown as { on(event: string, cb: (err: Error) => void): void }).on("error", (sftpErr: Error) => {
            log.warn({ err: sftpErr.message }, "SFTP error event swallowed");
          });
          (sftp as unknown as { on(event: string, cb: () => void): void }).on("close", () => {
            this.sftpClient = null;
            this.sftpConnecting = null;
          });
          this.sftpClient = sftp;
          this.sftpConnecting = null;
          resolve(sftp);
        });
      });
    })();
    return this.sftpConnecting;
  }

  get cacheTransportIdentity(): object { return this; }

  async openCacheStream(port: number): Promise<Duplex> {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid cache port");
    const client = await this.connect();
    return new Promise((resolve, reject) => {
      client.forwardOut("127.0.0.1", 0, "127.0.0.1", port, (error, channel) => {
        if (error) reject(error); else resolve(channel);
      });
    });
  }

  async exec(cmd: string, opts: ExecOptions = {}): Promise<ExecResult> {
    const client = await this.connect();
    const startedAt = Date.now();
    const timeoutMs = opts.timeoutMs;
    return new Promise<ExecResult>((resolve, reject) => {
      client.exec(cmd, (err, stream) => {
        if (err) return reject(err);
        // Cap accumulated stdout/stderr so a `cat` of a huge log or a `find /`
        // can't buffer unbounded in the panel heap and OOM-kill the process
        // (parity with localExecutor's `maxBuffer: 10MB`). We collect Buffer
        // chunks (no repeated string concat) and stop reading once EITHER stream
        // reaches the cap, closing the channel and marking the result truncated.
        const outChunks: Buffer[] = []; let outLen = 0;
        const errChunks: Buffer[] = []; let errLen = 0;
        let truncated = false;
        let settled = false;
        const enforceCap = () => {
          if (truncated) return;
          if (outLen >= EXEC_OUTPUT_MAX_BYTES || errLen >= EXEC_OUTPUT_MAX_BYTES) {
            truncated = true;
            log.warn(
              { host: this.mat.host, outLen, errLen },
              "exec output exceeded 10MB cap — truncating and closing channel",
            );
            try { stream.close(); } catch { /* ignore */ }
          }
        };
        // Enforce timeoutMs: ssh2 has no native exec timeout, so we arm a timer
        // that kills the remote process (SIGTERM, then closes the channel) and
        // rejects. Without this a hung scanner/timedatectl would block the
        // request until the proxy/HTTP timeout (consumers like scanners.service
        // and system.controller now DEPEND on this firing).
        let timer: NodeJS.Timeout | null = null;
        if (timeoutMs && timeoutMs > 0) {
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { stream.signal("TERM"); } catch { /* ignore */ }
            try { stream.close(); } catch { /* ignore */ }
            reject(new Error(`exec timed out after ${timeoutMs}ms`));
          }, timeoutMs);
          if (typeof timer.unref === "function") timer.unref();
        }
        stream.on("data", (chunk: Buffer) => {
          if (outLen >= EXEC_OUTPUT_MAX_BYTES) return;
          outChunks.push(chunk); outLen += chunk.length; enforceCap();
        });
        stream.stderr.on("data", (chunk: Buffer) => {
          if (errLen >= EXEC_OUTPUT_MAX_BYTES) return;
          errChunks.push(chunk); errLen += chunk.length; enforceCap();
        });
        stream.on("close", (code: number) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          const stdout = Buffer.concat(outChunks).toString("utf8");
          let stderr = Buffer.concat(errChunks).toString("utf8");
          if (truncated) stderr += "\n[luxipanel: output truncated at 10MB]";
          resolve({ stdout, stderr, exitCode: code ?? 0, durationMs: Date.now() - startedAt });
        });
        stream.on("error", (e: Error) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          reject(e);
        });
      });
    });
  }

  async readFile(filePath: string, encoding: BufferEncoding = "utf-8"): Promise<string | Buffer> {
    const sftp = await this.sftp();
    return new Promise((resolve, reject) => {
      sftp.readFile(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(encoding ? data.toString(encoding) : data);
      });
    });
  }

  async writeFile(filePath: string, data: string | Buffer, opts: WriteOptions = {}): Promise<void> {
    const sftp = await this.sftp();
    const encoding = opts.encoding ?? "utf-8";
    const buf = typeof data === "string" ? Buffer.from(data, encoding) : data;
    await new Promise<void>((resolve, reject) => {
      // Pass `mode` to the underlying open() so a NEW file is created with the
      // requested bits from the start (no umask-derived 0644 window for secrets).
      const writeOpts = opts.mode !== undefined ? { mode: opts.mode } : undefined;
      const cb = (err: Error | null | undefined) => (err ? reject(err) : resolve());
      if (writeOpts) sftp.writeFile(filePath, buf, writeOpts, cb);
      else sftp.writeFile(filePath, buf, cb);
    });
    // open()'s mode is ignored by the kernel when the path already exists, so
    // chmod explicitly to enforce the mode on overwrite too (the documented
    // 0600 invariant for staged secrets must hold regardless of pre-existence).
    if (opts.mode !== undefined) {
      await new Promise<void>((resolve, reject) => {
        sftp.chmod(filePath, opts.mode as number, (err) => (err ? reject(err) : resolve()));
      });
    }
  }

  private buildDirEntry(name: string, fullPath: string, attrs: { mode: number; size: number | bigint; mtime: number | bigint; isDirectory(): boolean; isSymbolicLink(): boolean }): DirEntry {
    const mode = Number(attrs.mode ?? 0);
    return {
      name,
      path: fullPath,
      type: attrs.isDirectory() ? "dir" : attrs.isSymbolicLink() ? "symlink" : "file",
      isDir: attrs.isDirectory(),
      size: Number(attrs.size ?? 0),
      mode: (mode & 0o777).toString(8).padStart(3, "0"),
      mtime: new Date(Number(attrs.mtime ?? 0) * 1000),
      isReadable: Boolean(mode & 0o400),
      isWritable: Boolean(mode & 0o200),
      isHidden: name.startsWith("."),
      hasGit: false,
      gitStatus: null,
    };
  }

  async readdir(dirPath: string): Promise<DirEntry[]> {
    const sftp = await this.sftp();
    return new Promise((resolve, reject) => {
      sftp.readdir(dirPath, (err, list) => {
        if (err) return reject(err);
        resolve(list.map((entry) => this.buildDirEntry(entry.filename, `${dirPath.replace(/\/$/, "")}/${entry.filename}`, entry.attrs as never)));
      });
    });
  }

  async stat(filePath: string): Promise<FileStat> {
    const sftp = await this.sftp();
    return new Promise((resolve, reject) => {
      sftp.stat(filePath, (err, attrs) => {
        if (err) return reject(err);
        const name = filePath.split("/").filter(Boolean).pop() ?? filePath;
        resolve(this.buildDirEntry(name, filePath, attrs as never));
      });
    });
  }

  async mkdir(dirPath: string, opts: { recursive?: boolean } = {}): Promise<void> {
    if (opts.recursive) {
      // Use shell mkdir -p — sftp.mkdir doesn't support recursive natively.
      // Single-quote the path (quoteArg): JSON.stringify uses DOUBLE quotes,
      // which don't neutralize $()/backticks/${} — this is the one chokepoint
      // every recursive mkdir flows through, so harden it regardless of caller.
      await this.exec(`mkdir -p ${quoteArg(dirPath)}`);
      return;
    }
    const sftp = await this.sftp();
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(dirPath, (err) => (err ? reject(err) : resolve()));
    });
  }

  async unlink(filePath: string): Promise<void> {
    const sftp = await this.sftp();
    await new Promise<void>((resolve, reject) => {
      sftp.unlink(filePath, (err) => (err ? reject(err) : resolve()));
    });
  }

  async rename(from: string, to: string): Promise<void> {
    const sftp = await this.sftp();
    // Plain SFTPv3 `sftp.rename` FAILS when the destination already exists (no
    // overwrite semantics), which breaks the kv-store's atomic temp→target
    // replace for EXISTING sidecars. Prefer the OpenSSH `posix-rename` extension
    // — it maps to rename(2): atomic AND clobbers the destination. Fall back to
    // `mv -f` (also rename(2) under the hood) when the server doesn't advertise
    // the extension.
    const extRename = (sftp as unknown as {
      ext_openssh_rename?: (o: string, n: string, cb: (err?: Error | null) => void) => void;
    }).ext_openssh_rename;
    if (this.posixRenameSupported !== false && typeof extRename === "function") {
      try {
        await new Promise<void>((resolve, reject) => {
          // ext_openssh_rename throws SYNCHRONOUSLY when the server doesn't
          // announce the extension; that rejects this promise (caught below).
          extRename.call(sftp, from, to, (err) => (err ? reject(err) : resolve()));
        });
        this.posixRenameSupported = true;
        return;
      } catch (err) {
        const msg = (err as Error).message || "";
        // Only cache "unsupported" on the extension-absent throw — a transient
        // request error must not permanently disable the fast path. Either way
        // we fall through to `mv -f` for THIS call.
        if (/does not support/i.test(msg)) this.posixRenameSupported = false;
        log.debug({ err: msg }, "posix-rename unavailable/failed; falling back to mv -f");
      }
    }
    // Fallback: `mv -f` performs an atomic same-directory rename(2) and
    // overwrites the destination. quoteArg both operands (paths flow to a shell).
    const res = await this.exec(`mv -f ${quoteArg(from)} ${quoteArg(to)}`);
    if (res.exitCode !== 0) {
      throw new Error(`rename via 'mv -f' failed (exit ${res.exitCode}): ${res.stderr.trim()}`);
    }
  }

  spawn(cmd: string, args: string[]): Duplex {
    // We need an interactive PTY-attached shell so bash emits a prompt and
    // accepts user input. `client.exec(bash)` runs without a TTY and bash
    // never prints PS1, so the user only sees the "PTY conectada" banner.
    // Use `client.shell()` which allocates a PTY and returns a bidirectional
    // stream we proxy through `proxy` (Readable side feeds xterm, Writable
    // side accepts keystrokes from xterm).
    //
    // When an explicit command is requested (args non-empty — e.g. the
    // PrivilegeDropExecutor asking for `sudo -u <owner> -H -i`), we still open a
    // PTY but immediately `exec` that command so it REPLACES the login shell.
    // This is what makes privilege drop effective for interactive terminals:
    // without it, a hosting tenant would get a shell as the (sudo-capable)
    // service user. The replacement line runs over the PTY so sudo's password
    // prompt (if any) lands on this same stream — see PrivilegeDropExecutor.spawn,
    // which watches for it and feeds the passphrase.
    const execLine = args.length > 0 ? `exec ${[cmd, ...args].map(quoteArg).join(" ")}\n` : null;
    const proxy = new Duplex({
      read() {
        // Backpressure: if we paused the ssh channel because the consumer's
        // buffer filled, resume it now that the consumer is draining.
        if (shellStream && shellPaused && !shellEnded) {
          shellPaused = false;
          try { shellStream.resume(); } catch { /* ignore */ }
        }
      },
      write(chunk, _encoding, cb) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        if (shellStream && !shellEnded) {
          shellStream.write(data);
        } else {
          pendingInput.push(data);
        }
        cb();
      },
    }) as Duplex & {
      resize?: (cols: number, rows: number) => void;
      kill?: (signal?: string) => void;
    };

    let shellStream: import("ssh2").ClientChannel | null = null;
    let shellEnded = false;
    let shellPaused = false;
    const pendingInput: Buffer[] = [];
    let pendingResize: { cols: number; rows: number } | null = null;

    proxy.resize = (cols: number, rows: number) => {
      if (shellStream && !shellEnded) {
        try { shellStream.setWindow(rows, cols, 0, 0); } catch { /* ignore */ }
      } else {
        pendingResize = { cols, rows };
      }
    };

    proxy.kill = (signal = "SIGHUP") => {
      if (shellStream && !shellEnded) {
        try { shellStream.signal(signal as any); } catch { /* ignore */ }
        try { shellStream.end(); } catch { /* ignore */ }
      }
    };

    const wireStream = (stream: import("ssh2").ClientChannel) => {
      shellStream = stream;
      log.info({ host: this.mat.host, user: this.mat.username, hasExecLine: !!execLine }, "Terminal: SSH shell channel opened");

      // If an explicit command was requested, replace the login shell
      // with it FIRST (before draining buffered keystrokes) so privilege
      // drop takes effect before any user input reaches a prompt.
      if (execLine) {
        try { stream.write(execLine); } catch (e) { log.warn({ host: this.mat.host, err: (e as Error).message }, "Terminal: failed to write execLine"); }
      }

      // Drain anything xterm sent before the shell was ready.
      for (const chunk of pendingInput) stream.write(chunk);
      pendingInput.length = 0;
      if (pendingResize) {
        try { stream.setWindow(pendingResize.rows, pendingResize.cols, 0, 0); } catch { /* ignore */ }
        pendingResize = null;
      }

      // Honour the Duplex's backpressure: when push() returns false the
      // consumer's buffer is full, so pause the ssh channel until _read() runs.
      // A remote process flooding the PTY otherwise buffers unbounded in heap.
      stream.on("data", (chunk: Buffer) => {
        if (!proxy.push(chunk) && !shellEnded) {
          shellPaused = true;
          try { stream.pause(); } catch { /* ignore */ }
        }
      });
      (stream as any).stderr?.on?.("data", (chunk: Buffer) => {
        if (!proxy.push(chunk) && !shellEnded) {
          shellPaused = true;
          try { stream.pause(); } catch { /* ignore */ }
        }
      });
      // ssh2 emits "exit" with the remote process exit code/signal BEFORE close.
      (stream as any).on?.("exit", (code: number | null, signal?: string) => {
        log.info({ host: this.mat.host, code, signal }, "Terminal: remote shell exited");
      });
      stream.on("close", () => { shellEnded = true; proxy.push(null); });
      stream.on("end", () => { shellEnded = true; proxy.push(null); });
      stream.on("error", (e: Error) => {
        log.error({ host: this.mat.host, err: e.message }, "Terminal: SSH shell stream error");
        shellEnded = true;
        proxy.destroy(e);
      });
    };

    // Open the interactive shell, retrying ONCE on a fresh connection if the
    // first attempt fails. A cached SSH socket can go stale while idle (the
    // server dropped it, or keepalive lapsed) without `this.client` being
    // cleared, so the reused `client.shell()` fails immediately with "Not
    // connected" — surfacing to the user as "Sesión terminada (exit 1)" and an
    // apparent inability to connect. Dropping the dead client and reconnecting
    // recovers transparently.
    const openShell = async (attempt: number): Promise<void> => {
      let client: Client;
      try {
        client = await this.connect();
      } catch (err) {
        if (attempt === 0) {
          log.warn({ host: this.mat.host, err: (err as Error).message }, "Terminal: SSH connect failed — retrying with a fresh connection");
          this.invalidateClient();
          return openShell(attempt + 1);
        }
        log.error({ host: this.mat.host, err: (err as Error).message }, "Terminal: SSH connect failed after retry");
        proxy.destroy(err as Error);
        return;
      }
      client.shell({ term: "xterm-256color", cols: 80, rows: 24 }, (err, stream) => {
        if (err || !stream) {
          if (attempt === 0) {
            log.warn({ host: this.mat.host, err: err?.message }, "Terminal: shell() failed on a reused SSH connection — reconnecting");
            this.invalidateClient();
            void openShell(attempt + 1);
            return;
          }
          log.error({ host: this.mat.host, err: err?.message }, "Terminal: shell() failed after reconnect");
          proxy.destroy(err ?? new Error("Failed to open shell"));
          return;
        }
        wireStream(stream);
      });
    };

    void openShell(0);

    return proxy;
  }

  async batchSftp(operations: SftpBatchOperation[]): Promise<SftpBatchResult[]> {
    const results: SftpBatchResult[] = [];
    for (const op of operations) {
      try {
        if (op.op === "stat") {
          results.push({ id: op.id, op: op.op, ok: true, data: await this.stat(op.path) });
        } else if (op.op === "readFile") {
          const data = await this.readFile(op.path, op.encoding ?? "utf-8");
          results.push({ id: op.id, op: op.op, ok: true, data });
        } else if (op.op === "writeFile") {
          // Forward the requested `mode` so a batched writeFile enforces the
          // same POSIX bits as a single writeFile — a secret staged via batch
          // must NOT fall back to the umask-derived 0644. `undefined` mode keeps
          // the default (umask) behaviour untouched.
          await this.writeFile(op.path, op.data, { mode: op.mode });
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "readdir") {
          results.push({ id: op.id, op: op.op, ok: true, data: await this.readdir(op.path) });
        } else if (op.op === "mkdir") {
          await this.mkdir(op.path, { recursive: op.recursive });
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "unlink") {
          await this.unlink(op.path);
          results.push({ id: op.id, op: op.op, ok: true });
        } else if (op.op === "rename") {
          await this.rename(op.from, op.to);
          results.push({ id: op.id, op: op.op, ok: true });
        }
      } catch (err) {
        results.push({ id: op.id, op: op.op, ok: false, error: (err as Error).message });
      }
    }
    return results;
  }

  /** Worklog: record session_close ONCE per open session (close + dispose
   *  both land here; the null-guard makes it idempotent). Fail-open. */
  private recordSessionClose(): void {
    if (this.sessionStartedAt === null) return;
    const durationMin = Math.round(((Date.now() - this.sessionStartedAt) / 60_000) * 100) / 100;
    this.sessionStartedAt = null;
    const attr = this.usageAttribution;
    if (!attr) return;
    void recordActivity({
      module: "ssh",
      action: "session_close",
      category: "access",
      linuxUsername: attr.linuxUsername,
      accessSubdomain: attr.accessSubdomain,
      metrics: { durationMin },
    });
  }

  /** Drop the cached SSH client/SFTP so the next {@link connect} performs a
   *  fresh handshake. Used when a reused connection turns out to be dead — an
   *  idle socket whose keepalive lapsed still leaves `this.client` set, so
   *  `client.shell()` fails instantly with "Not connected". That was the
   *  "terminal says 'Sesión terminada' and won't connect" bug. */
  private invalidateClient(): void {
    try { this.sftpClient?.end(); } catch { /* ignore */ }
    try { this.client?.end(); } catch { /* ignore */ }
    this.sftpClient = null;
    this.sftpConnecting = null;
    this.client = null;
  }

  async dispose(): Promise<void> {
    forgetVersioned(this); closePersistentCache(this);
    // Record the session close before tearing the socket down. The "close"
    // handler also calls this; recordSessionClose is idempotent.
    this.recordSessionClose();
    try { this.sftpClient?.end(); } catch { /* ignore */ }
    try { this.client?.end(); } catch { /* ignore */ }
    this.sftpClient = null;
    this.sftpConnecting = null;
    this.client = null;
  }
}
