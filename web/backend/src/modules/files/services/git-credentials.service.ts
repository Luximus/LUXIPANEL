// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Per-project Git credentials (#14 phase 2).
 *
 * Stores a PAT (https) or private key (ssh) ENCRYPTED at rest. AES-256-GCM with
 * GIT_ENCRYPTION_KEY, which lives only on the panel host — the per-server
 * sidecar (`files/git-credentials.json`) holds ciphertext, so even on the
 * target the secret is unreadable. Decryption happens on the panel host right
 * before a pull/push, and the cleartext only reaches the target inside an
 * ephemeral 0600/0700 helper file (never argv) that is removed afterwards.
 */

import { encrypt, decrypt } from "../../../shared/utils/crypto.js";
import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import { env } from "../../../config/env.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";

export type GitCredType = "https" | "ssh";

export interface GitCredential {
  id: string;
  label: string;
  type: GitCredType;
  /** Host the credential applies to, e.g. "github.com". */
  host: string;
  /** Username for https (optional; defaults to "x-access-token"). */
  username?: string;
  /** AES-GCM ciphertext of the PAT (https) or private key (ssh). */
  secretEnc: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Public shape (never exposes the secret). */
export interface GitCredentialSafe {
  id: string;
  label: string;
  type: GitCredType;
  host: string;
  username?: string;
  createdAt?: string;
}

/** Git auth already configured on the client server (read-only, no secrets). */
export interface DetectedGitAuth {
  sshKeys: Array<{ path: string; name: string; hasPublic: boolean }>;
  sshConfigHosts: Array<{ host: string; identityFile?: string }>;
  gitCredentials: Array<{ host: string; username?: string }>;
  gh: { installed: boolean; authenticated: boolean; accounts: Array<{ host: string; user?: string }> };
  gitConfig: { userName?: string; userEmail?: string; credentialHelper?: string };
}

const HEX_64 = /^[a-fA-F0-9]{64}$/;

function key(): string {
  const k = env.GIT_ENCRYPTION_KEY;
  if (!k || !HEX_64.test(k)) {
    throw new ValidationError("GIT_ENCRYPTION_KEY no configurada (64 hex). Las credenciales Git están deshabilitadas.");
  }
  return k;
}

export function gitCredentialsEnabled(): boolean {
  return HEX_64.test(env.GIT_ENCRYPTION_KEY || "");
}

/** Extract the host from an https or ssh git remote URL. */
export function hostFromRemote(url: string): string | null {
  const u = url.trim();
  // scp-like: git@github.com:owner/repo.git
  const scp = u.match(/^[^@]+@([^:]+):/);
  if (scp) return scp[1]!.toLowerCase();
  // ssh://git@host/...  or  https://host/...
  const m = u.match(/^[a-z]+:\/\/(?:[^@/]+@)?([^/:]+)/i);
  if (m) return m[1]!.toLowerCase();
  return null;
}

function toSafe(c: GitCredential): GitCredentialSafe {
  return { id: c.id, label: c.label, type: c.type, host: c.host, username: c.username, createdAt: c.createdAt };
}


/** Resolve the connected user's $HOME on the target (absolute path). */
async function resolveHome(executor: Executor): Promise<string> {
  const res = await executor.exec('printf %s "$HOME"', { timeoutMs: 8_000 });
  const home = (res.stdout || "").trim();
  if (!home.startsWith("/")) throw new NotFoundError("$HOME del usuario en el servidor");
  return home;
}

/** Parse a ~/.git-credentials line → { raw, host, user } (best-effort). */
function parseGitCredLine(raw: string): { raw: string; host: string; user: string } {
  let s = raw.trim();
  let host = "";
  let user = "";
  const scheme = s.match(/^https?:\/\//i);
  if (scheme) {
    s = s.slice(scheme[0].length);
    const at = s.lastIndexOf("@");
    if (at >= 0) {
      const creds = s.slice(0, at);
      const hostPath = s.slice(at + 1);
      host = (hostPath.split("/")[0] || "").toLowerCase();
      try { user = decodeURIComponent(creds.split(":")[0] || ""); } catch { user = creds.split(":")[0] || ""; }
    } else {
      host = (s.split("/")[0] || "").toLowerCase();
    }
  }
  return { raw, host, user };
}

const GIT_CRED_PATH = (home: string) => `${home}/.git-credentials`;

const store = makeKvStore<GitCredential>({ module: "files", collection: "git-credentials", idStrategy: "uuid" });

export const gitCredentialsService = {
  enabled: gitCredentialsEnabled,

  async list(executor: Executor): Promise<GitCredentialSafe[]> {
    const all = await store(executor).list();
    return all.map(toSafe).sort((a, b) => a.host.localeCompare(b.host));
  },

  async create(executor: Executor, input: { label: string; type: GitCredType; host: string; username?: string; secret: string }): Promise<GitCredentialSafe> {
    const secretEnc = encrypt(input.secret, key());
    const rec = await store(executor).create({
      id: "",
      label: input.label,
      type: input.type,
      host: input.host.trim().toLowerCase(),
      username: input.username?.trim() || undefined,
      secretEnc,
    } as GitCredential);
    return toSafe(rec);
  },

  async update(
    executor: Executor,
    id: string,
    input: { label?: string; type?: GitCredType; host?: string; username?: string; secret?: string },
  ): Promise<GitCredentialSafe | null> {
    const patch: Partial<GitCredential> = {};
    if (input.label !== undefined) patch.label = input.label;
    if (input.type !== undefined) patch.type = input.type;
    if (input.host !== undefined) patch.host = input.host.trim().toLowerCase();
    if (input.username !== undefined) patch.username = input.username.trim() || undefined;
    // Only re-encrypt when a new secret is provided; blank keeps the stored one.
    if (input.secret) patch.secretEnc = encrypt(input.secret, key());
    const rec = await store(executor).update(id, patch);
    return rec ? toSafe(rec) : null;
  },

  async remove(executor: Executor, id: string): Promise<boolean> {
    return store(executor).delete(id);
  },

  /** Internal: full record + decrypted secret. Panel-host only. */
  async getDecrypted(executor: Executor, id: string): Promise<{ cred: GitCredential; secret: string } | null> {
    const cred = await store(executor).get(id);
    if (!cred) return null;
    return { cred, secret: decrypt(cred.secretEnc, key()) };
  },

  /**
   * Detect git/GitHub auth ALREADY configured on the connected client server:
   * SSH private keys in ~/.ssh, ~/.ssh/config host→identity mappings, hosts in
   * ~/.git-credentials (HTTPS store), `gh` CLI login, and global git config.
   * Read-only and SECRET-FREE: tokens/keys are never returned — only hosts,
   * usernames, key paths and config metadata. Fail-open (empty on any error).
   */
  async detectServerCredentials(executor: Executor): Promise<DetectedGitAuth> {
    // A fresh, deeply-independent empty result each call (used both as the
    // fail-open return and as the mutable accumulator below).
    const emptyResult = (): DetectedGitAuth => ({
      sshKeys: [], sshConfigHosts: [], gitCredentials: [],
      gh: { installed: false, authenticated: false, accounts: [] },
      gitConfig: {},
    });
    const script = [
      "echo '#SSHKEYS'",
      `for f in "$HOME"/.ssh/*; do [ -f "$f" ] && head -1 "$f" 2>/dev/null | grep -q 'PRIVATE KEY' && { printf '%s' "$f"; [ -f "$f.pub" ] && printf ' PUB' ; echo; }; done 2>/dev/null`,
      "echo '#SSHCONFIG'",
      `cat "$HOME/.ssh/config" 2>/dev/null`,
      "echo '#GITCRED'",
      `cat "$HOME/.git-credentials" 2>/dev/null`,
      "echo '#GH'",
      `command -v gh >/dev/null 2>&1 && { echo HAS_GH; gh auth status 2>&1; } || echo NO_GH`,
      "echo '#GITCONFIG'",
      `git config --global --list 2>/dev/null`,
      "echo '#END'",
    ].join("\n");

    let out = "";
    try {
      // SSH transport safety: a multi-line body (the join("\n") newlines) can't
      // travel reliably as a raw exec string (control chars / quoting hazards)
      // → risks an empty (silent) result. Base64-encode the multi-line body
      // (single line, no control chars) and rebuild it remotely inside `$(…)`
      // so `sh -lc` still gets the real multi-line script as its -c argument.
      // Mirrors git-ssh.service.runScript. NEVER JSON.stringify (escapes \n → literal).
      const b64 = Buffer.from(script, "utf8").toString("base64");
      const res = await executor.exec(`sh -lc "$(printf %s '${b64}' | base64 -d)"`, { timeoutMs: 12_000 });
      out = res.stdout || "";
    } catch {
      return emptyResult();
    }

    const sections: Record<string, string[]> = {};
    let cur = "";
    for (const raw of out.split("\n")) {
      const line = raw.replace(/\r$/, "");
      const m = line.match(/^#(SSHKEYS|SSHCONFIG|GITCRED|GH|GITCONFIG|END)$/);
      if (m) { cur = m[1]!; sections[cur] = []; continue; }
      if (cur && cur !== "END") (sections[cur] ??= []).push(line);
    }

    const result: DetectedGitAuth = emptyResult();

    // SSH private keys
    for (const line of sections["SSHKEYS"] ?? []) {
      const t = line.trim();
      if (!t) continue;
      const hasPublic = / PUB$/.test(t);
      const path = t.replace(/ PUB$/, "");
      result.sshKeys.push({ path, name: path.split("/").pop() || path, hasPublic });
    }

    // ~/.ssh/config — Host → IdentityFile
    {
      let host = "";
      for (const raw of sections["SSHCONFIG"] ?? []) {
        const line = raw.trim();
        const hm = line.match(/^Host\s+(.+)$/i);
        if (hm) { host = hm[1]!.trim().split(/\s+/)[0] || ""; continue; }
        const im = line.match(/^IdentityFile\s+(.+)$/i);
        if (im && host && host !== "*") result.sshConfigHosts.push({ host, identityFile: im[1]!.trim() });
      }
    }

    // ~/.git-credentials — strip the secret, keep host + username only
    for (const raw of sections["GITCRED"] ?? []) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^https?:\/\/([^:@/]+)(?::[^@]*)?@([^/]+)/i);
      if (m) result.gitCredentials.push({ host: m[2]!.toLowerCase(), username: m[1] });
      else {
        const h = line.match(/^https?:\/\/([^/]+)/i);
        if (h) result.gitCredentials.push({ host: h[1]!.replace(/^[^@]*@/, "").toLowerCase() });
      }
    }

    // gh CLI
    {
      const lines = sections["GH"] ?? [];
      result.gh.installed = lines.some((l) => l.trim() === "HAS_GH");
      const joined = lines.join("\n");
      const seen = new Set<string>();
      const re = /(?:Logged in to|account)\s+([\w.-]+\.[a-z]{2,})(?:\s+(?:as|account)\s+([\w-]+))?/gi;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(joined))) {
        const host = mm[1]!.toLowerCase();
        if (seen.has(host)) continue;
        seen.add(host);
        result.gh.accounts.push({ host, user: mm[2] || undefined });
      }
      result.gh.authenticated = result.gh.installed && (/Logged in to/i.test(joined) || result.gh.accounts.length > 0);
    }

