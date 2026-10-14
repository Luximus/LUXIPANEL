// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { randomBytes } from "node:crypto";
import * as openpgp from "openpgp";
import { simpleParser, type ParsedMail } from "mailparser";
import { settingsRepository } from "../../admin/repositories/index.js";
import { ValidationError, NotFoundError } from "../../../shared/errors/index.js";
import { getContextExecutor, getContextUserId } from "../../../shared/executor/context.js";
import { sanitizeEmailHtml } from "./mail-html-sanitizer.js";
import { mailCryptoService } from "./mail-crypto.service.js";
import type { SendMailOptions } from "./smtp.service.js";

export const PGP_STORE_KEY = "mail_encryption_settings_v2";
function scopedStoreKey(): string {
  const target = getContextExecutor()?.target.id;
  if (!target) throw new ValidationError("No hay servidor de correo conectado");
  return `${PGP_STORE_KEY}:${target}`;
}
export interface PgpStoredKey {
  keyId: string;
  fingerprint: string;
  name: string;
  email: string;
  comment: string;
  keySize: number;
  createdAt: string;
  expiresAt: string | null;
  publicKey: string;
  privateKeyCiphertext?: string;
  ownerAccountId?: number;
  importerUserId?: number;
}

export async function readPgpKeys(): Promise<PgpStoredKey[]> {
  const raw = await settingsRepository.get(scopedStoreKey());
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { keys?: PgpStoredKey[] };
    return Array.isArray(data.keys) ? data.keys : [];
  } catch {
    return [];
  }
}

export async function writePgpKeys(keys: PgpStoredKey[]): Promise<void> {
  await settingsRepository.set(scopedStoreKey(), JSON.stringify({ keys }), "mail", "Verified OpenPGP keys");
}

export function keyEmail(key: openpgp.PublicKey | openpgp.PrivateKey): string | null {
  for (const userId of key.getUserIDs()) {
    const match = /<([^<>\s]+@[^<>\s]+)>/.exec(userId);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

export async function keyExpiry(key: openpgp.PublicKey | openpgp.PrivateKey): Promise<string | null> {
  const expires = await key.getExpirationTime();
  return expires instanceof Date && Number.isFinite(expires.getTime()) ? expires.toISOString() : null;
}

function splitMime(raw: Buffer): { headers: string; entity: string } {
  const source = raw.toString("utf8");
  const separator = source.indexOf("\r\n\r\n");
  if (separator < 0) throw new ValidationError("El mensaje MIME no se pudo preparar");
  const headerLines = source.slice(0, separator).split("\r\n");
  const blocks: string[] = [];
  for (const line of headerLines) {
    if (/^[ \t]/.test(line) && blocks.length) blocks[blocks.length - 1] += `\r\n${line}`;
    else blocks.push(line);
  }
  const publicHeaders = blocks.filter((block) => /^(?:from|to|cc|subject|date|message-id|reply-to|in-reply-to|references):/i.test(block));
  const mimeHeaders = blocks.filter((block) => /^(?:content-type|content-transfer-encoding|content-disposition):/i.test(block));
  return {
    headers: publicHeaders.join("\r\n"),
    entity: `${mimeHeaders.join("\r\n")}\r\n\r\n${source.slice(separator + 4)}`,
  };
}

/** RFC 3156 multipart/encrypted; outer addressing and Subject remain visible. */
export async function encryptMailMessage(
  raw: Buffer,
  options: SendMailOptions,
  senderAccountId: number,
): Promise<Buffer> {
  const addresses = [
    ...(Array.isArray(options.to) ? options.to : [options.to]),
    ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
    ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []),
  ].map((address) => address.toLowerCase());
  const sender = options.from.match(/<([^<>]+)>/)?.[1]?.toLowerCase() ?? options.from.toLowerCase();
  const ownerId = getContextUserId();
  const stored = await readPgpKeys();
  const selected = new Map<string, PgpStoredKey>();
  for (const address of [...addresses, sender]) {
    const candidate = stored.find((key) => key.email === address
      && (key.ownerAccountId === senderAccountId || key.importerUserId === ownerId));
    if (!candidate) throw new ValidationError(`Falta una clave pública válida para ${address}`);
    if (candidate.expiresAt && new Date(candidate.expiresAt).getTime() <= Date.now()) {
      throw new ValidationError(`La clave pública de ${address} está vencida`);
    }
    selected.set(address, candidate);
  }
  const publicKeys = await Promise.all([...selected.values()].map((entry) => openpgp.readKey({ armoredKey: entry.publicKey })));
  for (const key of publicKeys) await key.getEncryptionKey();
  const { headers, entity } = splitMime(raw);
  const armored = await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: new Uint8Array(Buffer.from(entity, "utf8")) }),
    encryptionKeys: publicKeys,
    format: "armored",
  });
  const boundary = `lxp-pgp-${randomBytes(16).toString("hex")}`;
  const outer = `${headers}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="${boundary}"\r\n\r\n`
    + `--${boundary}\r\nContent-Type: application/pgp-encrypted\r\n\r\nVersion: 1\r\n`
    + `--${boundary}\r\nContent-Type: application/octet-stream; name="encrypted.asc"\r\nContent-Disposition: inline; filename="encrypted.asc"\r\n\r\n${armored}\r\n`
    + `--${boundary}--\r\n`;
  return Buffer.from(outer, "utf8");
}

export function isPgpMime(source: string): boolean {
  const headerEnd = source.indexOf("\r\n\r\n");
  const header = source.slice(0, headerEnd < 0 ? 2048 : headerEnd).replace(/\r\n[ \t]+/g, " ");
  return /^content-type:\s*multipart\/encrypted;[^\r\n]*protocol="?application\/pgp-encrypted/im.test(header);
}

export async function decryptMailMessage(source: string, accountId: number, passphrase: string) {
  if (!isPgpMime(source)) throw new ValidationError("El mensaje no está cifrado con PGP/MIME");
  const parsed = await simpleParser(source) as ParsedMail;
  const armored = parsed.attachments.find((item) => item.content.toString("utf8").includes("-----BEGIN PGP MESSAGE-----"))?.content.toString("utf8");
  if (!armored) throw new ValidationError("No se encontró el contenido PGP del mensaje");
  const candidates = (await readPgpKeys()).filter((entry) => entry.ownerAccountId === accountId && entry.privateKeyCiphertext);
  if (!candidates.length) throw new NotFoundError("Clave privada del buzón");
  const message = await openpgp.readMessage({ armoredMessage: armored });
  for (const entry of candidates) {
    try {
      const privateKey = await openpgp.readPrivateKey({ armoredKey: mailCryptoService.decrypt(entry.privateKeyCiphertext!) });
      const unlocked = await openpgp.decryptKey({ privateKey, passphrase });
      const decrypted = await openpgp.decrypt({ message, decryptionKeys: unlocked, format: "binary" });
      const content = Buffer.from(decrypted.data as Uint8Array);
      if (content.length > 25 * 1024 * 1024) throw new ValidationError("El mensaje descifrado supera 25 MB");
      const mail = await simpleParser(content) as ParsedMail;
      return {
        text: mail.text ?? "",
        html: sanitizeEmailHtml(typeof mail.html === "string" ? mail.html : ""),
        attachments: mail.attachments.map((item) => ({
          filename: item.filename || "adjunto",
          contentType: item.contentType,
          size: item.size,
          contentBase64: item.content.toString("base64"),
        })),
      };
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // A different key in this mailbox may be the recipient of this message.
    }
  }
  throw new ValidationError("La frase es incorrecta o ninguna clave del buzón puede abrir este mensaje");
}
