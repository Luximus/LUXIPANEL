// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail filter types and allowed values (compatible with cPanel-like UI).
 */

export const FILTER_RULE_PARTS = [
  "from",
  "subject",
  "to",
  "any_recipient",
  "reply",
  "body",
  "any_header",
  "not_delivered",
  "error_message",
  "list_id",
  "spam_status",
  "spam_bar",
  "spam_score",
] as const;

export const FILTER_RULE_MATCHES = [
  "contains",
  "matches",
  "does_not_contain",
  "is",
  "begins",
  "ends",
  "does_not_begin",
  "does_not_end",
  "does_not_match",
  "is_above",
  "is_not_above",
  "is_below",
  "is_not_below",
] as const;

export const FILTER_RULE_LOGIC = ["and", "or"] as const;

// `pipe` (vnd.dovecot.pipe) is a tenant-side RCE primitive — it shells out to
// an arbitrary command as the vmail user on every matched message, so it can
// never be exposed to tenant mailboxes without reducing the security model of
// the whole server to "user-controlled shell". Restricted to admin-side use
// only (the FILTER_ADMIN_ACTION_TYPES allowlist, kept here as a comment for
// discovery).
export const FILTER_ACTION_TYPES = [
  "discard",
  "redirect",
  "fail",
  "stop",
  "deliver_to_folder",
] as const;
export const FILTER_ADMIN_ACTION_TYPES = ["pipe"] as const;

export type FilterRulePart = (typeof FILTER_RULE_PARTS)[number];
export type FilterRuleMatch = (typeof FILTER_RULE_MATCHES)[number];
export type FilterRuleLogic = (typeof FILTER_RULE_LOGIC)[number];
export type FilterActionType = (typeof FILTER_ACTION_TYPES)[number];
/** Acciones reservadas a admin (hoy: `pipe`). NO están en FILTER_ACTION_TYPES:
 *  ese allowlist es el que se valida contra la entrada de un INQUILINO. */
export type FilterAdminActionType = (typeof FILTER_ADMIN_ACTION_TYPES)[number];
/**
 * Toda acción que el compilador de Sieve sabe renderizar, admin incluida.
 *
 * El gate de seguridad de `pipe` vive en la VALIDACIÓN (solo la ruta de admin
 * acepta ese tipo), no aquí: el renderer tiene que poder emitirla, porque un
 * filtro global de admin legítimamente la usa. Confundir ambas capas es lo que
 * dejó el compilador sin la rama `pipe` y el fichero sin compilar.
 */
export type AnyFilterActionType = FilterActionType | FilterAdminActionType;

export type MailFilterRule = {
  part: FilterRulePart;
  match: FilterRuleMatch;
  value: string;
  /** Logical connector with previous rule (ignored for first rule). */
  joinWithPrevious?: FilterRuleLogic;
};

export type MailFilterAction = {
  // Admin incluida: un filtro GLOBAL (solo-admin) puede llevar `pipe`, y este
  // tipo describe también esos filtros. Lo que impide que un inquilino la use
  // es la validación de su ruta contra FILTER_ACTION_TYPES.
  type: AnyFilterActionType;
  value?: string;
};

export type MailFilterDefinition = {
  name: string;
  enabled: boolean;
  rules: MailFilterRule[];
  actions: MailFilterAction[];
};
