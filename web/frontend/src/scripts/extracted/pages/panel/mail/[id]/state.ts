// Mailbox inbox viewer — shared module-level state hub.
// LEAF module: imports NOTHING from the other inbox submodules, so every submodule
// can import it without cycles. All cross-cutting reassignable state lives on the
// exported object `S` (importers read a live `S.foo`; the owner writes `S.foo = …`
// — a plain `export let` can't be reassigned by an importer). Shared types, the
// page-derived accountId, i18n helpers and pure config constants also live here.

export type MailContact = {
  id: number;
  email: string;
  displayName?: string | null;
  useCount?: number;
};

export type MailFolder = {
  path: string;
  name: string;
  delimiter?: string;
  specialUse?: string | null;
  flags?: string[];
  unseen?: number;
  messageCount?: number;
};

export type FolderTreeNode = {
  path: string;
  label: string;
  delimiter: string;
  folder: MailFolder | null;
  children: FolderTreeNode[];
  parentPath: string | null;
};

export const PAGE_SIZE = 25;

// Load i18n translations
const i18nEl = document.getElementById("inbox-i18n");
const t = i18nEl ? JSON.parse(i18nEl.textContent || "{}") : {};
export const fallback = (path: string, def: string) => {
  const parts = path.split(".");
  let val: any = t;
  for (const part of parts) {
    val = val?.[part];
    if (!val) return def;
  }
  return val || def;
};

// Route ends in `/<id>/inbox` — the id is the segment right before the
// trailing "inbox", regardless of any path prefix (`/mail/...` or
// `/panel/mail/...`). Hardcoding index 2 broke when served without the
// `/panel` prefix (`/mail/<id>/inbox` → index 2 was the literal "inbox" →
// every /api/mail/inbox/* call 404'd).
const pathParts = window.location.pathname.split("/").filter(Boolean);
export const accountId = decodeURIComponent(pathParts[pathParts.length - 2] ?? "");

export const S = {
  currentFolder: "INBOX",
  currentUid: null as number | null,
  currentPage: 1,
  totalMessages: 0,
  folders: [] as MailFolder[],
  mailboxCredentialBroken: false,
};
