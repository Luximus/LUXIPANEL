// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * SSH authorized_keys management for a Linux user on the CONNECTED CLIENT
 * server. Like the rest of the users module, every operation runs on the
 * target via the per-request Executor (NEVER on the panel host) and uses sudo
 * to read/write another user's `~/.ssh/authorized_keys`.
 *
 * The whole authorized_keys file is rewritten on every mutation (read → modify
 * → write back) so adds/removes are atomic and the file always ends up `0600`
 * owned by the user, with `~/.ssh` `0700`.
 */

import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
// ssh2 is CommonJS; `utils` isn't detected as a named ESM export (unlike
// `Client`), so import the default and destructure it.
import ssh2 from "ssh2";
const { utils: sshUtils } = ssh2;
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { quoteCmd, quoteArg, requireExecutor } from "../../../shared/executor/index.js";
import { runCommand } from "../../../shared/executor/run-command.js";

/** Public-key algorithm tokens we accept in an authorized_keys entry. */
const PUBKEY_TYPE_RE =
  /^(?:ssh-rsa|ssh-ed25519|ssh-dss|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)$/;

export interface SshKeyEntry {
  /** Stable id (sha256 of the base64 body) used to delete a specific key. */
  id: string;
  /** Algorithm token, e.g. `ssh-ed25519`. */
  type: string;
  /** Trailing free-form comment (often `user@host`). */
  comment: string;
  /** Last 12 chars of the key body — enough to recognise a key at a glance. */
  preview: string;
  /** Leading options (e.g. `command="…",no-pty`), usually empty. */
  options: string;
}

interface ParsedKey extends SshKeyEntry {
  /** The original, untouched line. */
  raw: string;
}

function executorOrThrow() {
  // Keeps the historical generic `Error` (HTTP 500) on purpose: switching to
  // `NoServerExecutorError` would change this endpoint's status code to 503.
  return requireExecutor(null, () => {
    throw new Error("No executor in context");
  });
}

/** Resolve a user's home directory from `getent passwd`. Throws if missing. */
async function getHomeDir(username: string): Promise<string> {
  const line = await runCommand("getent", ["passwd", username], { allowNonZeroExit: true });
  const home = line.split(":")[5];
  if (!line || !home) throw new NotFoundError(`Usuario del sistema "${username}"`);
  return home;
}

/** Parse one authorized_keys line into its parts, or null if it isn't a key. */
function parseKeyLine(raw: string): ParsedKey | null {
  const line = raw.trim();
  if (!line || line.startsWith("#")) return null;

  const tokens = line.split(/\s+/);
  const typeIdx = tokens.findIndex((t) => PUBKEY_TYPE_RE.test(t));
  if (typeIdx === -1 || typeIdx + 1 >= tokens.length) return null;

  const options = tokens.slice(0, typeIdx).join(" ");
  const type = tokens[typeIdx]!;
  const body = tokens[typeIdx + 1]!;
  const comment = tokens.slice(typeIdx + 2).join(" ");
  if (!/^[A-Za-z0-9+/]+={0,3}$/.test(body)) return null;

  return {
    id: createHash("sha256").update(body).digest("hex").slice(0, 32),
    type,
    comment,
    preview: body.slice(-12),
    options,
    raw: line,
  };
}

/** Read + parse the current authorized_keys file (empty array if none). */
async function readKeys(home: string): Promise<ParsedKey[]> {
  const out = await runCommand("cat", [`${home}/.ssh/authorized_keys`], {
    sudo: true,
    allowNonZeroExit: true, // file may not exist yet
  });
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .map(parseKeyLine)
    .filter((k): k is ParsedKey => k !== null);
}

/**
 * Atomically replace the user's authorized_keys with `lines`, ensuring
 * `~/.ssh` is `0700` and the file `0600`, both owned by the user. The content
 * is staged via SFTP to a `0600` tmp file then `cp`-ed in with sudo (the
 * secret material is a public key, but we keep the same SFTP-then-sudo shape
 * used elsewhere so nothing goes through argv).
 */
