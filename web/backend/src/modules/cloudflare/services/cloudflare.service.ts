/**
 * Cloudflare orchestration service — joins the stored token (config service)
 * with the v4 API client, and annotates DNS records with whether they point
 * at the CONNECTED server (its public IP is probed through the Executor, so
 * the answer is per-target, honouring the managed-mode isolation invariant).
 */

import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import {
  isValidIp,
  type AccessRule,
  type AccessRuleInput,
  type AnnotatedDnsRecord,
  type DnsCreateInput,
  type DnsRecord,
  type DnsUpdateInput,
  type PurgeInput,
  type Zone,
  type ZoneSettingId,
  type ZoneSettings,
} from "../models/index.js";
import { cloudflareConfigService } from "./cloudflare-config.service.js";
import { cloudflareApiService, type TokenVerifyResult } from "./cloudflare-api.service.js";

const log = createModuleLogger("cloudflare");

/**
 * Public-IP probe, run ON THE CONNECTED SERVER. Three fallbacks; stderr is
 * discarded so a missing binary just falls through to the next probe.
 */
const IP_PROBE_CMD =
  "curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null" +
  " || curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null" +
  " || dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null";

/**
 * Best-effort public IP of the connected server. NEVER throws — DNS listing
 * must keep working when the probe fails (records simply lose the
 * pointsToServer annotation).
 */
export async function getServerPublicIp(executor: Executor): Promise<string | null> {
  try {
    const result = await executor.exec(`sh -lc ${quoteArg(IP_PROBE_CMD)}`, { timeoutMs: 20_000 });
    const candidate =
      result.stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0) ?? "";
    return isValidIp(candidate) ? candidate : null;
  } catch (err) {
    log.warn({ err: errMessage(err) }, "Server public-IP probe failed");
    return null;
  }
}

function annotate(records: DnsRecord[], serverIp: string | null): AnnotatedDnsRecord[] {
  return records.map((record) => ({
    ...record,
    pointsToServer: serverIp !== null && record.content === serverIp,
  }));
}

export const cloudflareService = {
  getServerPublicIp,

  /** Verify the stored token. Missing token reports as data, not a 409. */
  async testToken(): Promise<TokenVerifyResult> {
    const { tokenSet } = await cloudflareConfigService.getConfig();
    if (!tokenSet) {
      return { valid: false, status: 0, message: "No hay un token de API de Cloudflare configurado" };
    }
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.verifyToken(token);
  },

  async listZones(): Promise<Zone[]> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.listZones(token);
  },

  async getZoneSettings(zoneId: string): Promise<ZoneSettings> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.getZoneSettings(token, zoneId);
  },

  async setZoneSetting(zoneId: string, setting: ZoneSettingId, value: string): Promise<void> {
    const token = await cloudflareConfigService.getToken();
    await cloudflareApiService.setZoneSetting(token, zoneId, setting, value);
  },

  /** DNS records annotated with pointsToServer (vs. the target's public IP). */
  async listDnsRecords(
    executor: Executor,
    zoneId: string,
  ): Promise<{ records: AnnotatedDnsRecord[]; serverIp: string | null }> {
    const token = await cloudflareConfigService.getToken();
    const [records, serverIp] = await Promise.all([
      cloudflareApiService.listDnsRecords(token, zoneId),
      getServerPublicIp(executor),
    ]);
    return { records: annotate(records, serverIp), serverIp };
  },

  async createDnsRecord(zoneId: string, input: DnsCreateInput): Promise<DnsRecord> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.createDnsRecord(token, zoneId, input);
  },

  async updateDnsRecord(zoneId: string, recordId: string, input: DnsUpdateInput): Promise<DnsRecord> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.updateDnsRecord(token, zoneId, recordId, input);
  },

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    const token = await cloudflareConfigService.getToken();
    await cloudflareApiService.deleteDnsRecord(token, zoneId, recordId);
  },

  async purgeCache(zoneId: string, input: PurgeInput): Promise<void> {
    const token = await cloudflareConfigService.getToken();
    await cloudflareApiService.purgeCache(token, zoneId, input);
  },

  async listAccessRules(zoneId: string): Promise<AccessRule[]> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.listAccessRules(token, zoneId);
  },

  async createAccessRule(zoneId: string, input: AccessRuleInput): Promise<AccessRule> {
    const token = await cloudflareConfigService.getToken();
    return cloudflareApiService.createAccessRule(token, zoneId, input);
  },

  async deleteAccessRule(zoneId: string, ruleId: string): Promise<void> {
    const token = await cloudflareConfigService.getToken();
    await cloudflareApiService.deleteAccessRule(token, zoneId, ruleId);
  },
};
