/**
 * Cloudflare module — domain types and request schemas.
 *
 * The module manages the Cloudflare account of the CONNECTED server: zones,
 * DNS records, cache purging, a small set of zone settings and IP access
 * rules. The only persisted state is the API token, stored via
 * `settingsRepository` (category "cloudflare") on the connected server's
 * sidecar — never on the panel host, never returned to the browser.
 */

import { z } from "zod";

// ── IP helpers (pure — reused by the service for the server-IP probe) ──────

export function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function isValidIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  if (!/^[0-9a-fA-F:]{2,45}$/.test(value)) return false;
  // At most one "::" compression group.
  return value.split("::").length <= 2;
}

export function isValidIp(value: string): boolean {
  return isValidIpv4(value) || isValidIpv6(value);
}

/** Plain IP or CIDR range ("1.2.3.4", "1.2.3.0/24", "2001:db8::/32"). */
export function isValidIpOrCidr(value: string): boolean {
  const slash = value.indexOf("/");
  if (slash === -1) return isValidIp(value);
  const ip = value.slice(0, slash);
  const prefix = value.slice(slash + 1);
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const bits = Number(prefix);
  if (isValidIpv4(ip)) return bits <= 32;
  if (isValidIpv6(ip)) return bits <= 128;
  return false;
}

// ── Domain types ────────────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  planName: string;
  nameServers: string[];
}

export interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
}

/** DnsRecord annotated with whether it targets the connected server's IP. */
export interface AnnotatedDnsRecord extends DnsRecord {
  pointsToServer: boolean;
}

export interface ZoneSettings {
  ssl: string;
  alwaysUseHttps: string;
  securityLevel: string;
  developmentMode: string;
}

export interface AccessRule {
  id: string;
  mode: string;
  target: string;
  value: string;
  notes: string;
}

// ── Request schemas ─────────────────────────────────────────────────────────

export const saveConfigSchema = z.object({
  apiToken: z.string().trim().min(20, "El API token es demasiado corto").max(512),
});

/** Cloudflare ids (zone/record/rule) are 32-char hex strings. */
const cfIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32}$/i, "Identificador de Cloudflare inválido");

export const zoneIdParamSchema = z.object({ zoneId: cfIdSchema });

export const dnsRecordParamsSchema = z.object({
  zoneId: cfIdSchema,
  recordId: cfIdSchema,
});

export const accessRuleParamsSchema = z.object({
  zoneId: cfIdSchema,
  ruleId: cfIdSchema,
});

export const dnsRecordTypeSchema = z.enum([
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "NS",
]);

/** Cloudflare TTL: 1 = automatic, otherwise 60..86400 seconds. */
const ttlSchema = z
  .number()
  .int()
  .refine((v) => v === 1 || (v >= 60 && v <= 86_400), {
    message: "TTL debe ser 1 (automático) o estar entre 60 y 86400 segundos",
  });

export const dnsCreateSchema = z.object({
  type: dnsRecordTypeSchema,
  name: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(2048),
  ttl: ttlSchema.optional(),
  proxied: z.boolean().optional(),
  /** Required by Cloudflare for MX; optional everywhere else. */
  priority: z.number().int().min(0).max(65_535).optional(),
});
export type DnsCreateInput = z.infer<typeof dnsCreateSchema>;

/** PATCH body: same shape, every field optional. */
export const dnsUpdateSchema = dnsCreateSchema.partial();
export type DnsUpdateInput = z.infer<typeof dnsUpdateSchema>;

export const purgeSchema = z
  .object({
    everything: z.boolean().optional(),
    files: z.array(z.string().trim().min(1).max(2048)).min(1).max(30).optional(),
  })
  .refine((d) => d.everything === true || (d.files !== undefined && d.files.length > 0), {
    message: "Debes indicar everything:true o una lista de files",
  })
  .refine((d) => !(d.everything === true && d.files !== undefined), {
    message: "everything y files son mutuamente excluyentes",
  });
export type PurgeInput = z.infer<typeof purgeSchema>;

export const zoneSettingIdSchema = z.enum([
  "ssl",
  "always_use_https",
  "security_level",
  "development_mode",
]);
export type ZoneSettingId = z.infer<typeof zoneSettingIdSchema>;

/** Whitelisted values per setting — anything else never reaches Cloudflare. */
export const ZONE_SETTING_VALUES: Record<ZoneSettingId, readonly string[]> = {
  ssl: ["off", "flexible", "full", "strict"],
  always_use_https: ["on", "off"],
  security_level: ["essentially_off", "low", "medium", "high", "under_attack"],
  development_mode: ["on", "off"],
};

export const setSettingSchema = z
  .object({
    setting: zoneSettingIdSchema,
    value: z.string().trim().min(1).max(32),
  })
  .superRefine((data, ctx) => {
    const allowed = ZONE_SETTING_VALUES[data.setting];
    if (!allowed.includes(data.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: `Valor inválido para ${data.setting}; permitidos: ${allowed.join(", ")}`,
      });
    }
  });

export const accessRuleModeSchema = z.enum(["block", "whitelist", "challenge"]);

export const accessRuleSchema = z.object({
  mode: accessRuleModeSchema,
  ip: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .refine(isValidIpOrCidr, { message: "IP o rango CIDR inválido" }),
  notes: z.string().trim().max(255).optional(),
});
export type AccessRuleInput = z.infer<typeof accessRuleSchema>;
