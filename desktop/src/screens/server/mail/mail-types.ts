// Tipos de dominio del módulo Mail. Sin runtime: los comparten `MailScreen`,
// los normalizadores (`mail-normalizers`) y los formateadores (`mail-format`).

// ── Filtros Sieve (espejo de mail/types/filter.types.ts) ─────────────────────
export type FilterRule = { part: string; match: string; value: string; joinWithPrevious?: "and" | "or" };
export type FilterAction = { type: string; value?: string };
export type MailFilter = { id: string | number; name: string; enabled?: boolean; rules?: unknown[]; actions?: unknown[] };
export type Autoresponder = {
  enabled?: boolean; charset?: string; intervalHours?: number; localPart?: string; domain?: string;
  fromName?: string | null; subject?: string; body?: string; isHtml?: boolean; startAt?: string | null; stopAt?: string | null;
};
export type Signature = { id: string | number; senderName?: string; senderEmail?: string; linkToSender?: boolean; html?: string };

export type MailAccount = { id: string | number; address: string; domain?: string; quota?: number; used?: number; enabled?: boolean };
export type MailFolder = { label: string; value: string };
export type MailMessage = { key: string; uid: string; from: string; subject: string; date: string };
/** Mensaje completo (detalle) tras `fetchMessage`. */
export type FullMessage = { from: string; to: string; subject: string; date: string; body: string; attachments: number };
/** Datos de pre-llenado para Redactar/Responder. */
export type ComposeSeed = { fromId?: string; to?: string; cc?: string; subject?: string; body?: string };

// ── Contactos · carpetas IMAP · ajustes de dominio ───────────────────────────
export type Contact = { id: string | number; email: string; displayName: string | null; useCount: number };
export type ManageFolder = { path: string; name: string; specialUse: string | null; messageCount: number; isProtected: boolean };
export type DomainForwardEntry = { domain: string; destinations: string[] };
export type RoutingMode = "auto_remote" | "local" | "backup" | "remote";
export type DefaultRule = { mode: "fail" | "forward"; failureMessage: string; forwardTo: string };
export type SpamSettings = {
  enabled: boolean;
  spamBoxEnabled: boolean;
  autoDeleteEnabled: boolean;
  requiredScoreSelect: string;
  requiredScore: number;
  customRequiredScore: number | null;
  autoDeleteThresholdScore: number;
  whitelistFrom: string[];
  blacklistFrom: string[];
};

// ── Calendarios · Archivado · Cifrado PGP ────────────────────────────────────
export type Calendar = { id: string | number; name: string; color: string; description: string | null; timezone: string; enabled: boolean };
export type ArchiveFlags = { incoming: boolean; outgoingMailingList: boolean; outgoing: boolean };
export type ArchiveDomainEntry = ArchiveFlags & { retentionDays: number | "custom"; customRetentionDays: number | null };
export type ArchiveSettings = { defaults: ArchiveFlags; domains: Record<string, ArchiveDomainEntry> };
export type EncryptionKey = { keyId: string; name: string; email: string; comment: string; expiresAt: string | null };
