import { randomUUID } from "node:crypto";
import path from "node:path";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Privilege-drop executor — wraps an inner {@link Executor} (a SERVICE-key
 * direct-SSH connection with sudo) and re-issues EVERY operation as the
 * hosting account's owner: `sudo -u <owner> -H …`.
 *
 * Why a wrapper and not a separate SSH class: the per-VPS service key is just
 * {@link SshConnectionMaterial}; we reuse {@link DirectSshExecutor} for the
 * transport and {@link wrapExecutorWithSudo} for password injection. This
 * outermost layer only rewrites the command/path semantics so the work runs
 * with the owner's identity + HOME (privilege drop), never as the (sudo-capable)
 * service user.
 *
 * Layering (inner → outer):
 *   DirectSshExecutor → wrapExecutorWithSudo (injects `sudo -S <pass>`) → THIS
 *
 * The sudo password injector at `wrapExecutorWithSudo` already rewrites a
 * command-position `sudo …` token — including `sudo -u <owner> …`, because its
 * regex matches the `sudo` token and the inserted prefix precedes the remaining
 * `-u <owner> -H …` flags verbatim (see shared/system/sudo-runtime.ts).
 * Therefore the `sudo -u …` lines this class emits get their `-S` password fed
 * transparently by the inner wrapper.
 *
 * IMPORTANT: file ops are NOT delegated to the inner SFTP (which would run as
 * the service user). Each is translated to a `sudo -u <owner>` shell command so
 * permissions and ownership reflect the owner, not the service account.
 */

import type { Duplex } from "node:stream";
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
import { quoteArg } from "./quote.js";
import { env } from "../../config/env.js";

