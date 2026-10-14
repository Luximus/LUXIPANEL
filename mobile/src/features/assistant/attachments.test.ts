// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del adjuntado (picker + portapapeles). Cubren la LIMPIEZA de los
// temporales que el picker copia a la caché (`copyToCacheDirectory: true`):
// hasta 4×6MB de basura permanente por cada intento de adjuntar, incluso si los
// archivos se rechazaban por tamaño.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentAsync = vi.fn();
const readAsStringAsync = vi.fn();
const deleteAsync = vi.fn();
const hasImageAsync = vi.fn();
const getImageAsync = vi.fn();

vi.mock("expo-document-picker", () => ({ getDocumentAsync: (...a: unknown[]) => getDocumentAsync(...a) }));
vi.mock("expo-file-system/legacy", () => ({
  EncodingType: { Base64: "base64" },
  readAsStringAsync: (...a: unknown[]) => readAsStringAsync(...a),
  deleteAsync: (...a: unknown[]) => deleteAsync(...a),
}));
vi.mock("expo-clipboard", () => ({
  hasImageAsync: (...a: unknown[]) => hasImageAsync(...a),
  getImageAsync: (...a: unknown[]) => getImageAsync(...a),
}));

import { MAX_ATTACHMENT_BASE64 } from "./attachment-limits";
import { guessMime, pickDocuments, readClipboardImage } from "./attachments";

beforeEach(() => {
  vi.clearAllMocks();
  readAsStringAsync.mockResolvedValue("QUJD");
  deleteAsync.mockResolvedValue(undefined);
});

describe("guessMime", () => {
  it("resuelve por extensión y cae en octet-stream", () => {
    expect(guessMime("foto.PNG")).toBe("image/png");
    expect(guessMime("a.jpeg")).toBe("image/jpeg");
    expect(guessMime("informe.pdf")).toBe("application/pdf");
    expect(guessMime("notas.md")).toBe("text/plain");
    expect(guessMime("raro.xyz")).toBe("application/octet-stream");
    expect(guessMime("sin-extension")).toBe("application/octet-stream");
  });
});

describe("pickDocuments", () => {
  it("conserva el URI local del temporal (miniatura) y NO lo borra", async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: "foto.png", uri: "file:///cache/foto.png", mimeType: "image/png", size: 1024 }],
    });
    const res = await pickDocuments();
    expect(res).toMatchObject({ oversize: false, failed: false });
    expect(res.attachments).toEqual([
      { name: "foto.png", dataBase64: "QUJD", mime: "image/png", localUri: "file:///cache/foto.png" },
    ]);
    // El fichero sigue vivo: de él sale la miniatura hasta que el adjunto salga
    // del composer (lo borra `chat-store.setAttachments`).
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("borra el temporal del archivo descartado por tamaño (y no lo lee)", async () => {
    const big = Math.ceil((MAX_ATTACHMENT_BASE64 * 3) / 4) + 10;
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { name: "gigante.bin", uri: "file:///cache/gigante.bin", size: big },
        { name: "ok.txt", uri: "file:///cache/ok.txt", mimeType: "text/plain", size: 10 },
      ],
    });
    const res = await pickDocuments();
    expect(res.oversize).toBe(true);
    expect(res.attachments.map((a) => a.name)).toEqual(["ok.txt"]);
    expect(readAsStringAsync).toHaveBeenCalledTimes(1);
    expect(deleteAsync).toHaveBeenCalledExactlyOnceWith("file:///cache/gigante.bin", { idempotent: true });
  });

  it("borra el temporal del archivo ilegible y conserva el resto", async () => {
    readAsStringAsync
      .mockRejectedValueOnce(new Error("EACCES"))
      .mockResolvedValueOnce("QUJD");
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { name: "roto.bin", uri: "file:///cache/roto.bin", size: 10 },
        { name: "ok.txt", uri: "file:///cache/ok.txt", size: 10 },
      ],
    });
    const res = await pickDocuments();
    expect(res.failed).toBe(true);
    expect(res.attachments.map((a) => a.name)).toEqual(["ok.txt"]);
    expect(deleteAsync).toHaveBeenCalledExactlyOnceWith("file:///cache/roto.bin", { idempotent: true });
  });

  it("un borrado que falla no tumba el pick", async () => {
    deleteAsync.mockRejectedValue(new Error("ENOENT"));
    readAsStringAsync.mockRejectedValueOnce(new Error("EACCES"));
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ name: "roto.bin", uri: "file:///cache/roto.bin", size: 10 }],
    });
    await expect(pickDocuments()).resolves.toMatchObject({ attachments: [], failed: true });
  });

  it("cancelar no adjunta ni borra nada", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true });
    expect(await pickDocuments()).toEqual({ attachments: [], oversize: false, failed: false });
    expect(deleteAsync).not.toHaveBeenCalled();
  });

  it("el picker que revienta se reporta como fallo, no como excepción", async () => {
    getDocumentAsync.mockRejectedValue(new Error("boom"));
    expect(await pickDocuments()).toEqual({ attachments: [], oversize: false, failed: true });
  });
});

describe("readClipboardImage", () => {
  it("extrae el base64 y el mime del data-URI y numera el nombre", async () => {
    hasImageAsync.mockResolvedValue(true);
    getImageAsync.mockResolvedValue({ data: "data:image/png;base64,QUJD" });
    expect(await readClipboardImage(1)).toEqual({ name: "imagen-2.png", dataBase64: "QUJD", mime: "image/png" });
  });

  it("sin imagen en el portapapeles devuelve null", async () => {
    hasImageAsync.mockResolvedValue(false);
    expect(await readClipboardImage(0)).toBeNull();
  });
});
