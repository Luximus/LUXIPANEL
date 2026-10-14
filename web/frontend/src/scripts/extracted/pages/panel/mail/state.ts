// Mail page — shared module-level state hub.
// LEAF module: imports NOTHING from the other mail submodules, so every submodule
// can import it without cycles. All cross-cutting reassignable state lives on the
// exported object `S` (importers read a live `S.foo`; the owner writes `S.foo = …`
// — a plain `export let` can't be reassigned by an importer). Shared types, the
// DataTable id list, validation regexes and pure config constants also live here.

export type MailForward = { id?: number; destination: string; keepCopy: boolean };
export type MailAccount = {
  id: number;
  address: string;
  domain?: string;
  quotaMb?: number;
  usedMb?: number | null;
  usedPercent?: number | null;
  incomingMode?: "allow" | "suspend";
  outgoingMode?: "allow" | "suspend" | "hold";
  loginMode?: "allow" | "suspend";
  plusAddressingAutoFolder?: boolean;
  forwardCount?: number;
  forwards?: Array<{ destination: string; keepCopy?: boolean }>;
  enabled: boolean;
};
export type DiskUsageFolder = {
  path: string;
  name: string;
  messageCount: number;
  sizeBytes: number;
  sizeFormatted: string;
};
export type MailFilterRulePart =
  | "from"
  | "subject"
  | "to"
  | "any_recipient"
  | "reply"
  | "body"
  | "any_header"
  | "not_delivered"
  | "error_message"
  | "list_id"
  | "spam_status"
  | "spam_bar"
  | "spam_score";
export type MailFilterRuleMatch =
  | "contains"
  | "matches"
  | "does_not_contain"
  | "is"
  | "begins"
  | "ends"
  | "does_not_begin"
  | "does_not_end"
  | "does_not_match"
  | "is_above"
  | "is_not_above"
  | "is_below"
  | "is_not_below";
export type MailFilterRule = {
  part: MailFilterRulePart;
  match: MailFilterRuleMatch;
  value: string;
  joinWithPrevious?: "and" | "or";
};
export type MailFilterActionType = "discard" | "redirect" | "fail" | "stop" | "deliver_to_folder" | "pipe";
export type MailFilterAction = { type: MailFilterActionType; value?: string };
export type MailFilter = {
  id: number;
  accountId: number;
  name: string;
  enabled: boolean;
  position: number;
  rules: MailFilterRule[];
  actions: MailFilterAction[];
};
export type MailAutoresponder = {
  id: number;
  accountId: number;
  enabled: boolean;
  charset: string;
  intervalHours: number;
  localPart: string;
  domain: string;
  fromName?: string | null;
  subject: string;
  body: string;
  isHtml: boolean;
  startAt?: string | null;
  stopAt?: string | null;
};
export type MailContact = {
  id: number;
  accountId: number;
  email: string;
  displayName?: string | null;
  useCount?: number;
};
export type MailCalendar = {
  id: number;
  accountId: number;
  name: string;
  description?: string | null;
  color: string;
  timezone: string;
  enabled: boolean;
};
export type DomainForwardRule = {
  domain: string;
  destinations: string[];
};
export type MailRoutingMode = "auto_remote" | "local" | "backup" | "remote";
export type DefaultAddressMode = "fail" | "forward";
export type DefaultAddressRule = {
  mode: DefaultAddressMode;
  failureMessage?: string;
  forwardTo?: string;
};
export type MailTrackDeliveryStatus = "success" | "deferred" | "failure" | "in_progress";
export type MailTrackDeliveryItem = {
  queueId: string;
  sentTime: string;
  fromAddress: string;
  recipient: string;
  status: MailTrackDeliveryStatus;
  result: string;
  spamScore: number | null;
  raw: string;
};
export type GlobalMailFilter = {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
  rules: MailFilterRule[];
  actions: MailFilterAction[];
};
export type MailTrackColumnKey = "event" | "fromAddress" | "sentTime" | "spamScore" | "recipient" | "domain" | "queueId" | "result" | "actions";
export type MailMainTab = "emails" | "spam-filters" | "track-delivery" | "global-filters";
export type MailSettingsView = "table" | "menu" | "routing" | "domain-redirect" | "default-address" | "archive" | "encryption" | "outbound";
export type MailSpamView = "overview" | "adjust-threshold" | "spam-box" | "auto-delete" | "whitelist" | "blacklist" | "calculated";
export type RequiredScoreSelect = "1" | "4" | "5" | "8" | "10" | "custom";
export type SpamCalculatedScore = { type: string; score: number };
export type EncryptionKeyItem = { keyId: string; name: string; email: string; comment: string; keySize: number; createdAt: string; expiresAt: string | null; publicKey: string; privateKeyMasked: string; fingerprint?: string; status?: "valid" | "legacy_invalid" };
export type EncryptionSettings = { keys: EncryptionKeyItem[] };
export type ArchiveDomainSettings = {
  incoming: boolean;
  outgoingMailingList: boolean;
  outgoing: boolean;
  retentionDays: number | "custom";
  customRetentionDays: number | null;
};
export type ArchiveSettings = {
  active?: boolean;
  legacyConfigured?: boolean;
  integration?: { available: boolean; reason: string };
  defaults: { incoming: boolean; outgoingMailingList: boolean; outgoing: boolean };
  domains: Record<string, ArchiveDomainSettings>;
};
export type SpamFiltersSettings = {
  applied?: boolean;
  legacyConfigured?: boolean;
  integration?: { available: boolean; reason: string };
  enabled: boolean;
  spamBoxEnabled: boolean;
  autoDeleteEnabled: boolean;
  requiredScoreSelect: RequiredScoreSelect;
  requiredScore: number;
  customRequiredScore: number | null;
  autoDeleteThresholdScore: number;
  whitelistFrom: string[];
  blacklistFrom: string[];
  calculatedScores: SpamCalculatedScore[];
};