/** Build the `sudo -u <owner> -H <args…>` argv prefix as a quoted command. */
export class PrivilegeDropExecutor implements Executor {
  private runtimeActor: string | null = null;
  configureHostingRuntime(actor: string): void {
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(actor)) throw new Error("Invalid hosting runtime actor");
    this.runtimeActor = actor;
  }
  readonly target: { id: string; name: string };

  /** Restricted modules may opt into a privileged service operation only after
   * validating the signed tenant envelope and the requested resource name. */
  trustedServiceExecutorFor(owner: string): Executor | null {
    return owner === this.tenantOwner ? this.inner : null;
  }

  /**
   * @param inner    sudo-wrapped direct executor on the SERVICE key.
   * @param owner    Linux username to drop into (the hosting account owner).
   * @param homeRoot HOME directory of `owner` (sets $HOME for dropped commands).
   * @param jailEnabled when true (and env.JAIL_SHELL_ENABLED), the INTERACTIVE
   *                 shell (`spawn`) drops via a login shell (`sudo -u owner -i`)
   *                 so the owner's jk_chrootsh login shell takes effect (chroot
   *                 jail). Track 1 ops (exec/readFile/…) are NEVER jailed.
   */
  constructor(
    private readonly inner: Executor,
    private readonly owner: string,
    private readonly homeRoot: string,
    private readonly jailEnabled: boolean = false,
    private readonly tenantOwner: string = owner,
  ) {
    // Preserve the inner target id so per-target permission checks still match.
    this.target = inner.target;
  }

  /** SSH login user of the underlying (service) connection. */
  get sshUsername(): string | undefined {
    return this.inner.sshUsername;
  }

  getSudoPasswordHint(): string | undefined | Promise<string | undefined> {
    return this.inner.getSudoPasswordHint?.();
  }

  /**
   * True cuando el shell INTERACTIVO (`spawn`) caerá en la login shell ENJAULADA
   * del owner (`sudo -u <owner> -i` → jk_chrootsh). En ese modo `spawn()` IGNORA
   * `cmd`/`args` (pasar un binario escaparía la jaula), así que el reattach tmux
   * NO debe intentarse: el comando tmux se descartaría y el probe `command -v tmux`
   * (ruta exec, nunca enjaulada) mentiría respecto al shell real. Espeja la rama
   * `jailed` de {@link spawn}.
   */
  get willJailInteractiveShell(): boolean {
    return !!this.runtimeActor || (this.jailEnabled && env.JAIL_SHELL_ENABLED);
  }

  /**
   * Common `sudo -u <owner> -H` prefix (command position). `-H` makes sudo set
   * $HOME from the owner's passwd entry. Must stay at a command position with
   * `sudo` as the first token so the sudo-password injector
   * (sudo-runtime.ts SUDO_AT_CMD_POS) recognises and `-S`-feeds it — do NOT
   * prepend env assignments here.
   */
  private dropPrefix(): string {
    return `sudo -u ${quoteArg(this.owner)} -H`;
  }

  /**
   * Wrap an arbitrary shell command so it runs as the owner via `sh -c`, with
   * `$HOME`/cwd pinned to `homeRoot` (belt-and-braces over sudo `-H`, covering
   * minimal sudo configs or odd passwd rows).
   */
  private dropShell(cmd: string): string {
    const body = `export HOME=${quoteArg(this.homeRoot)}; cd ${quoteArg(this.homeRoot)} 2>/dev/null || true; ${cmd}`;
    return `${this.dropPrefix()} sh -c ${quoteArg(body)}`;
  }

  async exec(cmd: string, opts?: ExecOptions): Promise<ExecResult> {
    if (this.runtimeActor) {
      // Customer environment/cwd must never affect the privileged supervisor
      // (LD_PRELOAD, PYTHONPATH, etc.). Apply them after entering the jail/UID.
      const variables = Object.entries(opts?.env ?? {}).map(([key, value]) => {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value.includes("\0")) throw new Error("Invalid command environment");
        return quoteArg(`${key}=${value}`);
      });
      let body = variables.length ? `/usr/bin/env -- ${variables.join(" ")} /bin/bash -c ${quoteArg(cmd)}` : cmd;
      if (opts?.cwd) body = `cd -- ${quoteArg(opts.cwd)} && ${body}`;
      const command = `sudo /usr/lib/luxipanel/hosting-shell --managed ${quoteArg(this.runtimeActor)} ${quoteArg(Buffer.from(body).toString("base64"))}`;
      return this.inner.exec(command, opts?.timeoutMs === undefined ? undefined : { timeoutMs: opts.timeoutMs });
    }
    return this.inner.exec(this.dropShell(cmd), opts);
  }

  async readFile(filePath: string, encoding: BufferEncoding = "utf-8"): Promise<string | Buffer> {
    if (this.runtimeActor) {
      const result = await this.exec(`set -o pipefail; cat -- ${quoteArg(filePath)} | base64 -w0`);
      if (result.exitCode !== 0) throw new Error("Jailed file read failed");
      const data = Buffer.from(result.stdout.trim(), "base64");
      return encoding ? data.toString(encoding) : data;
    }
    // Read raw bytes as base64 so binary survives the text channel, then decode.
    const res = await this.inner.exec(
      `${this.dropPrefix()} cat -- ${quoteArg(filePath)} | base64 -w0`,
    );
    if (res.exitCode !== 0) {
      throw new Error(`readFile(${filePath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
    const buf = Buffer.from(res.stdout.trim(), "base64");
    return encoding ? buf.toString(encoding) : buf;
  }

  async writeFile(filePath: string, data: string | Buffer, opts: WriteOptions = {}): Promise<void> {
    const encoding = opts.encoding ?? "utf-8";
    const buf = typeof data === "string" ? Buffer.from(data, encoding) : data;
    if (this.runtimeActor) {
      const temp = path.posix.join(path.posix.dirname(filePath), `.lxp-write-${randomUUID()}`);
      const check = async (command: string) => { const result = await this.exec(command); if (result.exitCode !== 0) throw new Error("Jailed file write failed"); };
      try {
        const chunkScript = "import os,sys,base64; flags=os.O_WRONLY|os.O_NOFOLLOW|(os.O_CREAT|os.O_EXCL if sys.argv[3]=='first' else os.O_APPEND); fd=os.open(sys.argv[1],flags,0o600); data=base64.b64decode(sys.argv[2],validate=True); f=os.fdopen(fd,'ab'); f.write(data); f.close()";
        for (let offset = 0; offset < Math.max(1, buf.length); offset += 16384) await check(`python3 -I -c ${quoteArg(chunkScript)} ${quoteArg(temp)} ${quoteArg(buf.subarray(offset, offset + 16384).toString("base64"))} ${offset === 0 ? "first" : "append"}`);
        const finish = "import os,sys; os.chmod(sys.argv[1],int(sys.argv[3],8),follow_symlinks=False); os.replace(sys.argv[1],sys.argv[2])";
        await check(`python3 -I -c ${quoteArg(finish)} ${quoteArg(temp)} ${quoteArg(filePath)} ${quoteArg((opts.mode ?? 0o600).toString(8))}`);
      } finally { await this.exec(`rm -f -- ${quoteArg(temp)}`).catch(() => undefined); }
      return;
    }
    const b64 = buf.toString("base64");
    // The file content must NOT travel through sudo's stdin: the sudo-password
    // injector feeds the password via `sudo -S` on stdin, which would collide
    // with piped data (this is the documented pipe-into-sudo hazard — see
    // shared/system/sudo-runtime.ts). And a `… | sudo -u …` token after a pipe
    // is NOT at a command position, so the injector wouldn't `-S`-feed it at all
    // → it would fail on password-sudo targets.
    //
    // Instead: stage the base64 to a service-user tmp file via the inner SFTP
    // writeFile (runs as the sudo-capable service user — fine, it's a tmp), then
    // a COMMAND-POSITION `sudo -u <owner>` decodes from the tmp file with a
    // redirect (separates the data from sudo's `-S` password stdin). The tmp is
    // removed unconditionally afterwards.
    const tmp = `/tmp/.lxp-drop-${randomUUID()}.b64`;
    // A restrictive requested mode (0600-class, no group/other bits) means the
    // payload is a secret, so the staging tmp must NEVER be group/world-readable.
    const isSecret = opts.mode !== undefined && (opts.mode & 0o077) === 0;

    if (isSecret) {
      // The service account stages content; only the customer UID opens the
      // destination. A customer-controlled symlink can never redirect root.
      await this.inner.writeFile(tmp, b64, { encoding: "utf-8", mode: 0o600 });
      try {
        const handoff = await this.inner.exec(`sudo chown ${quoteArg(this.owner)} ${quoteArg(tmp)}`);
        if (handoff.exitCode !== 0) throw new Error("Secret staging handoff failed");
        const octal = (opts.mode! & 0o777).toString(8).padStart(4, "0");
        const body = `umask 077; base64 -d < ${quoteArg(tmp)} > ${quoteArg(filePath)} && chmod ${octal} ${quoteArg(filePath)}`;
        const res = await this.inner.exec(`${this.dropPrefix()} sh -c ${quoteArg(body)}`);
        if (res.exitCode !== 0) throw new Error(`writeFile failed as ${this.owner}`);
      } finally { await this.inner.exec(`sudo rm -f ${quoteArg(tmp)}`).catch(() => undefined); }
      return;
    }

    // Non-secret path (unchanged): the tmp holds only base64 the panel already
    // has in memory. The tmp is owned by the service user; the owner must be
    // able to READ it, so mark it world-readable so the dropped `base64 -d < tmp`
    // succeeds regardless of the service user's umask. chmod by the service user
    // needs no sudo (it owns the file). Run as a single non-sudo command so the
    // injector leaves it untouched.
    await this.inner.writeFile(tmp, b64, { encoding: "utf-8" });
    await this.inner.exec(`chmod 0644 ${quoteArg(tmp)}`).catch(() => undefined);
    // base64 -d reads the tmp; the owner's shell redirects decoded bytes into
    // the target so the file is created/owned by `owner`. tmp paths are
    // generated here (no metacharacters) but quoted for uniformity.
    const body = `base64 -d < ${quoteArg(tmp)} > ${quoteArg(filePath)}`;
    const res = await this.inner.exec(`${this.dropPrefix()} sh -c ${quoteArg(body)}`);
    // Honour a non-restrictive requested mode on the final file too (owner owns
    // it, so chmod runs under the drop prefix without sudo).
    if (opts.mode !== undefined && res.exitCode === 0) {
      const octal = (opts.mode & 0o777).toString(8).padStart(4, "0");
      await this.inner.exec(`${this.dropPrefix()} chmod ${octal} ${quoteArg(filePath)}`).catch(() => undefined);
    }
    await this.inner.unlink(tmp).catch(() => undefined);
    if (res.exitCode !== 0) {
      throw new Error(`writeFile(${filePath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
  }

  async readdir(dirPath: string): Promise<DirEntry[]> {
    // One `find -printf` per directory: name, type letter, size, mtime epoch, mode octal.
    const res = await (this.runtimeActor ? this.exec.bind(this) : this.inner.exec.bind(this.inner))(
      `${this.runtimeActor ? "" : this.dropPrefix()} find ${quoteArg(dirPath)} -maxdepth 1 -mindepth 1 -printf '%f\\t%y\\t%s\\t%T@\\t%m\\n'`,
    );
    if (res.exitCode !== 0) {
      throw new Error(`readdir(${dirPath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
    const base = dirPath.replace(/\/$/, "");
    const entries: DirEntry[] = [];
    for (const line of res.stdout.split("\n")) {
      if (!line) continue;
      const [name, typeLetter, sizeStr, mtimeStr, modeStr] = line.split("\t");
      if (name === undefined) continue;
      entries.push(this.toDirEntry(name, `${base}/${name}`, typeLetter, sizeStr, mtimeStr, modeStr));
    }
    return entries;
  }

  async stat(filePath: string): Promise<FileStat> {
    // `stat --printf` mirrors the find fields. `%F` → "directory"/"regular …"/
    // "symbolic link"; map to a single type letter for toDirEntry().
    const res = await (this.runtimeActor ? this.exec.bind(this) : this.inner.exec.bind(this.inner))(
      `${this.runtimeActor ? "" : this.dropPrefix()} stat --printf '%n\\t%F\\t%s\\t%Y\\t%a\\n' -- ${quoteArg(filePath)}`,
    );
    if (res.exitCode !== 0) {
      throw new Error(`stat(${filePath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
    const line = res.stdout.split("\n").find(Boolean) ?? "";
    const [, kind, sizeStr, mtimeStr, modeStr] = line.split("\t");
    const typeLetter = kind === "directory" ? "d" : kind === "symbolic link" ? "l" : "f";
    const name = filePath.split("/").filter(Boolean).pop() ?? filePath;
    return this.toDirEntry(name, filePath, typeLetter, sizeStr, mtimeStr, modeStr);
  }

  /** Build a DirEntry from the textual fields produced by find/stat. */
  private toDirEntry(
    name: string,
    fullPath: string,
    typeLetter?: string,
    sizeStr?: string,
    mtimeStr?: string,
    modeStr?: string,
  ): DirEntry {
    const isDir = typeLetter === "d";
    const isSymlink = typeLetter === "l";
    const mode = parseInt(modeStr ?? "0", 8) || 0;
    const mtimeSec = Number.parseFloat(mtimeStr ?? "0") || 0;
    return {
      name,
      path: fullPath,
      type: isDir ? "dir" : isSymlink ? "symlink" : "file",
      isDir,
      size: Number.parseInt(sizeStr ?? "0", 10) || 0,
      mode: (mode & 0o777).toString(8).padStart(3, "0"),
      mtime: new Date(mtimeSec * 1000),
      isReadable: Boolean(mode & 0o400),
      isWritable: Boolean(mode & 0o200),
      isHidden: name.startsWith("."),
      hasGit: false,
      gitStatus: null,
    };
  }

  async mkdir(dirPath: string, opts: { recursive?: boolean } = {}): Promise<void> {
    const flag = opts.recursive ? "-p " : "";
    const res = await (this.runtimeActor ? this.exec.bind(this) : this.inner.exec.bind(this.inner))(`${this.runtimeActor ? "" : this.dropPrefix()} mkdir ${flag}-- ${quoteArg(dirPath)}`);
    if (res.exitCode !== 0) {
      throw new Error(`mkdir(${dirPath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
  }

  async unlink(filePath: string): Promise<void> {
    const res = await (this.runtimeActor ? this.exec.bind(this) : this.inner.exec.bind(this.inner))(`${this.runtimeActor ? "" : this.dropPrefix()} rm -f -- ${quoteArg(filePath)}`);
    if (res.exitCode !== 0) {
      throw new Error(`unlink(${filePath}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const res = await (this.runtimeActor ? this.exec.bind(this) : this.inner.exec.bind(this.inner))(`${this.runtimeActor ? "" : this.dropPrefix()} mv -- ${quoteArg(from)} ${quoteArg(to)}`);
    if (res.exitCode !== 0) {
      throw new Error(`rename(${from} → ${to}) as ${this.owner} failed: ${res.stderr.trim() || res.stdout.trim()}`);
    }
  }

  /**
   * Translate each SFTP op to its `sudo -u <owner>` shell equivalent — never
   * the inner native SFTP, which would run as the service user (wrong identity).
   */
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
          // same POSIX bits as a single writeFile (incl. the secret 0600 path
          // that stages the tmp restrictively). `undefined` mode keeps the
          // default (umask) behaviour untouched.
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

  spawn(cmd: string, args: string[]): Duplex {
    // Run the interactive process as the owner via a privilege-drop shell. Two
    // modes:
    //   - JAILED (jailEnabled && env.JAIL_SHELL_ENABLED): `sudo -u <owner> -i`.
    //     `-i` runs the owner's LOGIN shell, which jk_jailuser has set to
    //     jk_chrootsh → the PTY lands INSIDE the chroot jail. `cmd`/`args` are
    //     intentionally ignored here: the jail's login shell is the whole point
    //     (a passed shell path would escape jk_chrootsh).
    //   - NORMAL (default / fail-soft when the jail is absent): the historical
    //     `sudo -u <owner> -H <cmd> [args…]` — the tenant's terminal IS the
    //     owner's shell, never the (sudo-capable) service user.
    // The inner DirectSshExecutor opens a PTY and `exec`s this command. Passing
    // the argv as separate elements means none of it is ever re-parsed by a shell.

    const jailed = this.willJailInteractiveShell;
    const stream = jailed
      ? this.inner.spawn("sudo", ["-u", this.owner, "-i"])
      : this.inner.spawn("sudo", ["-u", this.owner, "-H", cmd, ...args]);

    // spawn() does NOT go through the sudo-password injector (that only rewrites
    // exec() command strings). Over a PTY, `sudo` prompts for the password on
    // the stream, so feed it here ONCE when the prompt appears. The passphrase
    // is the same one used as the sudo password (LP one-passphrase model). If no
    // passphrase is available (NOPASSWD target / passphraseless key), nothing is
    // sent and sudo proceeds or fails as configured.
    void Promise.resolve(this.getSudoPasswordHint())
      .then((password) => {
        if (!password) return;
        let sent = false;
        const onData = (chunk: Buffer) => {
          if (sent) return;
          // Match sudo's prompt; `-p ''` isn't used here (PTY needs the prompt
          // to know when to send), so the default "[sudo] password" / "Password:"
          // text appears.
          if (/\bpassword\b\s*:?/i.test(chunk.toString("utf8"))) {
            sent = true;
            try { stream.write(`${password}\n`); } catch { /* stream closed */ }
            stream.off("data", onData);
          }
        };
        stream.on("data", onData);
        // Stop listening once the stream ends, regardless of whether a prompt
        // ever appeared (NOPASSWD path).
        stream.once("close", () => stream.off("data", onData));
      })
      .catch(() => undefined);

    return stream;
  }
}
