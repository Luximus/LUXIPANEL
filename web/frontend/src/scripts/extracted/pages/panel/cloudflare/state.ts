// Cloudflare page — shared module-level state hub + shared types + DataTable ids.
// LEAF module: imports NOTHING from the other cloudflare submodules, so every
// submodule can import it without cycles. Cross-submodule reassignable state
// lives on the exported `state` object (importers read live `state.foo`; the
// owner writes `state.foo = …`).

// ── Types (mirror backend models) ──────────────────────────────────────────
export interface CfConfig {
  tokenSet: boolean;
  tokenPreview: string;
}
export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  planName: string;
  nameServers: string[];
}
export interface ZoneSettings {
  ssl: string;
  alwaysUseHttps: string;
  securityLevel: string;
  developmentMode: string;
}
export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
  pointsToServer: boolean;
}
export interface DnsListResult {
  records: DnsRecord[];
  serverIp: string | null;
}
export interface AccessRule {
  id: string;
  mode: string;
  target: string;
  value: string;
  notes: string;
}
export interface TestResult {
  valid: boolean;
  status: number;
  message: string;
}
export interface ServerIpResult {
  ip: string | null;
}

export type Tab = "dns" | "cache" | "security" | "access" | "config";

export const CF_DNS_TABLE_ID = "cf-dns-table";
export const CF_ACCESS_TABLE_ID = "cf-access-table";

export const state = {
  tokenSet: false,
  tokenPreview: "",
  zones: [] as Zone[],
  zoneId: null as string | null,
  tab: "dns" as Tab,
  records: [] as DnsRecord[],
  rules: [] as AccessRule[],
  settings: null as ZoneSettings | null,
  serverIp: null as string | null,
  dnsMode: "create" as "create" | "edit",
  dnsEditId: null as string | null,
};