export const MAIL_TABLE_IDS = [
  "mail-redirect-table",
  "mail-encryption-public-table",
  "mail-encryption-private-table",
  "mail-accounts-table",
  "mail-global-filters-table",
  "mail-contacts-table",
  "mail-calendars-table",
  "mail-filters-table",
] as const;
export const LOCAL_PART_RE = /^[a-zA-Z0-9._%+-]+$/;
export const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DOMAIN_RE = /^[a-zA-Z0-9.-]+$/;
export const MAIL_DEFAULT_ACCOUNT_KEY_PREFIX = "luxipanel-mail-default-account";
export const TRACK_DEFAULT_COLUMNS: MailTrackColumnKey[] = ["event", "fromAddress", "sentTime", "spamScore", "recipient", "result", "actions"];

export const S = {
  // ── read cache / sudo prompt guard (formerly top-of-file lets) ──
  sudoPromptShown: false,
  serverDiskTotalMb: 0,

  // ── accounts + domains + open-dialog target ids ──
  accounts: [] as MailAccount[],
  accountsTotal: 0,
  domains: [] as string[],
  editAccountId: null as number | null,
  editAccountDomain: "",
  diskUsageAccountId: null as number | null,
  filtersAccountId: null as number | null,
  loadedFilters: [] as MailFilter[],
  autoresponderAccountId: null as number | null,
  autoresponderExists: false,
  autoresponderCharsets: [] as string[],
  contactsAccountId: null as number | null,
  loadedContacts: [] as MailContact[],
  calendarsAccountId: null as number | null,
  loadedCalendars: [] as MailCalendar[],
  mailDomainForwardRules: [] as DomainForwardRule[],
  mailDomainRoutingByDomain: {} as Record<string, MailRoutingMode>,
  mailDefaultAddressByDomain: {} as Record<string, DefaultAddressRule>,
  mailTrackDeliveryItems: [] as MailTrackDeliveryItem[],
  mailTrackDeliveryMode: "all" as "all" | "blocked_failed",
  loadedGlobalMailFilters: [] as GlobalMailFilter[],
  mailTrackColumns: new Set<MailTrackColumnKey>(TRACK_DEFAULT_COLUMNS),
  mailMainTab: "emails" as MailMainTab,
  mailTrackDeliveryLoaded: false,
  mailGlobalFiltersLoaded: false,
  mailSettingsView: "table" as MailSettingsView,
  mailSpamFiltersLoaded: false,
  mailSpamScoreTypes: [] as string[],
  mailSpamSettings: null as SpamFiltersSettings | null,
  mailSpamView: "overview" as MailSpamView,
  mailArchiveSettings: null as ArchiveSettings | null,
  mailEncryptionSettings: null as EncryptionSettings | null,
  didAutoOpenDefaultInbox: false,

  // ── clone dialog ──
  cloneSourceId: 0,
  cloneSubmitting: false,

  // ── module deps + init lifecycle guards ──
  mailDepsWereMissing: false,
  mailInitInFlight: null as Promise<void> | null,
  mailLastInitAt: 0,
  mailLastBoundRoot: null as Element | null,
};
