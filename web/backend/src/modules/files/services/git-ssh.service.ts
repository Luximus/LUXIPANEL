// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Git SSH manager (#14) — diagnose & configure the SSH auth a Linux user uses
 * to talk to GitHub (or any git host) FROM the connected client server.
 *
 * Everything runs on the connected server through the request `Executor`.
 * Operations can target the connected user (no sudo) or ANOTHER Linux user
 * via `sudo -u <user> -H sh -c '<inner>'` — the panel's stored sudo password
 * / live passphrase is injected transparently by {@link injectSudoIntoShellScript}.
 *
 * SECURITY: every interpolated value is shell-single-quoted with {@link sq};
 * `user`/`host`/`identityFile`/`repo` are also regex-validated by the zod
 * schemas in the controller. No secret is read or returned — only key PATHS,
 * config metadata and ssh's own diagnostic output.
 *
 * Transport: scripts are multi-line, but in managed mode every exec is
 * forwarded to LP's `/api/agents/exec` gateway, which REJECTS commands
 * containing control characters (newlines/tabs → "Command contains unsupported
 * control characters"). So we never send a raw `sh -lc '<multi-line body>'`.
 * Instead {@link runScript} base64-encodes the body (single line, only
 * `[A-Za-z0-9+/=]`) and reconstructs it on the remote inside a command
 * substitution — `sh -lc "$(printf %s '<b64>' | base64 -d)"` — so `sh -lc`
 * still receives the real multi-line script as its `-c` ARGUMENT (stdin stays
 * free for `ssh -T`, unlike a `… | sh` pipe which would let ssh swallow the
 * rest of the script). NEVER `JSON.stringify` the body (escapes newlines to
 * literal "\n" → only the first line runs).
 */

import { injectSudoIntoShellScript } from "../../../shared/system/sudo-runtime.js";
import { AppError } from "../../../shared/errors/errors.js";
import { MIN_REAL_UID, MAX_REAL_UID } from "../../../shared/system/users.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";

export interface SshKeyRef {
  path: string;
  name: string;
  hasPublic: boolean;
}
export interface SshConfigHost {
  host: string;
  hostName?: string;
  user?: string;
  identityFile?: string;
  identitiesOnly?: boolean;
}
export interface SshEnvironment {
  connectedUser: string;
  targetUser: string;
  home: string;
  sshDir: string;
  exists: boolean;
  listing: string;
  keys: SshKeyRef[];
}
export interface GithubTestResult {
  authenticated: boolean;
  githubUser?: string;
  keyUsed?: string;
  host: string;
  exitCode: number;
  raw: string;
}
export interface SshConfigView {
  path: string;
  exists: boolean;
  raw: string;
  hosts: SshConfigHost[];
}


/** Wrap `inner` so it runs as `user` (sudo) or as the connected user (direct). */
function asUser(user: string | undefined, inner: string): string {
  return user ? `sudo -u ${quoteArg(user)} -H sh -c ${quoteArg(inner)}` : inner;
}

/** Run a multi-line shell body on the connected server (sudo auto-injected). */
async function runScript(executor: Executor, body: string, timeoutMs = 15_000): Promise<string> {
  const wired = await injectSudoIntoShellScript(executor, body);
  // SSH transport safety: a multi-line body cannot travel reliably as a raw
  // `sh -lc '<body>'` string (control chars / quoting hazards). Send it
  // base64-encoded (single line, no control chars) and rebuild it remotely
  // inside `$(…)` so `sh -lc` gets the real multi-line script as its argument.
  const b64 = Buffer.from(wired, "utf8").toString("base64");
  const cmd = `sh -lc "$(printf %s '${b64}' | base64 -d)"`;
  const res = await executor.exec(cmd, { timeoutMs });
  return res.stdout || "";
}

/** Split a `#MARKER`-delimited stream into named sections. */
function splitSections(out: string, markers: string[]): Record<string, string[]> {
  const set = new Set(markers);
  const sections: Record<string, string[]> = {};
  let cur = "";
  for (const raw of out.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = line.match(/^#([A-Z]+)(?:\s.*)?$/);
    if (m && set.has(m[1]!)) {
      cur = m[1]!;
      sections[cur] ??= [];
      continue;
    }
    if (cur) (sections[cur] ??= []).push(line);
  }
  return sections;
}

function parseKeys(lines: string[]): SshKeyRef[] {
  const keys: SshKeyRef[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const hasPublic = / PUB$/.test(t);
    const path = t.replace(/ PUB$/, "");
    keys.push({ path, name: path.split("/").pop() || path, hasPublic });
  }
  return keys;
}

/** Parse `~/.ssh/config` into Host blocks (best-effort). */
function parseSshConfig(raw: string): SshConfigHost[] {
  const hosts: SshConfigHost[] = [];
  let cur: SshConfigHost | null = null;
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const hm = line.match(/^Host\s+(.+)$/i);
    if (hm) {
      if (cur) hosts.push(cur);
      cur = { host: hm[1]!.trim().split(/\s+/)[0] || "" };
      continue;
    }
    if (!cur) continue;
    const kv = line.match(/^(\S+)\s+(.+)$/);
    if (!kv) continue;
    const key = kv[1]!.toLowerCase();
    const val = kv[2]!.trim();
    if (key === "hostname") cur.hostName = val;
    else if (key === "user") cur.user = val;
    else if (key === "identityfile") cur.identityFile = val;
    else if (key === "identitiesonly") cur.identitiesOnly = /^yes$/i.test(val);
  }
  if (cur) hosts.push(cur);
  return hosts;
}

/** Drop any Host block whose host token equals `host` (case-insensitive). */
function removeHostBlock(raw: string, host: string): string {
  const lines = raw.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const hm = line.match(/^\s*Host\s+(.+)$/i);
    if (hm) {
      const tokens = hm[1]!.trim().split(/\s+/);
      skipping = tokens.some((t) => t.toLowerCase() === host.toLowerCase());
      if (skipping) continue;
    }
    if (!skipping) out.push(line);
  }
  return out.join("\n");
}

