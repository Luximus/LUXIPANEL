// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Human-approval request for a scheduled AI-agent run.
 *
 * When a job has `requireApproval`, finishing a run creates one of these with a
 * single-use capability token used in the public approval URL (sent in the
 * report email). Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/cron/approvals.json`.
 */
export type ApprovalStatus = "pending" | "approved" | "changes" | "denied";

export interface CronApproval {
  id?: string;
  /** Capability token used in the public approval URL. */
  token: string;
  jobId: string;
  jobName: string;
  /** Outcome of the run that requested approval ("ok" | "error"). */
  runStatus: string;
  /** Log file of the run, for reference. */
  logFile: string | null;
  status: ApprovalStatus;
  /** Reviewer feedback (required for "changes"). */
  comment?: string;
  createdAt?: string;
  decidedAt?: string | null;
  /** Capability links are temporary: past this instant the URL is inert. */
  expiresAt?: string;
}
