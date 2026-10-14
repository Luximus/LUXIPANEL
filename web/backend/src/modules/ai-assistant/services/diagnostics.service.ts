// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Diagnostics service — automated analysis of mail configuration and DNS.
 *
 * Each probe lives in the `CHECKS` registry. Adding a new check (DKIM with a
 * different selector, DMARC alignment, MTA-STS, TLS-RPT, …) is one entry in
 * that table; the dispatcher in `runForDomain` stays untouched.
 *
 * Las sondas corren SIEMPRE en el servidor conectado (`getContextExecutor`),
 * nunca con `execSync` en el host del panel. Son las dos caras de lo mismo: la
 * regla dura de aislamiento per-server (ningún módulo ejecuta comandos en el
 * host) y la corrección funcional — lo que importa es la vista DNS del PROPIO
 * target, que es quien recibe el correo; la del panel puede diferir y daría un
 * diagnóstico que no se parece a la realidad del servidor del cliente.
 */

import { requireExecutor } from "../../../shared/executor/require-executor.js";

export interface DiagnosticCheck {
  name: string;
  status: "ok" | "warning" | "error" | "unknown";
  message: string;
  detail?: string;
}

const DIG_TIMEOUT_MS = 10_000;
const DIG_UNAVAILABLE_MESSAGE = "dig not available";

/** A single DNS/mail probe. The runner wraps it in the dig-unavailable fallback. */
type Check = {
  name: string;
  run: (domain: string) => Promise<Omit<DiagnosticCheck, "name">>;
};

/**
 * Run one shell probe (dig/awk/xargs pipeline) ON THE CONNECTED TARGET via the
 * context executor. Lanza si no hay executor de contexto o si el comando falla,
 * de modo que cada check degrada a "unknown" en lugar de tumbar la suite.
 */
async function probe(cmd: string): Promise<string> {
  // T-05: the fail-closed "is there a connected server?" guard is shared. It
  // throws `NoServerExecutorError` (code NO_SERVER_EXECUTOR) instead of the
  // bare `Error("NO_SERVER_EXECUTOR")` this used to build by hand; the check
  // runner catches it either way and degrades the check to "unknown".
  const executor = requireExecutor();
  const res = await executor.exec(cmd, { timeoutMs: DIG_TIMEOUT_MS });
  return (res.stdout ?? "").trim();
}

/** `dig +short <args>` en el target. */
async function dig(args: string): Promise<string> {
  return probe(`dig +short ${args} 2>/dev/null`);
}

const CHECKS: Check[] = [
  {
    name: "MX record",
    run: async (domain) => {
      const out = await dig(`MX ${domain}`);
      return out
        ? { status: "ok", message: "MX records found", detail: out }
        : { status: "error", message: "No MX records found" };
    },
  },
  {
    name: "SPF record",
    run: async (domain) => {
      const out = await dig(`TXT ${domain}`);
      const spf = out.split("\n").find((l) => l.includes("v=spf1"));
      return spf
        ? { status: "ok", message: "SPF record present", detail: spf }
        : { status: "warning", message: "No SPF record found" };
    },
  },
  {
    name: "DMARC record",
    run: async (domain) => {
      const out = await dig(`TXT _dmarc.${domain}`);
      return out
        ? { status: "ok", message: "DMARC record present", detail: out }
        : { status: "warning", message: "No DMARC record found" };
    },
  },
  {
    // DKIM: legacy interface parameterised on a selector. Kept as a single
    // entry; adding more selectors (e.g. "google", "k1") is a one-line addition.
    name: "DKIM (mail)",
    run: async (domain) => {
      const out = await dig(`TXT mail._domainkey.${domain}`);
      return out
        ? { status: "ok", message: "DKIM key found" }
        : { status: "warning", message: "No DKIM key found" };
    },
  },
  {
    name: "Reverse DNS",
    run: async (domain) => {
      const mxIp = await probe(
        `dig +short MX ${domain} 2>/dev/null | head -1 | awk '{print $2}' | xargs dig +short 2>/dev/null`,
      );
      if (!mxIp) return { status: "unknown", message: "Could not resolve MX IP" };
      const rdns = await dig(`-x ${mxIp}`);
      return rdns
        ? { status: "ok", message: `rDNS: ${rdns}`, detail: `MX IP: ${mxIp}` }
        : { status: "warning", message: "No reverse DNS for MX IP", detail: `MX IP: ${mxIp}` };
    },
  },
];

async function runOne(check: Check, domain: string): Promise<DiagnosticCheck> {
  try {
    const result = await check.run(domain);
    return { name: check.name, ...result };
  } catch {
    return { name: check.name, status: "unknown", message: DIG_UNAVAILABLE_MESSAGE };
  }
}

export const diagnosticsService = {
  /** Run a full suite of mail/DNS diagnostics for a domain. */
  async runForDomain(domain: string): Promise<DiagnosticCheck[]> {
    const safe = domain.replace(/[^a-zA-Z0-9.-]/g, "");
    const checks: DiagnosticCheck[] = [];

    // Same fan-out as before: every probe runs concurrently, each push is
    // independent (Promise.allSettled swallows per-probe failures — that's the
    // reason the legacy code was structured this way).
    await Promise.allSettled(CHECKS.map((c) => runOne(c, safe).then((r) => checks.push(r))));

    return checks;
  },
};
