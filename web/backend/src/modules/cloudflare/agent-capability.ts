/**
 * Cloudflare — AI agent capability.
 *
 * Every tool name is prefixed `cloudflare.` (the registry throws otherwise).
 * Handlers run inside the assistant request scope: anything that touches
 * settingsRepository (the stored token) is wrapped in
 * `runWithExecutor(requireExecutor(), ...)` so the per-target settings
 * sidecar resolves correctly (openclaw pattern).
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { runWithExecutor, type Executor } from "../../shared/executor/index.js";
import {
  accessRuleSchema,
  dnsCreateSchema,
  dnsRecordTypeSchema,
  dnsUpdateSchema,
  purgeSchema,
  setSettingSchema,
} from "./models/index.js";
import { cloudflareConfigService } from "./services/cloudflare-config.service.js";
import { cloudflareService } from "./services/cloudflare.service.js";

const CF_ID_RE = /^[a-f0-9]{32}$/i;

/**
 * Accept a zone by id (32-hex) or by domain name; names resolve through
 * listZones. Returns null when no zone matches the given name.
 */
async function resolveZoneId(zone: string): Promise<string | null> {
  const trimmed = zone.trim();
  if (CF_ID_RE.test(trimmed)) return trimmed;
  const zones = await cloudflareService.listZones();
  const match = zones.find((z) => z.name.toLowerCase() === trimmed.toLowerCase());
  return match?.id ?? null;
}

function zoneInput(input: unknown): string {
  return String((input as Record<string, unknown>)?.zone ?? "").trim();
}

function recordIdInput(input: unknown): string {
  return String((input as Record<string, unknown>)?.recordId ?? "").trim();
}

type ToolOutput = { ok: boolean; output: unknown };

/**
 * Shared preamble for the zone-scoped tools: pin the request executor, resolve
 * the `zone` arg (id or name) and short-circuit with `zoneNotFound` when it
 * doesn't match. `fn` runs inside `runWithExecutor` with the resolved zoneId.
 */
async function withZone(
  input: unknown,
  fn: (zoneId: string, executor: Executor) => Promise<ToolOutput>,
): Promise<ToolOutput> {
  const executor = requireExecutor();
  return runWithExecutor(executor, async () => {
    const zone = zoneInput(input);
    const zoneId = await resolveZoneId(zone);
    if (!zoneId) return zoneNotFound(zone);
    return fn(zoneId, executor);
  });
}

const ZONE_PROPERTY = {
  zone: {
    type: "string",
    description: "Zone id (32-char hex) or domain name (e.g. 'example.com')",
  },
} as const;

const zoneNotFound = (zone: string) => ({
  ok: false,
  output: `Zona de Cloudflare no encontrada: "${zone}". Usa cloudflare.list_zones para ver las disponibles.`,
});

