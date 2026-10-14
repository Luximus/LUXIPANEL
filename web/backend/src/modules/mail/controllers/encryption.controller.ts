// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { z } from "zod";
import * as openpgp from "openpgp";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { settingsRepository } from "../../admin/repositories/index.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { getContextUserId } from "../../../shared/executor/context.js";
import { visibleMailDomains } from "./_shared/mail-access.js";
import { requireOwnedMailAccount } from "./mailbox-account.helpers.js";
import { fnv1aId } from "./accounts.helpers.js";
import { mailCryptoService } from "../services/mail-crypto.service.js";
import { decryptMailMessage, keyEmail, keyExpiry, readPgpKeys, writePgpKeys, type PgpStoredKey } from "../services/pgp.service.js";
import { imapService } from "../services/index.js";

const LEGACY_KEY = "mail_encryption_settings_v1";
const generateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  comment: z.string().trim().max(120).optional().default(""),
  passphrase: z.string().min(12).max(256),
  confirmPassphrase: z.string().min(12).max(256),
  expirationValue: z.coerce.number().int().min(1).max(100),
  expirationUnit: z.enum(["d", "w", "m", "y"]),
  noExpire: z.boolean().default(false),
  keySize: z.union([z.literal(3072), z.literal(4096)]),
}).refine((body) => body.passphrase === body.confirmPassphrase, "Las frases no coinciden");
const publicImportSchema = z.object({ armoredPublicKey: z.string().trim().min(80).max(200_000) });
const privateImportSchema = z.object({
  armoredPrivateKey: z.string().trim().min(80).max(500_000),
  passphrase: z.string().min(1).max(256),
});

function expirationSeconds(value: number, unit: "d" | "w" | "m" | "y"): number {
  return value * ({ d: 1, w: 7, m: 30, y: 365 }[unit]) * 86400;
}

async function assertOwnedAddress(email: string): Promise<number> {
  const account = await requireOwnedMailAccount(fnv1aId(email));
  if (account.address.toLowerCase() !== email.toLowerCase()) throw new ForbiddenError("Buzón no autorizado");
  return account.id;
}

async function visible(keys: PgpStoredKey[]): Promise<PgpStoredKey[]> {
  const domains = await visibleMailDomains();
  const userId = getContextUserId();
  return keys.filter((key) => key.ownerAccountId
    ? !domains || domains.has(key.email.split("@")[1] ?? "")
    : key.importerUserId === userId);
}

function redacted(key: PgpStoredKey) {
  const { privateKeyCiphertext: _secret, importerUserId: _importer, ...safe } = key;
  return { ...safe, privateKeyMasked: key.privateKeyCiphertext ? "Protegida" : "N/A", status: "valid" };
}

async function listData() {
  const valid = (await visible(await readPgpKeys())).map(redacted);
  const rawLegacy = await settingsRepository.get(LEGACY_KEY);
  let legacy: Array<Record<string, unknown>> = [];
  try { legacy = rawLegacy ? (JSON.parse(rawLegacy) as { keys?: Array<Record<string, unknown>> }).keys ?? [] : []; } catch { /* ignore corrupt legacy */ }
  const domains = await visibleMailDomains();
  return { keys: [
    ...valid,
    ...legacy.filter((key) => !domains || domains.has(String(key.email ?? "").split("@")[1] ?? ""))
      .map((key) => ({ ...key, status: "legacy_invalid", privateKeyMasked: "No disponible" })),
  ] };
}

