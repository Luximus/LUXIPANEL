// Normalizadores puros del módulo Mail: convierten respuestas `unknown` del
// backend a los modelos editables de `mail-types`. Sin estado ni React.
import {
  PROTECTED_FOLDER_NAMES,
  PROTECTED_SPECIAL_USE,
  ROUTING_MODES,
  SPAM_SCORE_PRESETS,
} from "./mail-constants";
import { fmtAddress, htmlToText, pick } from "./mail-format";
import type {
  ArchiveFlags,
  ArchiveDomainEntry,
  ArchiveSettings,
  Calendar,
  Contact,
  DefaultRule,
  DomainForwardEntry,
  EncryptionKey,
  FilterAction,
  FilterRule,
  FullMessage,
  MailFilter,
  MailFolder,
  MailMessage,
  ManageFolder,
  RoutingMode,
  Signature,
  SpamSettings,
} from "./mail-types";

/** Normaliza las reglas (sidecar `unknown[]`) a un modelo editable. */
export function normRules(arr: unknown): FilterRule[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((r) => {
    const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const join = o.joinWithPrevious === "or" ? "or" : o.joinWithPrevious === "and" ? "and" : undefined;
    return {
      part: typeof o.part === "string" ? o.part : "from",
      match: typeof o.match === "string" ? o.match : "contains",
      value: typeof o.value === "string" ? o.value : "",
      joinWithPrevious: join,
    } as FilterRule;
  });
}

/** Normaliza las acciones (sidecar `unknown[]`) a un modelo editable. */
export function normActions(arr: unknown): FilterAction[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((a) => {
    const o = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    return { type: typeof o.type === "string" ? o.type : "deliver_to_folder", value: typeof o.value === "string" ? o.value : undefined };
  });
}

/** Normaliza la respuesta de `listFilters` a filas con conteo de reglas. */
export function normFilters(data: unknown): MailFilter[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { filters?: unknown[] })?.filters) ? (data as { filters: unknown[] }).filters : [];
  return arr.map((f, i) => {
    const o = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
    const id = typeof o.id === "number" || typeof o.id === "string" ? o.id : i;
    return {
      id,
      name: typeof o.name === "string" ? o.name : "—",
      enabled: o.enabled !== false,
      rules: Array.isArray(o.rules) ? o.rules : [],
      actions: Array.isArray(o.actions) ? o.actions : [],
    } as MailFilter;
  });
}

/** Normaliza la respuesta de `listSignatures` a filas. */
export function normSignatures(data: unknown): Signature[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { signatures?: unknown[] })?.signatures) ? (data as { signatures: unknown[] }).signatures : [];
  return arr.map((s, i) => {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const id = typeof o.id === "number" || typeof o.id === "string" ? o.id : i;
    return {
      id,
      senderName: typeof o.senderName === "string" ? o.senderName : "",
      senderEmail: typeof o.senderEmail === "string" ? o.senderEmail : "",
      linkToSender: o.linkToSender === true,
      html: typeof o.html === "string" ? o.html : "",
    } as Signature;
  });
}

/** Normaliza la respuesta de `listFolders` a opciones {label,value}. */
export function normFolders(data: unknown): MailFolder[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { folders?: unknown[] })?.folders) ? (data as { folders: unknown[] }).folders : [];
  const out: MailFolder[] = [];
  for (const f of arr) {
    if (typeof f === "string") out.push({ label: f, value: f });
    else if (f && typeof f === "object") {
      const o = f as Record<string, unknown>;
      const value = pick(o, "path", "name", "folder", "id");
      const label = pick(o, "name", "label", "path", "folder") || value;
      if (value) out.push({ label, value });
    }
  }
  return out;
}

/** Normaliza la respuesta de `listMessages` a filas de la tabla (read-only). */
export function normMessages(data: unknown): MailMessage[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { messages?: unknown[] })?.messages) ? (data as { messages: unknown[] }).messages : [];
  return arr.map((m, i) => {
    const o = (m && typeof m === "object" ? m : {}) as Record<string, unknown>;
    const uid = pick(o, "uid", "id", "messageId", "seq");
    return {
      key: uid || String(i),
      uid,
      from: fmtAddress(o.from) || pick(o, "fromName", "sender", "fromAddress") || "—",
      subject: pick(o, "subject", "title") || "—",
      date: pick(o, "date", "receivedAt", "internalDate", "createdAt"),
    };
  });
}

