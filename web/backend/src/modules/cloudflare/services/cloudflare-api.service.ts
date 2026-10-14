/**
 * Cloudflare API client — thin typed wrapper over the v4 REST API using the
 * native fetch. Pure HTTP: no executor, no settings access (the orchestration
 * service injects the token). Every request:
 *
 *   - carries `Authorization: Bearer <token>` (the token is never logged),
 *   - is bounded by a 10s AbortController timeout,
 *   - unwraps the standard `{ success, errors, result, result_info }`
 *     envelope and throws AppError(502, "CLOUDFLARE_API_ERROR") with the
 *     first Cloudflare error message when `success` is false.
 */

import { AppError } from "../../../shared/errors/index.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import type {
  AccessRule,
  AccessRuleInput,
  DnsCreateInput,
  DnsRecord,
  DnsUpdateInput,
  PurgeInput,
  Zone,
  ZoneSettingId,
  ZoneSettings,
} from "../models/index.js";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const REQUEST_TIMEOUT_MS = 10_000;
/** Hard cap on pagination loops, mirroring the zones contract. */
const MAX_PAGES = 10;

interface CfError {
  code: number;
  message: string;
}

interface CfResultInfo {
  page?: number;
  per_page?: number;
  total_pages?: number;
  count?: number;
  total_count?: number;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: CfError[];
  result: T;
  result_info?: CfResultInfo;
}

// ── Raw Cloudflare shapes (subset we consume) ───────────────────────────────

interface CfZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  plan?: { name?: string };
  name_servers?: string[];
}

interface CfDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
}

interface CfAccessRule {
  id: string;
  mode: string;
  notes?: string;
  configuration?: { target?: string; value?: string };
}

interface CfSettingValue {
  id: string;
  value: unknown;
}

interface CfTokenVerify {
  id: string;
  status: string;
}

// ── Core fetch ──────────────────────────────────────────────────────────────

async function cfFetch<T>(token: string, path: string, init?: RequestInit): Promise<CfEnvelope<T>> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${CF_API_BASE}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError" ? "timeout de 10s alcanzado" : errMessage(err);
    throw new AppError(
      `No se pudo contactar la API de Cloudflare: ${reason}`,
      502,
      "CLOUDFLARE_API_ERROR",
    );
  }

  let body: CfEnvelope<T>;
  try {
    body = (await res.json()) as CfEnvelope<T>;
  } catch {
    throw new AppError(
      `Cloudflare respondió HTTP ${res.status} sin un cuerpo JSON válido`,
      502,
      "CLOUDFLARE_API_ERROR",
      { httpStatus: res.status },
    );
  }

  if (!body.success) {
    const first = body.errors?.[0];
    throw new AppError(
      first?.message ?? `Cloudflare API error (HTTP ${res.status})`,
      502,
      "CLOUDFLARE_API_ERROR",
      { httpStatus: res.status, cfCode: first?.code },
    );
  }
  return body;
}

/** Collect every page of a paginated list endpoint (capped at MAX_PAGES). */
async function cfFetchAllPages<T>(token: string, basePath: string, perPage: number): Promise<T[]> {
  const sep = basePath.includes("?") ? "&" : "?";
  const items: T[] = [];
  let page = 1;
  for (;;) {
    const env = await cfFetch<T[]>(token, `${basePath}${sep}page=${page}&per_page=${perPage}`);
    items.push(...(env.result ?? []));
    const totalPages = env.result_info?.total_pages ?? 1;
    if (page >= totalPages || page >= MAX_PAGES) break;
    page += 1;
  }
  return items;
}

// ── Mappers ─────────────────────────────────────────────────────────────────

function mapZone(raw: CfZone): Zone {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    paused: Boolean(raw.paused),
    planName: raw.plan?.name ?? "",
    nameServers: raw.name_servers ?? [],
  };
}

function mapDnsRecord(raw: CfDnsRecord): DnsRecord {
  const record: DnsRecord = {
    id: raw.id,
    type: raw.type,
    name: raw.name,
    content: raw.content,
    ttl: raw.ttl,
    proxied: Boolean(raw.proxied),
  };
  if (typeof raw.priority === "number") record.priority = raw.priority;
  return record;
}

function mapAccessRule(raw: CfAccessRule): AccessRule {
  return {
    id: raw.id,
    mode: raw.mode,
    target: raw.configuration?.target ?? "",
    value: raw.configuration?.value ?? "",
    notes: raw.notes ?? "",
  };
}

function dnsRecordBody(input: DnsCreateInput | DnsUpdateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.type !== undefined) body.type = input.type;
  if (input.name !== undefined) body.name = input.name;
  if (input.content !== undefined) body.content = input.content;
  if (input.ttl !== undefined) body.ttl = input.ttl;
  if (input.proxied !== undefined) body.proxied = input.proxied;
  if (input.priority !== undefined) body.priority = input.priority;
  return body;
}

