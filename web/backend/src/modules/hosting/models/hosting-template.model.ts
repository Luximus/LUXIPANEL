import { z } from "zod";
import { providerGroupTemplateSchema } from "../services/provider-group-policy.js";

export const hostingLimitsSchema = z.object({
  diskQuotaMb: z.number().int().min(256).max(1073741824), maxDomains: z.number().int().nonnegative().max(1000000),
  maxEmailAccounts: z.number().int().nonnegative().max(1000000), maxDatabases: z.number().int().nonnegative().max(1000000),
  maxSubUsers: z.number().int().nonnegative().max(10000),
  cpuPercent: z.number().int().min(1).max(10000), memoryMb: z.number().int().min(64).max(1048576),
  maxProcesses: z.number().int().min(8).max(65536),
}).strict();
export const hostingSecuritySchema = z.object({
  shell: z.enum(["disabled", "jailed"]).default("disabled"),
  maxTerminalSessions: z.number().int().min(1).max(20).default(2),
  commandTimeoutSeconds: z.number().int().min(1).max(3600).default(120),
  sessionHours: z.number().min(0.1).max(720).default(24),
  requireMfa: z.boolean().default(false),
  mailTargetIds: z.array(z.string().min(1).max(128)).max(50).default([]),
}).strict();
export const hostingTemplateInput = z.object({
  name: z.string().trim().min(2).max(100),
  permissions: providerGroupTemplateSchema,
  limits: hostingLimitsSchema, security: hostingSecuritySchema,
}).strict();
export type HostingTemplateInput = z.infer<typeof hostingTemplateInput>;
export interface HostingTemplate extends HostingTemplateInput {
  id: string; revision: number; createdAt: string; updatedAt: string;
}
export type HostingLimits = z.infer<typeof hostingLimitsSchema>;
export type HostingSecurity = z.infer<typeof hostingSecuritySchema>;
