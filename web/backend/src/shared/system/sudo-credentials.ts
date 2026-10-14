// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Sudo credential storage (per target server).
 *
 * The panel remembers one sudo password per target so users don't retype it
 * for every privileged action. The plaintext is AES-256-GCM-encrypted with a
 * key derived from the panel's `JWT_SECRET` and persisted as a sidecar JSON
 * on the connected server.
 *
 * Storage location — IMPORTANT (chicken-and-egg):
 *   The obvious place, `${LUXIPANEL_CONFIG_DIR}` (`/etc/luxipanel`), is NOT
 *   writable by the SSH user without root — but root is exactly what this
 *   credential bootstraps. Writing there would silently no-op (executor.exec
 *   doesn't throw on a non-zero exit), the read-back would fail, and the UI
 *   would re-prompt forever. So this store lives under the SSH user's HOME
 *   (`$HOME/.luxipanel/sudo-credentials.json`, mode 0600), which is always
 *   writable by that user. It is still strictly per-server (on that server,
 *   in that user's home) — never the panel host, never the browser.
 *
 * Every mutating call verifies the write by reading the ciphertext back; a
 * real persistence failure throws so the caller surfaces an error instead of
 * looping.
 *
 * Threat model: anyone with `JWT_SECRET` plus filesystem access to that
 * user's home can decrypt — same trust boundary as the JWT session cookie.
 * The plaintext is never logged and never returned to the client.
 */

import { env } from "../../config/env.js";
import { quoteArg, type Executor } from "../executor/index.js";
import {
  aesGcmDecryptFields,
  aesGcmEncryptFields,
  aesKeyFromSha256,
  type AesGcmFields,
} from "../utils/aes-gcm.js";

const REL_DIR = ".luxipanel";
const REL_FILE = `${REL_DIR}/sudo-credentials.json`;

/** At-rest envelope: the three AES-GCM fields in base64 (format UNCHANGED). */
interface StoredEntry extends AesGcmFields {
  lastUsedAt?: string;
}

interface Bag {
  credential?: StoredEntry;
}

/** Derive a 256-bit symmetric key from JWT_SECRET (derivation UNCHANGED). */
function deriveKey(): Buffer {
  return aesKeyFromSha256(`${env.JWT_SECRET}:luxipanel-sudo-credential`);
}

const homeCache = new Map<string, string>();

/** Resolve (and cache) the SSH user's HOME on the target. */
async function resolveHome(executor: Executor): Promise<string> {
  const id = executor.target.id;
  const cached = homeCache.get(id);
  if (cached) return cached;
  let home = "";
  try {
    const out = await executor.exec('printf %s "$HOME"');
    home = (out.stdout || "").trim();
  } catch {
    /* fall through */
  }
  // Only cache when we have a real absolute path. The "~" fallback means the
  // exec failed (e.g. transient 429 rate-limit); caching it would permanently
  // produce relative paths on every subsequent readBag() call.
  if (home && home.startsWith("/")) {
    homeCache.set(id, home);
    return home;
  }
  return "~"; // last-resort; SFTP path will be relative — caller handles the error
}

function absPaths(home: string): { dir: string; file: string } {
  if (home === "~") return { dir: REL_DIR, file: REL_FILE };
  return { dir: `${home}/${REL_DIR}`, file: `${home}/${REL_FILE}` };
}

async function readBag(executor: Executor): Promise<Bag> {
  const { file } = absPaths(await resolveHome(executor));
  let raw = "";
  try {
    const data = await executor.readFile(file, "utf-8");
    raw = typeof data === "string" ? data : data.toString("utf-8");
  } catch {
    try {
      // No sudo: the file is in the user's own home.
      const out = await executor.exec(`cat ${quoteArg(file)} 2>/dev/null`);
      raw = out.stdout || "";
    } catch {
      raw = "";
    }
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Bag;
  } catch {
    return {};
  }
}

async function writeBag(executor: Executor, bag: Bag): Promise<void> {
  const home = await resolveHome(executor);
  const { dir, file } = absPaths(home);
  const content = JSON.stringify(bag);

  await executor.exec(`mkdir -p ${quoteArg(dir)}`);
  try {
    // Create with 0600 from the start so the encrypted sudo password is never
    // world/group-readable in the umask window before the chmod below.
    await executor.writeFile(file, content, { encoding: "utf-8", mode: 0o600 });
  } catch {
    // Shell fallback: create the file 0600 (umask 077 for THIS redirect) before
    // any content is written, so the ciphertext never lands 0644 even briefly.
    await executor.exec(
      `(umask 077; printf '%s' ${quoteArg(content)} > ${quoteArg(file)})`,
    );
  }
  await executor.exec(`chmod 600 ${quoteArg(file)}`).catch(() => undefined);

  // Verify: a silent non-persist (permission denied with non-throwing exec)
  // must NOT look like success, or the UI loops forever re-prompting.
  const back = await readBag(executor);
  const expected = bag.credential?.ciphertext;
  if (expected && back.credential?.ciphertext !== expected) {
    throw new Error(
      `sudo-credentials: write to ${file} did not persist (no write permission?)`,
    );
  }
}

/** Read the stored sudo password for the target, or null if missing/corrupt. */
export async function getStoredSudoPassword(executor: Executor): Promise<string | null> {
  const bag = await readBag(executor);
  if (!bag.credential) return null;
  try {
    return aesGcmDecryptFields(bag.credential, deriveKey());
  } catch {
    return null;
  }
}

/** Persist (overwrite) the sudo password for the target. Throws if it can't. */
export async function storeSudoPassword(executor: Executor, password: string): Promise<void> {
  await writeBag(executor, {
    credential: {
      ...aesGcmEncryptFields(password, deriveKey()),
      lastUsedAt: new Date().toISOString(),
    },
  });
}

/** Remove the stored sudo credential. */
export async function clearSudoPassword(executor: Executor): Promise<void> {
  const { file } = absPaths(await resolveHome(executor));
  await executor.exec(`rm -f ${quoteArg(file)}`).catch(() => undefined);
}

/** True if a credential is stored (does not validate it). */
export async function hasStoredSudoPassword(executor: Executor): Promise<boolean> {
  const bag = await readBag(executor);
  return Boolean(bag.credential);
}