/** Normaliza la respuesta de `fetchMessage` a un mensaje completo para el detalle. */
export function normFullMessage(data: unknown): FullMessage {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const html = typeof o.html === "string" ? o.html : "";
  const atts = Array.isArray(o.attachments) ? o.attachments.length : Number(o.hasAttachments ? 1 : 0) || 0;
  return {
    from: fmtAddress(o.from) || pick(o, "fromName", "sender", "fromAddress"),
    to: fmtAddress(o.to),
    subject: typeof o.subject === "string" ? o.subject : pick(o, "title"),
    date: pick(o, "date", "receivedAt", "internalDate", "createdAt"),
    body: text || htmlToText(html),
    attachments: atts,
  };
}

/** Normaliza la respuesta de `listForwards` a una lista de direcciones destino. */
export function normForwards(data: unknown): string[] {
  if (!Array.isArray(data)) {
    const inner = (data as { forwards?: unknown })?.forwards;
    return Array.isArray(inner) ? normForwards(inner) : [];
  }
  return data
    .map((f) => (typeof f === "string" ? f : pick((f && typeof f === "object" ? f : {}) as Record<string, unknown>, "to", "dest", "destination", "email", "address")))
    .filter(Boolean);
}

/** Normaliza `listContacts` a filas {id,email,displayName,useCount}. */
export function normContacts(data: unknown): Contact[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { contacts?: unknown[] })?.contacts) ? (data as { contacts: unknown[] }).contacts : [];
  return arr
    .map((c, i) => {
      const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const id = typeof o.id === "number" || typeof o.id === "string" ? o.id : i;
      return {
        id,
        email: typeof o.email === "string" ? o.email : "",
        displayName: typeof o.displayName === "string" ? o.displayName : null,
        useCount: typeof o.useCount === "number" ? o.useCount : 0,
      } as Contact;
    })
    .filter((c) => c.email);
}

/** Normaliza `listFolders` a filas de gestión, marcando carpetas protegidas. */
export function normManageFolders(data: unknown): ManageFolder[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { folders?: unknown[] })?.folders) ? (data as { folders: unknown[] }).folders : [];
  const out: ManageFolder[] = [];
  for (const f of arr) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const path = typeof o.path === "string" ? o.path : "";
    if (!path) continue;
    const name = typeof o.name === "string" && o.name ? o.name : path;
    const special = typeof o.specialUse === "string" ? o.specialUse.toLowerCase() : null;
    const isProtected =
      (special != null && PROTECTED_SPECIAL_USE.has(special)) ||
      PROTECTED_FOLDER_NAMES.has(name.toLowerCase()) ||
      PROTECTED_FOLDER_NAMES.has(path.toLowerCase());
    out.push({ path, name, specialUse: special, messageCount: typeof o.messageCount === "number" ? o.messageCount : 0, isProtected });
  }
  return out;
}

/** Normaliza la lista de dominios registrados (string[]). */
export function normDomains(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.filter((d): d is string => typeof d === "string" && d.length > 0);
}

/** Normaliza `domain-forwards` a entradas {domain,destinations[]}. */
export function normDomainForwards(data: unknown): DomainForwardEntry[] {
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((e) => {
      const o = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
      const domain = typeof o.domain === "string" ? o.domain : "";
      const destinations = Array.isArray(o.destinations) ? o.destinations.filter((x): x is string => typeof x === "string") : [];
      return { domain, destinations };
    })
    .filter((e) => e.domain);
}

/** Normaliza `domain-routing` (mapa dominio→modo). */
export function normRouting(data: unknown): Record<string, RoutingMode> {
  const o = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const out: Record<string, RoutingMode> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && (ROUTING_MODES as readonly string[]).includes(v)) out[k] = v as RoutingMode;
  }
  return out;
}