    // global git config
    for (const raw of sections["GITCONFIG"] ?? []) {
      const [k, ...rest] = raw.split("=");
      const v = rest.join("=").trim();
      if (!v) continue;
      if (k === "user.name") result.gitConfig.userName = v;
      else if (k === "user.email") result.gitConfig.userEmail = v;
      else if (k === "credential.helper") result.gitConfig.credentialHelper = v;
    }

    return result;
  },

  // ── Server-side detected auth mutations (modify the client server directly) ──
  // These touch real files (~/.git-credentials, ~/.ssh), `gh` and git config. The
  // secret is written via SFTP (executor.writeFile), NEVER through argv.

  /** Add or edit an HTTPS line in the server's ~/.git-credentials. matchHost/
   *  matchUser identify the line to replace (edit); omit them to just add. */
  async saveServerHttps(
    executor: Executor,
    input: { host: string; username: string; secret: string; matchHost?: string; matchUser?: string },
  ): Promise<void> {
    const host = input.host.trim().toLowerCase();
    const user = input.username.trim();
    if (!host || !user || !input.secret) throw new ValidationError("host, usuario y token son obligatorios");
    const home = await resolveHome(executor);
    const path = GIT_CRED_PATH(home);
    let content = "";
    try { content = String(await executor.readFile(path, "utf8")); } catch { content = ""; }
    const lines = content.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
    const matchHost = (input.matchHost ?? host).trim().toLowerCase();
    const matchUser = input.matchUser?.trim() ?? user;
    const kept = lines.filter((l) => {
      const p = parseGitCredLine(l);
      if (p.host === matchHost && (!matchUser || p.user === matchUser)) return false; // line being edited
      if (p.host === host && p.user === user) return false; // dedup same new identity
      return true;
    });
    const newLine = `https://${encodeURIComponent(user)}:${encodeURIComponent(input.secret)}@${host}`;
    const out = [...kept, newLine].join("\n") + "\n";
    await executor.writeFile(path, out, { encoding: "utf8" });
    await executor.exec(`chmod 600 ${quoteArg(path)}`, { timeoutMs: 8_000 });
  },

  /** Remove matching host(+user) HTTPS lines from the server's ~/.git-credentials. */
  async deleteServerHttps(executor: Executor, input: { host: string; username?: string }): Promise<void> {
    const host = input.host.trim().toLowerCase();
    const user = input.username?.trim();
    const home = await resolveHome(executor);
    const path = GIT_CRED_PATH(home);
    let content = "";
    try { content = String(await executor.readFile(path, "utf8")); } catch { return; }
    const lines = content.split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
    const kept = lines.filter((l) => {
      const p = parseGitCredLine(l);
      return !(p.host === host && (!user || p.user === user));
    });
    const out = kept.length ? kept.join("\n") + "\n" : "";
    await executor.writeFile(path, out, { encoding: "utf8" });
    await executor.exec(`chmod 600 ${quoteArg(path)}`, { timeoutMs: 8_000 });
  },

  /** Delete a private key (+ its .pub) by basename from ~/.ssh. DESTRUCTIVE. */
  async deleteServerSshKey(executor: Executor, input: { name: string }): Promise<void> {
    const name = input.name.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) throw new ValidationError("Nombre de llave inválido");
    const home = await resolveHome(executor);
    const base = `${home}/.ssh/${name}`;
    const check = await executor.exec(
      `[ -f ${quoteArg(base)} ] && head -1 ${quoteArg(base)} 2>/dev/null | grep -q 'PRIVATE KEY' && echo OK || echo NO`,
      { timeoutMs: 8_000 },
    );
    if (!/OK/.test(check.stdout || "")) throw new NotFoundError("La llave privada indicada");
    await executor.exec(`rm -f ${quoteArg(base)} ${quoteArg(base + ".pub")} && echo '#OK'`, { timeoutMs: 8_000 });
  },

  /** `gh auth logout --hostname <host>`. */
  async ghLogout(executor: Executor, input: { host: string }): Promise<void> {
    const host = input.host.trim().toLowerCase();
    if (!/^[a-z0-9.-]+$/.test(host)) throw new ValidationError("Host inválido");
    const res = await executor.exec(`gh auth logout --hostname ${quoteArg(host)} 2>&1; echo '#DONE'`, { timeoutMs: 15_000 });
    const out = (res.stdout || "").replace(/#DONE/g, "");
    if (/(error|not logged in|unknown)/i.test(out) && !/Logged out/i.test(out)) {
      throw new Error(out.trim().slice(0, 200) || "gh auth logout falló");
    }
  },

  /** Set global git identity (user.name / user.email). Values via base64. */
  async setGitConfig(executor: Executor, input: { userName?: string; userEmail?: string }): Promise<void> {
    const parts: string[] = [];
    if (input.userName !== undefined) {
      const b64 = Buffer.from(input.userName, "utf8").toString("base64");
      parts.push(`git config --global user.name "$(printf %s ${quoteArg(b64)} | base64 -d)"`);
    }
    if (input.userEmail !== undefined) {
      const b64 = Buffer.from(input.userEmail, "utf8").toString("base64");
      parts.push(`git config --global user.email "$(printf %s ${quoteArg(b64)} | base64 -d)"`);
    }
    if (!parts.length) return;
    parts.push("echo '#OK'");
    const b64 = Buffer.from(parts.join("\n"), "utf8").toString("base64");
    const res = await executor.exec(`sh -lc "$(printf %s ${quoteArg(b64)} | base64 -d)"`, { timeoutMs: 12_000 });
    if (!/#OK/.test(res.stdout || "")) throw new ValidationError("No se pudo aplicar git config.");
  },

  /** Pick a credential matching the remote's host (and url scheme). */
  async resolveForRemote(executor: Executor, remoteUrl: string, preferId?: string): Promise<{ cred: GitCredential; secret: string } | null> {
    if (preferId) return this.getDecrypted(executor, preferId);
    const host = hostFromRemote(remoteUrl);
    if (!host) return null;
    const wantSsh = /^[^@]+@[^:]+:|^ssh:\/\//i.test(remoteUrl.trim());
    const all = await store(executor).list();
    const match = all.find((c) => c.host === host && (wantSsh ? c.type === "ssh" : c.type === "https"))
      ?? all.find((c) => c.host === host);
    if (!match) return null;
    return { cred: match, secret: decrypt(match.secretEnc, key()) };
  },
};
