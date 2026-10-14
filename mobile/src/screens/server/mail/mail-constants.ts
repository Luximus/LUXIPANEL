// Constantes del módulo Mail (sin runtime dependiente de React).
import type { RoutingMode } from "./mail-types";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

// ── Modelo de filtros Sieve (espejo de mail/types/filter.types.ts) ───────────
export const FILTER_PARTS = [
  "from", "subject", "to", "any_recipient", "reply", "body", "any_header",
  "not_delivered", "error_message", "list_id", "spam_status", "spam_bar", "spam_score",
] as const;
export const FILTER_MATCHES = [
  "contains", "matches", "does_not_contain", "is", "begins", "ends",
  "does_not_begin", "does_not_end", "does_not_match", "is_above", "is_not_above", "is_below", "is_not_below",
] as const;
// Orden pensado para el menú (mover/redirigir primero).
export const FILTER_ACTIONS = ["deliver_to_folder", "redirect", "discard", "stop", "fail", "pipe"] as const;
/** Tipos de acción que requieren un valor (destino/carpeta/comando/mensaje). */
export const ACTION_NEEDS_VALUE = new Set<string>(["deliver_to_folder", "redirect", "pipe", "fail"]);

export const PROTECTED_FOLDER_NAMES = new Set(["inbox", "sent", "trash"]);
export const PROTECTED_SPECIAL_USE = new Set(["\\inbox", "\\sent", "\\trash"]);
export const ROUTING_MODES: readonly RoutingMode[] = ["auto_remote", "local", "backup", "remote"];
export const SPAM_SCORE_PRESETS = ["1", "4", "5", "8", "10", "custom"] as const;

/** Opciones de retención del backend (días; 0 = para siempre). */
export const RETENTION_OPTIONS = [32, 93, 181, 366, 731, 1826, 3651, 0] as const;