export const gitSshService = {
  /** Connected user + target user's $HOME, `ls -la ~/.ssh` and detected keys. */
  async inspectEnvironment(executor: Executor, opts: { user?: string }): Promise<SshEnvironment> {
    const inner = [
      `echo '#HOME'`,
      `printf '%s\\n' "$HOME"`,
      `echo '#LS'`,
      `ls -la "$HOME/.ssh" 2>/dev/null`,
      `echo '#KEYS'`,
      `for f in "$HOME"/.ssh/*; do [ -f "$f" ] && head -1 "$f" 2>/dev/null | grep -q 'PRIVATE KEY' && { printf '%s' "$f"; [ -f "$f.pub" ] && printf ' PUB'; echo; }; done 2>/dev/null`,
      `echo '#END'`,
    ].join("\n");
    const body = [`echo '#WHOAMI'`, `whoami`, `echo '#TARGET'`, asUser(opts.user, inner)].join("\n");
    const out = await runScript(executor, body);
    const s = splitSections(out, ["WHOAMI", "TARGET", "HOME", "LS", "KEYS", "END"]);
    const connectedUser = (s["WHOAMI"]?.join("").trim()) || "?";
    const home = (s["HOME"]?.find((l) => l.trim()) || "").trim();
    const listing = (s["LS"] ?? []).join("\n").trim();
    return {
      connectedUser,
      targetUser: opts.user || connectedUser,
      home,
      sshDir: home ? `${home}/.ssh` : "~/.ssh",
      exists: listing.length > 0,
      listing,
      keys: parseKeys(s["KEYS"] ?? []),
    };
  },

  /** Linux users (root + uid≥1000) with their home, for the target selector. */
  async listUsers(executor: Executor): Promise<Array<{ user: string; home: string; shell: string }>> {
    // UID bounds come from the SSOT (shared/system/users.ts); the `($3==0)`
    // root clause is intentional here (the target selector includes root).
    const out = await runScript(
      executor,
      `getent passwd | awk -F: '($3==0)||($3>=${MIN_REAL_UID} && $3<${MAX_REAL_UID}){print $1":"$6":"$7}'`,
    );
    const users: Array<{ user: string; home: string; shell: string }> = [];
    for (const line of out.split("\n")) {
      const [user, home, shell] = line.split(":");
      if (!user) continue;
      // TS-side canonical for this filter is isNonLoginShell (shared/system/
      // shells.ts); kept inline as the remote awk output can't import TS.
      if (/(nologin|false)$/.test(shell || "")) continue;
      users.push({ user, home: home || "", shell: shell || "" });
    }
    return users.sort((a, b) => a.user.localeCompare(b.user));
  },

  /** Run `ssh -T git@<host>` (optionally as another user / with a given key). */
  async testGithub(
    executor: Executor,
    opts: { user?: string; identityFile?: string; host?: string; verbose?: boolean },
  ): Promise<GithubTestResult> {
    const host = opts.host || "github.com";
    const idOpts = opts.identityFile ? `-o IdentitiesOnly=yes -i ${quoteArg(opts.identityFile)} ` : "";
    const v = opts.verbose ? "-v " : "";
    const inner =
      `ssh ${v}-T -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ${idOpts}git@${host} 2>&1; echo "#EXIT $?"`;
    const out = await runScript(executor, asUser(opts.user, inner), 25_000);
    const authenticated = /successfully authenticated/i.test(out) || /(^|\n)Hi /.test(out);
    const gh = out.match(/Hi ([^!]+)!/);
    const accepts = out.match(/Server accepts key:\s*(\S+)/);
    const offering = [...out.matchAll(/Offering public key:\s*(\S+)/g)];
    const authTo = /Authenticated to/i.test(out);
    const keyUsed = accepts?.[1] || (authTo && offering.length ? offering[offering.length - 1]![1] : undefined);
    const exitMatch = out.match(/#EXIT (\d+)/);
    return {
      authenticated,
      githubUser: gh?.[1]?.trim(),
      keyUsed,
      host,
      exitCode: exitMatch ? Number(exitMatch[1]) : 0,
      raw: out.replace(/\n?#EXIT \d+\s*$/, "").trim(),
    };
  },

  /** Read a user's `~/.ssh/config` (parsed Host blocks + raw text). */
  async readConfig(executor: Executor, opts: { user?: string }): Promise<SshConfigView> {
    const inner = [
      `echo '#HOME'`,
      `printf '%s\\n' "$HOME"`,
      `echo '#CONFIG'`,
      `cat "$HOME/.ssh/config" 2>/dev/null`,
      `echo '#END'`,
    ].join("\n");
    const out = await runScript(executor, asUser(opts.user, inner));
    const s = splitSections(out, ["HOME", "CONFIG", "END"]);
    const home = (s["HOME"]?.find((l) => l.trim()) || "").trim();
    const raw = (s["CONFIG"] ?? []).join("\n").replace(/\s+$/, "");
    return {
      path: home ? `${home}/.ssh/config` : "~/.ssh/config",
      exists: raw.trim().length > 0,
      raw,
      hosts: parseSshConfig(raw),
    };
  },

  /** Upsert a `Host <host>` block (IdentityFile/IdentitiesOnly) + fix perms. */
  async writeGithubConfig(
    executor: Executor,
    opts: { user?: string; host?: string; hostName?: string; identityFile: string; identitiesOnly?: boolean },
  ): Promise<{ ok: true; path: string; content: string }> {
    const host = opts.host || "github.com";
    const current = await this.readConfig(executor, { user: opts.user });
    const block = [
      `Host ${host}`,
      `  HostName ${opts.hostName || host}`,
      `  User git`,
      `  IdentityFile ${opts.identityFile}`,
      opts.identitiesOnly === false ? null : `  IdentitiesOnly yes`,
    ]
      .filter(Boolean)
      .join("\n");
    const cleaned = removeHostBlock(current.raw, host).trim();
    const content = (cleaned ? `${cleaned}\n\n` : "") + block + "\n";
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const inner = [
      `mkdir -p "$HOME/.ssh"`,
      `printf %s ${quoteArg(b64)} | base64 -d > "$HOME/.ssh/config"`,
      `chmod 700 "$HOME/.ssh"`,
      `chmod 600 "$HOME/.ssh/config"`,
      `echo '#OK'`,
    ].join("\n");
    const out = await runScript(executor, asUser(opts.user, inner));
    if (!/#OK/.test(out)) throw new AppError(`No se pudo escribir la config SSH: ${out.trim().slice(0, 300)}`, 400, "SSH_CONFIG_WRITE_FAILED");
    return { ok: true, path: current.path, content };
  },

  /** chmod 700 ~/.ssh, 600 private keys/config/known_hosts, 644 *.pub. */
  async fixPermissions(executor: Executor, opts: { user?: string }): Promise<{ ok: true }> {
    const inner = [
      `[ -d "$HOME/.ssh" ] && chmod 700 "$HOME/.ssh"`,
      `[ -f "$HOME/.ssh/config" ] && chmod 600 "$HOME/.ssh/config"`,
      `[ -f "$HOME/.ssh/known_hosts" ] && chmod 600 "$HOME/.ssh/known_hosts"`,
      `[ -f "$HOME/.ssh/authorized_keys" ] && chmod 600 "$HOME/.ssh/authorized_keys"`,
      `for f in "$HOME"/.ssh/*; do [ -f "$f" ] || continue; case "$f" in *.pub) chmod 644 "$f";; *) head -1 "$f" 2>/dev/null | grep -q 'PRIVATE KEY' && chmod 600 "$f";; esac; done 2>/dev/null`,
      `echo '#OK'`,
    ].join("\n");
    const out = await runScript(executor, asUser(opts.user, inner));
    if (!/#OK/.test(out)) throw new AppError("No se pudieron ajustar los permisos de ~/.ssh", 400, "SSH_PERMS_FAILED");
    return { ok: true };
  },

  /** Read a repo's `core.sshCommand` (per-repo key override). */
  async getRepoSshCommand(executor: Executor, opts: { repo: string; user?: string }): Promise<{ value: string }> {
    const inner = `cd ${quoteArg(opts.repo)} 2>/dev/null && git config --get core.sshCommand 2>/dev/null; echo '#END'`;
    const out = await runScript(executor, asUser(opts.user, inner));
    const value = out.replace(/\n?#END\s*$/, "").trim();
    return { value };
  },

  /** Set/unset a repo's `core.sshCommand` to use a specific key. */
  async setRepoSshCommand(
    executor: Executor,
    opts: { repo: string; identityFile?: string; unset?: boolean; user?: string },
  ): Promise<{ ok: true; value: string }> {
    let inner: string;
    let value = "";
    if (opts.unset) {
      inner = `cd ${quoteArg(opts.repo)} && git config --unset core.sshCommand 2>/dev/null; echo '#OK'`;
    } else {
      if (!opts.identityFile) throw new AppError("Falta la llave (identityFile)", 400, "SSH_REPO_KEY_MISSING");
      value = `ssh -i ${opts.identityFile} -o IdentitiesOnly=yes`;
      inner = `cd ${quoteArg(opts.repo)} && git config core.sshCommand ${quoteArg(value)} && echo '#OK'`;
    }
    const out = await runScript(executor, asUser(opts.user, inner));
    if (!/#OK/.test(out)) throw new AppError(`No se pudo aplicar core.sshCommand: ${out.trim().slice(0, 300)}`, 400, "SSH_REPO_KEY_FAILED");
    return { ok: true, value };
  },
};
