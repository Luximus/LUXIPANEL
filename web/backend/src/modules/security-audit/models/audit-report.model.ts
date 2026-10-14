// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export interface ScanFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  scanner: "bitninja" | "lynis" | "rkhunter" | "chkrootkit" | "ai";
  title: string;
  description: string;
  path?: string;
  remediation?: string;
}

export interface AuditReport {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  findings: ScanFinding[];
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  aiAnalysis?: {
    overallRisk: "critical" | "high" | "medium" | "low";
    keyThreats: string[];
    recommendations: string[];
    generatedAt: Date;
  };
  scanProgress: {
    bitninja: number; // 0-100
    lynis: number;
    rkhunter: number;
    chkrootkit: number;
    aiAnalysis: number;
  };
}