// ── Public surface ──────────────────────────────────────────────────────────

export interface TokenVerifyResult {
  valid: boolean;
  status: number;
  message: string;
}

export const cloudflareApiService = {
  /**
   * Probe GET /user/tokens/verify. Never throws for "token rejected" — the
   * /test endpoint reports the failure as data instead of a 5xx.
   */
  async verifyToken(token: string): Promise<TokenVerifyResult> {
    try {
      const env = await cfFetch<CfTokenVerify>(token, "/user/tokens/verify");
      const active = env.result?.status === "active";
      return {
        valid: active,
        status: 200,
        message: active
          ? "Token válido y activo"
          : `El token existe pero su estado es "${env.result?.status ?? "desconocido"}"`,
      };
    } catch (err) {
      if (err instanceof AppError && err.code === "CLOUDFLARE_API_ERROR") {
        const httpStatus = Number(err.context?.httpStatus ?? 0);
        return { valid: false, status: httpStatus, message: err.message };
      }
      throw err;
    }
  },

  async listZones(token: string): Promise<Zone[]> {
    const raw = await cfFetchAllPages<CfZone>(token, "/zones", 50);
    return raw.map(mapZone);
  },

  /** The four exposed settings, fetched in parallel. */
  async getZoneSettings(token: string, zoneId: string): Promise<ZoneSettings> {
    const get = (setting: ZoneSettingId) =>
      cfFetch<CfSettingValue>(token, `/zones/${zoneId}/settings/${setting}`);
    const [ssl, alwaysUseHttps, securityLevel, developmentMode] = await Promise.all([
      get("ssl"),
      get("always_use_https"),
      get("security_level"),
      get("development_mode"),
    ]);
    return {
      ssl: String(ssl.result?.value ?? ""),
      alwaysUseHttps: String(alwaysUseHttps.result?.value ?? ""),
      securityLevel: String(securityLevel.result?.value ?? ""),
      developmentMode: String(developmentMode.result?.value ?? ""),
    };
  },

  async setZoneSetting(
    token: string,
    zoneId: string,
    setting: ZoneSettingId,
    value: string,
  ): Promise<void> {
    await cfFetch(token, `/zones/${zoneId}/settings/${setting}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
  },

  async listDnsRecords(token: string, zoneId: string): Promise<DnsRecord[]> {
    const raw = await cfFetchAllPages<CfDnsRecord>(token, `/zones/${zoneId}/dns_records`, 300);
    return raw.map(mapDnsRecord);
  },

  async createDnsRecord(token: string, zoneId: string, input: DnsCreateInput): Promise<DnsRecord> {
    const env = await cfFetch<CfDnsRecord>(token, `/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify(dnsRecordBody(input)),
    });
    return mapDnsRecord(env.result);
  },

  async updateDnsRecord(
    token: string,
    zoneId: string,
    recordId: string,
    input: DnsUpdateInput,
  ): Promise<DnsRecord> {
    const env = await cfFetch<CfDnsRecord>(token, `/zones/${zoneId}/dns_records/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify(dnsRecordBody(input)),
    });
    return mapDnsRecord(env.result);
  },

  async deleteDnsRecord(token: string, zoneId: string, recordId: string): Promise<void> {
    await cfFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
  },

  async purgeCache(token: string, zoneId: string, input: PurgeInput): Promise<void> {
    const body = input.everything === true ? { purge_everything: true } : { files: input.files };
    await cfFetch(token, `/zones/${zoneId}/purge_cache`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async listAccessRules(token: string, zoneId: string): Promise<AccessRule[]> {
    const raw = await cfFetchAllPages<CfAccessRule>(
      token,
      `/zones/${zoneId}/firewall/access_rules/rules`,
      100,
    );
    return raw.map(mapAccessRule);
  },

  async createAccessRule(token: string, zoneId: string, input: AccessRuleInput): Promise<AccessRule> {
    const env = await cfFetch<CfAccessRule>(token, `/zones/${zoneId}/firewall/access_rules/rules`, {
      method: "POST",
      body: JSON.stringify({
        mode: input.mode,
        configuration: {
          target: input.ip.includes("/") ? "ip_range" : "ip",
          value: input.ip,
        },
        notes: input.notes ?? "",
      }),
    });
    return mapAccessRule(env.result);
  },

  async deleteAccessRule(token: string, zoneId: string, ruleId: string): Promise<void> {
    await cfFetch(token, `/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, {
      method: "DELETE",
    });
  },
};
