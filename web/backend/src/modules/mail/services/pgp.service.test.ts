import { describe, expect, it, vi } from "vitest";
import * as openpgp from "openpgp";
import { simpleParser } from "mailparser";

const store = new Map<string, string>();
vi.mock("../../admin/repositories/index.js", () => ({
  settingsRepository: {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => { store.set(key, value); },
  },
}));
vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: () => ({ target: { id: "pgp-test-server" } }),
  getContextUserId: () => 42,
}));
vi.mock("./mail-crypto.service.js", () => ({
  mailCryptoService: { encrypt: (value: string) => value, decrypt: (value: string) => value },
}));

import { buildMailMessage } from "./mail-message.service.js";
import { decryptMailMessage, encryptMailMessage, isPgpMime, writePgpKeys } from "./pgp.service.js";

describe("PGP/MIME", () => {
  it("encrypts an RFC822 message with an attachment and decrypts it for the mailbox", async () => {
    const passphrase = "a sufficiently long secret";
    const pair = await openpgp.generateKey({ type: "ecc", curve: "curve25519", userIDs: [{ email: "alice@example.com" }], passphrase });
    const key = await openpgp.readKey({ armoredKey: pair.publicKey });
    const fingerprint = key.getFingerprint().toUpperCase();
    await writePgpKeys([{
      keyId: fingerprint.slice(-16), fingerprint, name: "Alice", email: "alice@example.com", comment: "",
      keySize: 25519, createdAt: new Date().toISOString(), expiresAt: null, publicKey: pair.publicKey,
      privateKeyCiphertext: pair.privateKey, ownerAccountId: 7,
    }]);
    const options = {
      from: "alice@example.com", to: ["alice@example.com"], subject: "A private subject", text: "secret body",
      attachments: [{ filename: "hello.txt", contentType: "text/plain", content: Buffer.from("private attachment") }],
    };
    const { raw } = await buildMailMessage(options);
    const encrypted = await encryptMailMessage(raw, options, 7);
    expect(isPgpMime(encrypted.toString("utf8"))).toBe(true);
    expect(encrypted.toString("utf8")).not.toContain("private attachment");
    const outer = await simpleParser(encrypted);
    expect(outer.subject).toBe("A private subject");
    const opened = await decryptMailMessage(encrypted.toString("utf8"), 7, passphrase);
    expect(opened.text).toContain("secret body");
    expect(opened.attachments).toHaveLength(1);
    expect(Buffer.from(opened.attachments[0]!.contentBase64, "base64").toString()).toBe("private attachment");
  });
});