async function writeKeys(home: string, username: string, lines: string[]): Promise<void> {
  const executor = executorOrThrow();
  const sshDir = `${home}/.ssh`;
  const akFile = `${sshDir}/authorized_keys`;
  const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";

  const tmp = `/tmp/.lxp-ak-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await executor.writeFile(tmp, content, { encoding: "utf-8" });
  try {
    const inner = [
      `mkdir -p ${quoteArg(sshDir)}`,
      `cp ${quoteArg(tmp)} ${quoteArg(akFile)}`,
      `chown ${quoteArg(`${username}:`)} ${quoteArg(sshDir)} ${quoteArg(akFile)}`,
      `chmod 700 ${quoteArg(sshDir)}`,
      `chmod 600 ${quoteArg(akFile)}`,
    ].join(" && ");
    const res = await executor.exec(quoteCmd("sudo", ["sh", "-c", inner]));
    if (res.exitCode !== 0) {
      throw new AppError(
        `No se pudo escribir authorized_keys${res.stderr ? ` (${res.stderr.trim()})` : ""}`,
        500,
        "SSH_KEYS_WRITE_FAILED",
      );
    }
  } finally {
    await executor.unlink(tmp).catch(() => undefined);
  }
}

/** A freshly generated login key pair. The private key is an RSA PKCS#1 PEM
 *  encrypted with `passphrase` (a format `ssh2`/the /login flow can parse and
 *  unlock with that same passphrase); the public key is in OpenSSH
 *  authorized_keys form. */
export interface GeneratedLoginKeypair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

/**
 * Generate an SSH login key pair for a Linux user. The private key is encrypted
 * with the user's password so that /login (which asks for that same password as
 * the passphrase) can unlock it; the PUBLIC key is installed into the user's
 * authorized_keys on the client server, and the PRIVATE key is handed back ONCE
 * to the caller for display/download (LUXIPANEL is standalone — there is no
 * LP-LICENSE-SERVER; the operator stores/uses the key themselves).
 *
 * RSA/PKCS#1 is used deliberately: `ssh2.utils.parseKey` (what the login flow
 * uses) parses encrypted PKCS#1 PEM but NOT encrypted PKCS#8 PEM.
 */
export function generateLoginKeypair(passphrase: string, comment: string): GeneratedLoginKeypair {
  if (!passphrase || passphrase.length === 0) {
    throw new ValidationError("Se requiere una contraseña para generar la llave de acceso.");
  }
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem", cipher: "aes-256-cbc", passphrase },
  });
  const parsed = sshUtils.parseKey(privateKey, passphrase);
  if (parsed instanceof Error) throw parsed;
  const key = Array.isArray(parsed) ? parsed[0] : parsed;
  const wire = key.getPublicSSH();
  const publicKey = `${key.type} ${wire.toString("base64")}${comment ? ` ${comment}` : ""}`;
  const fingerprint = `SHA256:${createHash("sha256").update(wire).digest("base64").replace(/=+$/, "")}`;
  return { privateKey, publicKey, fingerprint };
}

export const sshKeysService = {
  /** List the user's registered SSH public keys (safe metadata only). */
  async list(username: string): Promise<SshKeyEntry[]> {
    const home = await getHomeDir(username);
    const keys = await readKeys(home);
    return keys.map(({ raw: _raw, ...safe }) => safe);
  },

  /** Append a validated public key, rejecting duplicates. */
  async add(username: string, publicKey: string): Promise<void> {
    const candidate = publicKey.trim();
    if (!candidate || /[\r\n]/.test(candidate)) {
      throw new ValidationError("La llave debe ser una sola línea.");
    }
    const parsed = parseKeyLine(candidate);
    if (!parsed) {
      throw new ValidationError("Formato de llave pública SSH no válido.");
    }

    const home = await getHomeDir(username);
    const existing = await readKeys(home);
    if (existing.some((k) => k.id === parsed.id)) {
      throw new ConflictError("Esa llave ya está registrada para el usuario.");
    }

    await writeKeys(home, username, [...existing.map((k) => k.raw), candidate]);
  },

  /** Remove the key whose stable id matches. Throws if not found. */
  async remove(username: string, keyId: string): Promise<void> {
    const home = await getHomeDir(username);
    const existing = await readKeys(home);
    const next = existing.filter((k) => k.id !== keyId);
    if (next.length === existing.length) {
      throw new NotFoundError("Llave SSH");
    }
    await writeKeys(home, username, next.map((k) => k.raw));
  },
};
