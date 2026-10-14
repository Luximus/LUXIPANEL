// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, resolvePanelApiPath, resolveTargetScope, scopeHeaders } from "@/lib/api-client";
import type { AssistantServerEntry } from "@/lib/assistant-request";
import type { ChatAttachment } from "./assistant-api";

const MAX_ENTRIES = 20;
const MAX_CONTEXT_CHARS = 28_000;
const MAX_FILE_CHARS = 8_000;
const MAX_BINARY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BINARY_BYTES = 24 * 1024 * 1024;
const TEXT_EXT = /(?:\.(?:txt|md|markdown|json|jsonc|ya?ml|toml|xml|html?|css|scss|jsx?|tsx?|vue|svelte|py|rb|php|go|rs|java|kt|sh|bash|sql|env|ini|conf|log|csv|gitignore|dockerignore)|\/(?:Dockerfile|Makefile|LICENSE|README|\.env))$/i;
const MIME_EXT: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function basename(path: string): string { return path.split("/").filter(Boolean).pop() ?? path; }
function mimeOf(path: string): string | null { return MIME_EXT[path.split(".").pop()?.toLowerCase() ?? ""] ?? null; }
function limitText(value: string, max: number): string { return value.length > max ? `${value.slice(0, max)}\n[Contenido truncado]` : value; }

async function readText(path: string): Promise<string> {
  const res = await api.get<{ content: string }>("/api/files/read", { params: { path } });
  if (!res.ok || typeof res.data?.content !== "string") throw new Error(res.error ?? "No se pudo leer el archivo");
  return limitText(res.data.content, MAX_FILE_CHARS);
}

async function binaryAttachment(path: string, mime: string, maxBytes: number): Promise<ChatAttachment> {
  const response = await fetch(resolvePanelApiPath(`/api/files/download?path=${encodeURIComponent(path)}`), {
    credentials: "include", cache: "no-store", headers: scopeHeaders(),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) { await response.body?.cancel(); throw new Error("supera el límite de adjuntos"); }
  const blob = await response.blob();
  if (blob.size > maxBytes) throw new Error("supera el límite de adjuntos");
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
  return { name: basename(path), mimeType: mime, dataBase64 };
}

/** Prepara contexto real con las API de Archivos (permisos y ámbito del servidor incluidos). */
export async function loadServerEntryContext(
  entries: AssistantServerEntry[],
  accepts: (mime: string) => boolean,
): Promise<{ context: string; attachments: ChatAttachment[]; errors: string[] }> {
  const lines: string[] = ["Elementos seleccionados en Archivos:"];
  const attachments: ChatAttachment[] = [];
  const errors: string[] = [];
  let binaryBytes = 0;
  const unique = [...new Map(entries.filter((entry) => entry?.path?.startsWith("/")).map((entry) => [entry.path, entry])).values()];
  for (const entry of unique.slice(0, MAX_ENTRIES)) {
    if (entry.targetScope && entry.targetScope !== resolveTargetScope()) throw new Error("SERVER_SCOPE_CHANGED");
    const path = entry.path;
    lines.push(`${entry.isDir ? "Carpeta" : "Archivo"}: ${path}`);
    try {
      if (entry.isDir) {
        const res = await api.get<Array<{ name: string; path: string; isDir: boolean }>>("/api/files/list", { params: { path } });
        if (!res.ok || !Array.isArray(res.data)) throw new Error(res.error ?? "No se pudo listar la carpeta");
        const children = res.data.filter((child) => child.name !== "." && child.name !== "..");
        lines.push(`Contenido inmediato (${children.length} elementos): ${children.slice(0, 80).map((child) => `${child.isDir ? "[carpeta] " : ""}${child.name}`).join(", ")}${children.length > 80 ? ", …" : ""}`);
        for (const child of children.filter((item) => !item.isDir && TEXT_EXT.test(item.name)).slice(0, 4)) {
          if (lines.join("\n").length >= MAX_CONTEXT_CHARS - MAX_FILE_CHARS) break;
          try { lines.push(`Contenido de ${child.path}:\n${await readText(child.path)}`); }
          catch { errors.push(`No se pudo leer ${child.path}`); }
        }
      } else if (TEXT_EXT.test(path)) {
        lines.push(`Contenido de ${path}:\n${await readText(path)}`);
      } else {
        const mime = mimeOf(path);
        if (mime && accepts(mime)) {
          const attachment = await binaryAttachment(path, mime, Math.min(MAX_BINARY_BYTES, MAX_TOTAL_BINARY_BYTES - binaryBytes));
          binaryBytes += Math.ceil(attachment.dataBase64.length * 3 / 4);
          attachments.push(attachment);
        }
        else lines.push("Formato sin adjunto compatible con el proveedor; se incluye la ruta para consulta.");
      }
    } catch (error) {
      errors.push(`${path}: ${error instanceof Error ? error.message : "No se pudo adjuntar"}`);
      lines.push("No se pudo leer este elemento.");
    }
  }
  if (unique.length > MAX_ENTRIES) lines.push(`Se omitieron ${unique.length - MAX_ENTRIES} elementos (límite de ${MAX_ENTRIES}).`);
  if (unique[0]?.targetScope && unique[0].targetScope !== resolveTargetScope()) throw new Error("SERVER_SCOPE_CHANGED");
  if (errors.length) lines.push(`Aviso: ${errors.join("; ")}`);
  return { context: limitText(lines.join("\n"), MAX_CONTEXT_CHARS), attachments, errors };
}