export const encryptionController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ ok: true, data: await listData() });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const body = generateSchema.parse(req.body);
    const email = body.email.toLowerCase();
    const ownerAccountId = await assertOwnedAddress(email);
    const generated = await openpgp.generateKey({
      type: "rsa",
      rsaBits: body.keySize,
      userIDs: [{ name: body.name, email, comment: body.comment || undefined }],
      passphrase: body.passphrase,
      keyExpirationTime: body.noExpire ? undefined : expirationSeconds(body.expirationValue, body.expirationUnit),
      format: "armored",
    });
    const parsed = await openpgp.readKey({ armoredKey: generated.publicKey });
    const fingerprint = parsed.getFingerprint().toUpperCase();
    const item: PgpStoredKey = {
      keyId: fingerprint.slice(-16), fingerprint, name: body.name, email, comment: body.comment,
      keySize: body.keySize, createdAt: new Date().toISOString(), expiresAt: await keyExpiry(parsed),
      publicKey: generated.publicKey, privateKeyCiphertext: mailCryptoService.encrypt(generated.privateKey), ownerAccountId,
    };
    const keys = await readPgpKeys();
    keys.unshift(item);
    await writePgpKeys(keys);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data: { ...(await listData()), backup: { privateKey: generated.privateKey, revocationCertificate: generated.revocationCertificate } } });
  }),

  importPublic: asyncHandler(async (req: Request, res: Response) => {
    const { armoredPublicKey } = publicImportSchema.parse(req.body);
    let parsed: openpgp.PublicKey;
    try { parsed = await openpgp.readKey({ armoredKey: armoredPublicKey }); await parsed.getEncryptionKey(); }
    catch { throw new ValidationError("La clave pública OpenPGP no es válida para cifrar"); }
    const email = keyEmail(parsed);
    if (!email) throw new ValidationError("La clave pública debe contener un correo válido");
    const fingerprint = parsed.getFingerprint().toUpperCase();
    const userId = getContextUserId();
    if (userId === null) throw new ForbiddenError("No se identificó el usuario de la sesión");
    const keys = await readPgpKeys();
    if (keys.some((key) => key.fingerprint === fingerprint && key.importerUserId === userId)) throw new ValidationError("Esta clave ya está importada");
    keys.unshift({
      keyId: fingerprint.slice(-16), fingerprint, name: parsed.getUserIDs()[0] ?? email, email,
      comment: "", keySize: parsed.getAlgorithmInfo().bits ?? 0, createdAt: new Date().toISOString(),
      expiresAt: await keyExpiry(parsed), publicKey: parsed.armor(), importerUserId: userId,
    });
    await writePgpKeys(keys);
    res.json({ ok: true, data: await listData() });
  }),

  importPrivate: asyncHandler(async (req: Request, res: Response) => {
    const { armoredPrivateKey, passphrase } = privateImportSchema.parse(req.body);
    let parsed: openpgp.PrivateKey;
    try { parsed = await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey }); }
    catch { throw new ValidationError("La clave privada OpenPGP no es válida"); }
    const email = keyEmail(parsed);
    if (!email) throw new ValidationError("La clave privada debe contener un correo válido");
    const ownerAccountId = await assertOwnedAddress(email);
    let unlocked: openpgp.PrivateKey;
    try { unlocked = await openpgp.decryptKey({ privateKey: parsed, passphrase }); }
    catch { throw new ValidationError("La frase no desbloquea la clave privada"); }
    const protectedKey = await openpgp.encryptKey({ privateKey: unlocked, passphrase });
    const publicKey = protectedKey.toPublic();
    const fingerprint = publicKey.getFingerprint().toUpperCase();
    const keys = await readPgpKeys();
    if (keys.some((key) => key.fingerprint === fingerprint && key.ownerAccountId === ownerAccountId)) throw new ValidationError("Esta clave privada ya está importada");
    keys.unshift({
      keyId: fingerprint.slice(-16), fingerprint, name: parsed.getUserIDs()[0] ?? email, email,
      comment: "", keySize: parsed.getAlgorithmInfo().bits ?? 0, createdAt: new Date().toISOString(),
      expiresAt: await keyExpiry(publicKey), publicKey: publicKey.armor(),
      privateKeyCiphertext: mailCryptoService.encrypt(protectedKey.armor()), ownerAccountId,
    });
    await writePgpKeys(keys);
    res.json({ ok: true, data: await listData() });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const keyId = String(req.params.keyId ?? "").toUpperCase();
    const keys = await readPgpKeys();
    const index = keys.findIndex((key) => key.keyId === keyId);
    if (index < 0) throw new NotFoundError("Clave");
    const key = keys[index]!;
    if (key.ownerAccountId) await assertOwnedAddress(key.email);
    else if (key.importerUserId !== getContextUserId()) throw new ForbiddenError("Clave no autorizada");
    if (key.privateKeyCiphertext && req.query.confirm !== "true") {
      throw new ValidationError("Eliminar esta clave impedirá leer correos antiguos. Confirma con confirm=true después de exportarla.");
    }
    keys.splice(index, 1);
    await writePgpKeys(keys);
    res.json({ ok: true, data: await listData() });
  }),

  decrypt: asyncHandler(async (req: Request, res: Response) => {
    const accountId = Number.parseInt(String(req.params.accountId), 10);
    const uid = Number.parseInt(String(req.params.uid), 10);
    const { passphrase, folder } = z.object({ passphrase: z.string().min(1).max(256), folder: z.string().min(1).default("INBOX") }).parse(req.body);
    const account = await requireOwnedMailAccount(accountId);
    const source = await imapService.fetchRawMessage(account.address, account.passwordEncrypted, folder, uid);
    if (!source) throw new NotFoundError("Mensaje");
    const decrypted = await decryptMailMessage(source, account.id, passphrase);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, data: decrypted });
  }),
};