export const cloudflareAgentCapability: AgentCapability = {
  moduleId: "cloudflare",
  version: 1,
  tools: [
    {
      name: "cloudflare.status",
      title: "Estado de Cloudflare",
      description:
        "Returns whether a Cloudflare API token is configured and, if so, how many zones the account exposes. The token itself is never returned.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        return runWithExecutor(executor, async () => {
          const cfg = await cloudflareConfigService.getConfig();
          if (!cfg.tokenSet) {
            return { ok: true, output: { tokenSet: false, zoneCount: null } };
          }
          const zones = await cloudflareService.listZones();
          return {
            ok: true,
            output: { tokenSet: true, zoneCount: zones.length, zones: zones.map((z) => z.name) },
          };
        });
      },
    },
    {
      name: "cloudflare.list_zones",
      title: "Listar zonas de Cloudflare",
      description:
        "List the Cloudflare zones (domains) of the configured account with status, plan and assigned name servers.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const zones = await runWithExecutor(executor, () => cloudflareService.listZones());
        return { ok: true, output: zones };
      },
    },
    {
      name: "cloudflare.list_dns_records",
      title: "Listar registros DNS",
      description:
        "List the DNS records of a zone. Each record is annotated with pointsToServer=true when its content equals the connected server's public IP.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { ...ZONE_PROPERTY },
        required: ["zone"],
      },
      handler: (input) =>
        withZone(input, async (zoneId, executor) => {
          const result = await cloudflareService.listDnsRecords(executor, zoneId);
          return { ok: true, output: result };
        }),
    },
    {
      name: "cloudflare.create_dns_record",
      title: "Crear registro DNS",
      description:
        "Create a DNS record in a zone. Supported types: A, AAAA, CNAME, TXT, MX, NS. ttl=1 means automatic; priority is required by Cloudflare for MX.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          type: { type: "string", enum: dnsRecordTypeSchema.options },
          name: { type: "string", description: "Record name (e.g. 'www' or 'www.example.com')" },
          content: { type: "string", description: "Record content (IP, hostname, text…)" },
          ttl: { type: "number", description: "1 = automatic, or 60..86400 seconds" },
          proxied: { type: "boolean", description: "Route through Cloudflare's proxy" },
          priority: { type: "number", description: "Priority (MX)" },
        },
        required: ["zone", "type", "name", "content"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const body = dnsCreateSchema.parse(input);
          const record = await cloudflareService.createDnsRecord(zoneId, body);
          return { ok: true, output: record };
        }),
    },
    {
      name: "cloudflare.update_dns_record",
      title: "Actualizar registro DNS",
      description:
        "Update an existing DNS record (partial: only the provided fields change). recordId is the 32-char hex id from cloudflare.list_dns_records.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          recordId: { type: "string", description: "DNS record id (32-char hex)" },
          type: { type: "string", enum: dnsRecordTypeSchema.options },
          name: { type: "string" },
          content: { type: "string" },
          ttl: { type: "number", description: "1 = automatic, or 60..86400 seconds" },
          proxied: { type: "boolean" },
          priority: { type: "number" },
        },
        required: ["zone", "recordId"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const recordId = recordIdInput(input);
          if (!CF_ID_RE.test(recordId)) {
            return { ok: false, output: "recordId inválido: se espera un id hex de 32 caracteres" };
          }
          const body = dnsUpdateSchema.parse(input);
          const record = await cloudflareService.updateDnsRecord(zoneId, recordId, body);
          return { ok: true, output: record };
        }),
    },
    {
      name: "cloudflare.delete_dns_record",
      title: "Eliminar registro DNS",
      description:
        "Delete a DNS record from a zone. recordId is the 32-char hex id from cloudflare.list_dns_records. This cannot be undone.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          recordId: { type: "string", description: "DNS record id (32-char hex)" },
        },
        required: ["zone", "recordId"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const recordId = recordIdInput(input);
          if (!CF_ID_RE.test(recordId)) {
            return { ok: false, output: "recordId inválido: se espera un id hex de 32 caracteres" };
          }
          await cloudflareService.deleteDnsRecord(zoneId, recordId);
          return { ok: true, output: { deleted: true, recordId } };
        }),
    },
    {
      name: "cloudflare.purge_cache",
      title: "Purgar caché de Cloudflare",
      description:
        "Purge the Cloudflare cache of a zone: either everything=true, or a list of up to 30 specific file URLs.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          everything: { type: "boolean", description: "Purge the whole zone cache" },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Specific URLs to purge (max 30)",
          },
        },
        required: ["zone"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const body = purgeSchema.parse(input);
          await cloudflareService.purgeCache(zoneId, body);
          return { ok: true, output: { purged: body.everything === true ? "everything" : body.files } };
        }),
    },
    {
      name: "cloudflare.get_zone_settings",
      title: "Ver ajustes de zona",
      description:
        "Read the exposed zone settings: SSL/TLS mode, Always Use HTTPS, security level and development mode.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { ...ZONE_PROPERTY },
        required: ["zone"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const settings = await cloudflareService.getZoneSettings(zoneId);
          return { ok: true, output: settings };
        }),
    },
    {
      name: "cloudflare.set_zone_setting",
      title: "Cambiar ajuste de zona",
      description:
        "Change one zone setting. Allowed: ssl(off|flexible|full|strict), always_use_https(on|off), security_level(essentially_off|low|medium|high|under_attack), development_mode(on|off).",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          setting: {
            type: "string",
            enum: ["ssl", "always_use_https", "security_level", "development_mode"],
          },
          value: { type: "string", description: "New value (whitelisted per setting)" },
        },
        required: ["zone", "setting", "value"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const { setting, value } = setSettingSchema.parse(input);
          await cloudflareService.setZoneSetting(zoneId, setting, value);
          const settings = await cloudflareService.getZoneSettings(zoneId);
          return { ok: true, output: settings };
        }),
    },
    {
      name: "cloudflare.list_access_rules",
      title: "Listar reglas de acceso IP",
      description:
        "List the IP access rules of a zone (block / whitelist / challenge entries with their target IP or range).",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: { ...ZONE_PROPERTY },
        required: ["zone"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const rules = await cloudflareService.listAccessRules(zoneId);
          return { ok: true, output: rules };
        }),
    },
    {
      name: "cloudflare.block_ip",
      title: "Bloquear IP en Cloudflare",
      description:
        "Create an IP access rule in a zone. mode defaults to 'block'; also accepts 'whitelist' or 'challenge'. ip can be a single IP or a CIDR range.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          ...ZONE_PROPERTY,
          ip: { type: "string", description: "IP or CIDR range (e.g. '1.2.3.4' or '1.2.3.0/24')" },
          mode: { type: "string", enum: ["block", "whitelist", "challenge"] },
          notes: { type: "string", description: "Optional note for the rule" },
        },
        required: ["zone", "ip"],
      },
      handler: (input) =>
        withZone(input, async (zoneId) => {
          const obj = input as Record<string, unknown>;
          const body = accessRuleSchema.parse({
            mode: obj.mode ?? "block",
            ip: obj.ip,
            notes: obj.notes,
          });
          const rule = await cloudflareService.createAccessRule(zoneId, body);
          return { ok: true, output: rule };
        }),
    },
  ],
  suggestedPrompts: [
    "¿Qué registros DNS de mis zonas apuntan a este servidor?",
    "Activa el modo desarrollo de Cloudflare en mi dominio principal",
    "Purga toda la caché de Cloudflare de mi sitio",
  ],
};
