// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import { fmtBytes } from "@/lib/format";

// ── Storage manager (chats + attachments on the target) ───────────────────

export interface StorageUsage {
  imagesBytes: number;
  chatsBytes: number;
  totalBytes: number;
}

export const assistantStorageApi = {
  async usage(): Promise<StorageUsage> {
    const res = await api.get<{ ok: boolean } & StorageUsage>("/api/ai/storage");
    const data = unwrap(res, "Failed to load storage usage");
    return { imagesBytes: data.imagesBytes, chatsBytes: data.chatsBytes, totalBytes: data.totalBytes };
  },
  async clearImages(): Promise<void> {
    const res = await api.delete("/api/ai/storage/images");
    if (!res.ok) throw new Error(res.error ?? "Failed to clear images");
  },
  async clearChats(): Promise<void> {
    const res = await api.delete("/api/ai/storage/chats");
    if (!res.ok) throw new Error(res.error ?? "Failed to clear chats");
  },
};

/** Storage readouts keep one decimal on every unit above bytes (T-07). */
export function formatBytes(n: number): string {
  return fmtBytes(n, { decimals: 1 });
}

// ── Slash command catalog (for input autocomplete) ────────────────────────

export interface SlashCommandDef {
  cmd: string;
  args?: string;
  desc: string;
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { cmd: "/help", desc: "Muestra los comandos disponibles" },
  { cmd: "/status", desc: "Proveedor, modo y modelo activos" },
  { cmd: "/provider", args: "<claude|codex|gemini|deepseek|minimax>", desc: "Cambia el proveedor activo" },
  { cmd: "/mode", args: "<api|cli>", desc: "Cambia el modo del proveedor activo" },
  { cmd: "/model", args: "<nombre>", desc: "Fija el modelo" },
  { cmd: "/mod", args: "<estado|enviar|probar|preview|…>", desc: "Gestiona tu módulo en desarrollo" },
  { cmd: "/ponytail", args: "[off|lite|full|ultra]", desc: "Modo de código minimalista (Ponytail)" },
  { cmd: "/ponytail-review", desc: "Revisa el diff buscando sobre-ingeniería" },
  { cmd: "/ponytail-audit", desc: "Audita todo el repo buscando sobre-ingeniería" },
  { cmd: "/ponytail-debt", desc: "Libro de deuda de comentarios ponytail:" },
  { cmd: "/clear", desc: "Limpia la conversación" },
];
