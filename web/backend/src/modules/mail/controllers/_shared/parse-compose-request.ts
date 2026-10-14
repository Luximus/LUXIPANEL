// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import path from "node:path";
import Busboy from "busboy";
import type { Request } from "express";
import { AppError, ValidationError } from "../../../../shared/errors/index.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
export type MailUpload = { filename: string; contentType: string; content: Buffer };

/** Route-local multipart parser; the app-wide JSON middleware does not parse FormData. */
export async function parseComposeRequest(req: Request): Promise<{ fields: Record<string, unknown>; attachments: MailUpload[] }> {
  if (!req.is("multipart/form-data")) {
    return { fields: (req.body ?? {}) as Record<string, unknown>, attachments: [] };
  }
  return new Promise((resolve, reject) => {
    const fields: Record<string, unknown> = {};
    const attachments: MailUpload[] = [];
    let total = 0;
    let failure: Error | null = null;
    const fail = (error: Error) => { failure ??= error; };
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: { files: 10, fields: 20, fieldSize: 64 * 1024, fileSize: MAX_FILE_BYTES, parts: 30 },
      });
    } catch {
      reject(new ValidationError("Formulario de correo inválido"));
      return;
    }
    parser.on("field", (name, value, info) => {
      if (info.valueTruncated) fail(new AppError("Campo de correo demasiado grande", 413, "MAIL_UPLOAD_TOO_LARGE"));
      total += Buffer.byteLength(value);
      if (total > MAX_TOTAL_BYTES) fail(new AppError("El correo supera 25 MB", 413, "MAIL_UPLOAD_TOO_LARGE"));
      if (["to", "cc", "bcc"].includes(name)) {
        try { fields[name] = JSON.parse(value); } catch { fields[name] = value; }
      } else {
        fields[name] = value;
      }
    });
    parser.on("file", (name, file, info) => {
      const chunks: Buffer[] = [];
      let size = 0;
      file.on("data", (chunk: Buffer) => {
        size += chunk.length;
        total += chunk.length;
        if (total > MAX_TOTAL_BYTES) fail(new AppError("El correo supera 25 MB", 413, "MAIL_UPLOAD_TOO_LARGE"));
        if (!failure) chunks.push(chunk);
      });
      file.on("limit", () => fail(new AppError("Un adjunto supera 10 MB", 413, "MAIL_UPLOAD_TOO_LARGE")));
      file.on("end", () => {
        if (name !== "attachments" || failure) return;
        attachments.push({
          filename: path.basename(info.filename || "adjunto").replace(/[\r\n\x00-\x1f]/g, "_").slice(0, 255),
          contentType: info.mimeType || "application/octet-stream",
          content: Buffer.concat(chunks, size),
        });
      });
    });
    parser.on("filesLimit", () => fail(new AppError("Máximo 10 adjuntos", 413, "MAIL_UPLOAD_TOO_LARGE")));
    parser.on("fieldsLimit", () => fail(new ValidationError("Demasiados campos en el correo")));
    parser.on("partsLimit", () => fail(new ValidationError("Formulario de correo demasiado grande")));
    parser.on("error", reject);
    parser.on("finish", () => failure ? reject(failure) : resolve({ fields, attachments }));
    req.pipe(parser);
  });
}
