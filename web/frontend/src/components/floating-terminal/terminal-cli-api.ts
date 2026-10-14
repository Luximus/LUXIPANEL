// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api } from "@/lib/api-client";
import type { CliId } from "./cli-registry";

export interface TerminalCliState {
  onboardingDone: boolean;
  installed: CliId[];
  active: CliId;
  updatedAt: string;
}

/**
 * Request helper on top of the canonical `api` client (F-06). The previous
 * private `fetch` wrapper sent neither the CSRF token nor `X-Bridge-Session-Id`,
 * so terminal-CLI writes rode the host-wide cookie instead of this tab's bridge
 * session.
 */
async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = body === undefined ? await api.get<T>(path) : await api.post<T>(path, body);
  if (!res.ok) throw new Error(res.error ?? `API ${path} returned ok=false`);
  return res.data as T;
}

export type CliInstallProbe = Partial<Record<CliId, boolean>>;

export const terminalCliApi = {
  getState(): Promise<TerminalCliState> {
    return call("/api/terminal-cli/state");
  },
  probe(): Promise<CliInstallProbe> {
    return call("/api/terminal-cli/probe");
  },
  setInstalled(cliId: CliId, installed: boolean): Promise<TerminalCliState> {
    return call("/api/terminal-cli/installed", { cliId, installed });
  },
  setActive(cliId: CliId): Promise<TerminalCliState> {
    return call("/api/terminal-cli/active", { cliId });
  },
  skipOnboarding(): Promise<TerminalCliState> {
    return call("/api/terminal-cli/onboarding/skip", {});
  },
};
