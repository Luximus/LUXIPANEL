// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

/**
 * Lógica PURA de proveedores del asistente (fase A4): capacidad de visión del
 * proveedor/modelo activo y elección del proveedor preferido para un chat nuevo.
 * Sin imports de React ni de transporte.
 */

/** Config del proveedor activo (modo API/CLI + modelo), de `/api/ai/config`. */
export type ActiveProviderConfig = { mode: "api" | "cli"; model: string };

/**
 * Soporte de adjuntos de imagen del proveedor/modelo activo. Réplica compacta de
 * `attachmentSupport().enabled` de la web (assistant-api.ts): en modo CLI el
 * agente lee archivos del working dir (acepta imágenes) salvo DeepSeek; en modo
 * API depende de la capacidad de visión del modelo (heurística por nombre para no
 * duplicar la tabla completa de modelos). Alterna el placeholder del composer.
 */
export function composerImageSupported(provider: string, cfg: ActiveProviderConfig | null): boolean {
  if (provider === "deepseek") return false; // text-only en ambos modos
  if (!cfg) return true; // desconocido → placeholder rico (comportamiento previo)
  if (cfg.mode === "cli") return true;
  const m = (cfg.model || "").toLowerCase();
  // Modelos text-only conocidos en modo API (sin visión): minimax, o1/o3-mini, "text".
  if (/minimax|o1-mini|o3-mini|-text\b|text-only/.test(m)) return false;
  return true;
}

/**
 * Proveedor preferido para un chat NUEVO (paridad web `ChatTab`): el
 * `defaultChatProvider` de la config manda, luego `activeProvider`, luego el
 * 1.º usable. Solo se respeta el que YA está seleccionado (chat restaurado de
 * disco) si sigue siendo usable; así un panel recién abierto arranca en el
 * proveedor por defecto (p. ej. Claude) y no en otro.
 */
export function resolvePreferredProvider(args: {
  current: string;
  defaultChatProvider?: string;
  activeProvider?: string;
  providers: string[];
}): string {
  const usable = (p?: string): p is string => !!p && args.providers.includes(p);
  return (
    (usable(args.current) ? args.current : undefined) ??
    (usable(args.defaultChatProvider) ? args.defaultChatProvider : undefined) ??
    (usable(args.activeProvider) ? args.activeProvider : undefined) ??
    args.providers[0] ?? ""
  );
}
