// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Adjuntos del chat del asistente (fase A4). Aquí vive TODO el acceso a los
 * módulos nativos de adjuntado (picker de documentos, portapapeles) para que
 * `chat-controller.ts` quede libre de imports de Expo y sea testeable en node
 * mockeando solo este módulo.
 */

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Clipboard from "expo-clipboard";
import { MAX_ATTACHMENT_BASE64 } from "./attachment-limits";
import type { ChatAttachment } from "./types";

/** Adivina el mime por extensión (para adjuntos sin tipo: portapapeles, picker). */
export function guessMime(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt" || ext === "log" || ext === "md") return "text/plain";
  if (ext === "json") return "application/json";
  return "application/octet-stream";
}

/** Adjunto que conserva el URI del fichero temporal del que se leyó. El picker
 *  copia cada archivo a la caché (`copyToCacheDirectory: true`), así que ese
 *  fichero existe de verdad y sirve para dos cosas:
 *   1. la miniatura/lightbox del composer (`previewUri`), en vez de un data-URI
 *      con los hasta ~8M caracteres del base64 (ver `chat-store.setAttachments`);
 *   2. borrarlo cuando el adjunto sale del composer (enviado o descartado).
 *  Se declara como extensión de `ChatAttachment` para no tocar el dominio: el
 *  resto del código lo ve como un adjunto normal. */
export type LocalFileAttachment = ChatAttachment & { localUri?: string };

/** Borra un temporal de la caché (best-effort, idempotente). Sin esto, cada
 *  intento de adjuntar dejaba hasta 4×6MB de basura permanente en el
 *  dispositivo — incluso si los archivos se rechazaban por tamaño. */
export async function deleteLocalFile(uri: string): Promise<void> {
  try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch { /* ya no existe */ }
}

/** Resultado del picker de documentos: lo que entró + qué se descartó (para el
 *  aviso). Antes era todo-o-nada: UN archivo ilegible tiraba la selección
 *  ENTERA en silencio, y un archivo gigante se codificaba completo a base64 en
 *  memoria antes de que el merge lo rechazara. */
export type PickedDocuments = {
  attachments: LocalFileAttachment[];
  /** Algún archivo se descartó por exceder el tamaño por adjunto (sin leerlo). */
  oversize: boolean;
  /** Algún archivo no se pudo leer (o el picker falló). */
  failed: boolean;
};

/** Abre el picker de documentos (selección múltiple) y devuelve los adjuntos
 *  leídos en base64, por archivo: los ilegibles/gigantes se descartan uno a uno
 *  sin tirar el resto. Cancelación → todo vacío. */
export async function pickDocuments(): Promise<PickedDocuments> {
  try {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
    if (res.canceled) return { attachments: [], oversize: false, failed: false };
    const attachments: LocalFileAttachment[] = [];
    let oversize = false;
    let failed = false;
    // Secuencial a propósito: no codificar N archivos a base64 a la vez.
    for (const asset of res.assets ?? []) {
      // Tamaño conocido por el picker: descarta ANTES de leer (base64 ≈ 4/3 del
      // binario) para no cargar en memoria algo que el límite va a rechazar. El
      // picker YA copió el archivo a la caché → hay que borrar esa copia.
      if (asset.size && Math.ceil(asset.size / 3) * 4 > MAX_ATTACHMENT_BASE64) {
        oversize = true;
        await deleteLocalFile(asset.uri);
        continue;
      }
      try {
        attachments.push({
          name: asset.name ?? "archivo",
          dataBase64: await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 }),
          mime: asset.mimeType ?? guessMime(asset.name ?? ""),
          // El temporal SOBREVIVE al pick: de él sale la miniatura. Lo borra el
          // store cuando el adjunto sale del composer (`setAttachments`).
          localUri: asset.uri,
        });
      } catch {
        failed = true;
        await deleteLocalFile(asset.uri);
      }
    }
    return { attachments, oversize, failed };
  } catch {
    return { attachments: [], oversize: false, failed: true };
  }
}

/** Lee una imagen del portapapeles (paridad Ctrl+V de la web). `existingCount`
 *  numera el nombre generado (`imagen-N.ext`). Sin imagen / error → null. */
export async function readClipboardImage(existingCount: number): Promise<ChatAttachment | null> {
  try {
    if (!(await Clipboard.hasImageAsync())) return null;
    const img = await Clipboard.getImageAsync({ format: "png" });
    if (!img?.data) return null;
    const comma = img.data.indexOf(",");
    const base64 = comma >= 0 ? img.data.slice(comma + 1) : img.data;
    const mime = /^data:([^;]+)/.exec(img.data)?.[1] ?? "image/png";
    const ext = mime.split("/").pop() ?? "png";
    return { name: `imagen-${existingCount + 1}.${ext}`, dataBase64: base64, mime };
  } catch {
    return null;
  }
}