/** Normaliza `default-address` (mapa dominio→regla). */
export function normDefaultAddress(data: unknown): Record<string, DefaultRule> {
  const o = (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const out: Record<string, DefaultRule> = {};
  for (const [k, v] of Object.entries(o)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const mode = r.mode === "forward" ? "forward" : "fail";
    out[k] = {
      mode,
      failureMessage: typeof r.failureMessage === "string" ? r.failureMessage : "",
      forwardTo: typeof r.forwardTo === "string" ? r.forwardTo : "",
    };
  }
  return out;
}

/** Normaliza `spam-filters` a un modelo editable con defaults seguros. */
export function normSpam(data: unknown): SpamSettings {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const sel = typeof o.requiredScoreSelect === "string" ? o.requiredScoreSelect : "5";
  return {
    enabled: o.enabled !== false,
    spamBoxEnabled: o.spamBoxEnabled !== false,
    autoDeleteEnabled: o.autoDeleteEnabled === true,
    requiredScoreSelect: (SPAM_SCORE_PRESETS as readonly string[]).includes(sel) ? sel : "5",
    requiredScore: num(o.requiredScore, 5),
    customRequiredScore: typeof o.customRequiredScore === "number" ? o.customRequiredScore : null,
    autoDeleteThresholdScore: num(o.autoDeleteThresholdScore, 5),
    whitelistFrom: strList(o.whitelistFrom),
    blacklistFrom: strList(o.blacklistFrom),
  };
}

/** Normaliza `listCalendars` a filas {id,name,color,description,timezone,enabled}. */
export function normCalendars(data: unknown): Calendar[] {
  const arr = Array.isArray(data) ? data : Array.isArray((data as { calendars?: unknown[] })?.calendars) ? (data as { calendars: unknown[] }).calendars : [];
  return arr
    .map((c, i) => {
      const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const id = typeof o.id === "number" || typeof o.id === "string" ? o.id : i;
      return {
        id,
        name: typeof o.name === "string" ? o.name : "",
        color: typeof o.color === "string" && o.color ? o.color : "#3b82f6",
        description: typeof o.description === "string" ? o.description : null,
        timezone: typeof o.timezone === "string" && o.timezone ? o.timezone : "UTC",
        enabled: o.enabled !== false,
      } as Calendar;
    })
    .filter((c) => c.name);
}

/** Normaliza `GET /api/mail/archive` con defaults seguros. */
export function normArchive(data: unknown): ArchiveSettings {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const flags = (v: unknown): ArchiveFlags => {
    const f = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { incoming: f.incoming === true, outgoingMailingList: f.outgoingMailingList === true, outgoing: f.outgoing === true };
  };
  const domainsRaw = (o.domains && typeof o.domains === "object" && !Array.isArray(o.domains) ? o.domains : {}) as Record<string, unknown>;
  const domains: Record<string, ArchiveDomainEntry> = {};
  for (const [k, v] of Object.entries(domainsRaw)) {
    const d = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const ret = d.retentionDays === "custom" ? "custom" : typeof d.retentionDays === "number" ? d.retentionDays : 0;
    domains[k] = {
      ...flags(d),
      retentionDays: ret,
      customRetentionDays: typeof d.customRetentionDays === "number" ? d.customRetentionDays : null,
    };
  }
  return { defaults: flags(o.defaults), domains };
}

/** Normaliza `GET /api/mail/encryption` ({keys:[...]}) a filas. */
export function normEncryptionKeys(data: unknown): EncryptionKey[] {
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const arr = Array.isArray(o.keys) ? o.keys : Array.isArray(data) ? data : [];
  return arr
    .map((k) => {
      const e = (k && typeof k === "object" ? k : {}) as Record<string, unknown>;
      return {
        keyId: typeof e.keyId === "string" ? e.keyId : "",
        name: typeof e.name === "string" ? e.name : "",
        email: typeof e.email === "string" ? e.email : "",
        comment: typeof e.comment === "string" ? e.comment : "",
        expiresAt: typeof e.expiresAt === "string" ? e.expiresAt : null,
      } as EncryptionKey;
    })
    .filter((k) => k.keyId);
}
