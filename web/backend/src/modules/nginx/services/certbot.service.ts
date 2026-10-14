// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Certbot service — Let's Encrypt certificate management.
 *
 * Runs certbot on the connected target through the executor, using `sudo -n`
 * (NOPASSWD certbot from /etc/sudoers.d/luxipanel-modules, or the injected
 * login/LP passphrase) since /etc/letsencrypt is root-only.
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { packageInstaller, type InstallResult } from "../../../shared/system/index.js";
import { domainSchema, emailSchema } from "../../../shared/validators/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { readMaybeSudo, sh, writeSudo } from "./nginx-sudo-io.js";

const log = createModuleLogger("certbot");

const DEPLOY_HOOK = "/etc/letsencrypt/renewal-hooks/deploy/luxipanel-nginx-reload";
const RENEW_SERVICE = "/etc/systemd/system/luxipanel-certbot-renew.service";
const RENEW_TIMER = "/etc/systemd/system/luxipanel-certbot-renew.timer";
const RENEW_CRON = "/etc/cron.d/luxipanel-certbot-renew";
const TIMERS = ["certbot.timer", "snap.certbot.renew.timer", "luxipanel-certbot-renew.timer"] as const;

const DEPLOY_HOOK_CONTENT = `#!/bin/sh
set -eu
nginx -t
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  nginx -s reload
fi
`;
const SERVICE_CONTENT = `[Unit]
Description=Renew Let's Encrypt certificates managed by LUXIPANEL
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=PATH=/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
ExecStart=/usr/bin/env certbot renew --quiet
`;
const TIMER_CONTENT = `[Unit]
Description=Check Let's Encrypt renewals twice daily

[Timer]
OnCalendar=*-*-* 03,15:19:00
RandomizedDelaySec=45m
Persistent=true

[Install]
WantedBy=timers.target
`;
const CRON_CONTENT = `PATH=/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin
19 3,15 * * * root certbot renew --quiet
`;

export interface CertbotRenewalStatus {
  installed: boolean;
  automatic: boolean;
  scheduler: string | null;
  reloadHook: boolean;
}

export type SiteRenewalState = "active" | "attention" | "external" | "no_https" | "unknown";
export interface SiteRenewalStatus {
  state: SiteRenewalState;
  lineages: string[];
  reason?: "certbot_missing" | "certificate_missing" | "renewal_config_missing" | "scheduler_missing" | "unavailable";
}

/** Only explicit Certbot live paths count as Certbot-managed certificates. */
export function certbotLineagesFromSite(content: string): string[] {
  const lineages = new Set<string>();
  const pattern = /^\s*ssl_certificate\s+["']?\/etc\/letsencrypt\/live\/([a-zA-Z0-9._-]+)\/(?:fullchain|cert)\.pem["']?\s*;/gim;
  for (const match of content.matchAll(pattern)) if (match[1]) lineages.add(match[1]);
  return [...lineages];
}

export function classifySiteRenewal(
  site: { ssl: boolean; content: string },
  renewalLineages: Set<string> | null,
  liveLineages: Set<string> | null,
  global: CertbotRenewalStatus,
): SiteRenewalStatus {
  if (!site.ssl) return { state: "no_https", lineages: [] };
  const lineages = certbotLineagesFromSite(site.content);
  if (!lineages.length) return { state: "external", lineages: [] };
  if (!global.installed) return { state: "attention", lineages, reason: "certbot_missing" };
  if (!renewalLineages || !liveLineages) return { state: "unknown", lineages, reason: "unavailable" };
  if (lineages.some((lineage) => !liveLineages.has(lineage))) {
    return { state: "attention", lineages, reason: "certificate_missing" };
  }
  if (lineages.some((lineage) => !renewalLineages.has(lineage))) {
    return { state: "attention", lineages, reason: "renewal_config_missing" };
  }
  if (!global.automatic) return { state: "attention", lineages, reason: "scheduler_missing" };
  return { state: "active", lineages };
}

async function activeTimer(executor: Executor): Promise<string | null> {
  for (const timer of TIMERS) {
    const active = await sh(executor, `systemctl is-active --quiet ${timer}`);
    if (active.exitCode !== 0) continue;
    const enabled = await sh(executor, `systemctl is-enabled --quiet ${timer}`);
    if (enabled.exitCode === 0) return timer;
  }
  return null;
}

async function hasSystemd(executor: Executor): Promise<boolean> {
  return (await sh(executor, "test -d /run/systemd/system")).exitCode === 0;
}

export const certbotService = {
  /** True when the `certbot` binary exists on the target. */
  async isInstalledWithExecutor(executor: Executor): Promise<boolean> {
    return packageInstaller.isCommandAvailable(executor, "certbot");
  },

  /** Install certbot + the Nginx authenticator plugin. */
  async installWithExecutor(executor: Executor, opts: { sudoPassword?: string } = {}): Promise<InstallResult> {
    const result = await packageInstaller.install(
      executor,
      {
        apt: ["certbot", "python3-certbot-nginx"],
        dnf: ["certbot", "python3-certbot-nginx"],
        yum: ["certbot", "python3-certbot-nginx"],
        apk: ["certbot", "certbot-nginx"],
        pacman: ["certbot", "certbot-nginx"],
      },
      { sudoPassword: opts.sudoPassword },
    );
    if (result.ok) log.info({ target: executor.target.id }, "certbot installed");
    return result;
  },

  /** The status is checked on the connected target, never inferred from package installation. */
  async renewalStatusWithExecutor(executor: Executor): Promise<CertbotRenewalStatus> {
    const installed = await this.isInstalledWithExecutor(executor);
    if (!installed) return { installed: false, automatic: false, scheduler: null, reloadHook: false };
    const timer = await activeTimer(executor);
    const cronFile = timer ? false : (await sh(executor, `sudo -n test -f ${RENEW_CRON}`)).exitCode === 0;
    const cronRunning = cronFile && (await sh(executor, "pgrep -x cron >/dev/null || pgrep -x crond >/dev/null")).exitCode === 0;
    const reloadHook = (await readMaybeSudo(executor, DEPLOY_HOOK)) === DEPLOY_HOOK_CONTENT
      && (await sh(executor, `sudo -n test -x ${DEPLOY_HOOK}`)).exitCode === 0;
    return { installed: true, automatic: !!(timer || cronRunning) && reloadHook,
      scheduler: timer ?? (cronRunning ? "cron" : null), reloadHook };
  },

  /** Inspect only the supplied, already-authorized sites. Never return raw config. */
  async siteRenewalStatusesWithExecutor(
    executor: Executor,
    sites: Array<{ name: string; ssl: boolean; content: string }>,
  ): Promise<Record<string, SiteRenewalStatus>> {
    const global = await this.renewalStatusWithExecutor(executor);
    let renewalLineages: Set<string> | null = null;
    let liveLineages: Set<string> | null = null;
    if (global.installed) {
      const result = await sh(executor, "sudo -n ls -1 -- /etc/letsencrypt/renewal");
      if (result.exitCode === 0) {
        renewalLineages = new Set(result.stdout.split("\n")
          .map((name) => name.trim()).filter((name) => /^[a-zA-Z0-9._-]+\.conf$/.test(name))
          .map((name) => name.slice(0, -5)));
        const lineages = [...new Set(sites.flatMap((site) => certbotLineagesFromSite(site.content)))];
        liveLineages = new Set();
        if (lineages.length) {
          const paths = lineages.map((name) => `/etc/letsencrypt/live/${name}/fullchain.pem`);
          const checks = `for f in ${paths.map(quoteArg).join(" ")}; do if sudo -n test -f "$f"; then printf '%s\\n' "$f"; fi; done`;
          const files = await sh(executor, checks);
          if (files.exitCode !== 0) liveLineages = null;
          else for (const path of files.stdout.split("\n")) {
            const match = path.match(/^\/etc\/letsencrypt\/live\/([a-zA-Z0-9._-]+)\/fullchain\.pem$/);
            if (match?.[1]) liveLineages.add(match[1]);
          }
        }
      }
    }
    return Object.fromEntries(sites.map((site) => [site.name, classifySiteRenewal(site, renewalLineages, liveLineages, global)]));
  },

  /** Ensure Certbot is scheduled on the target and renewed certs reload NGINX. */
  async ensureAutoRenewalWithExecutor(executor: Executor): Promise<CertbotRenewalStatus> {
    if (!(await this.isInstalledWithExecutor(executor))) throw new ValidationError("Certbot no está instalado en el servidor conectado.");
    const hookIsCurrent = (await readMaybeSudo(executor, DEPLOY_HOOK)) === DEPLOY_HOOK_CONTENT
      && (await sh(executor, `sudo -n test -x ${DEPLOY_HOOK}`)).exitCode === 0;
    if (!hookIsCurrent) {
      await writeSudo(executor, DEPLOY_HOOK, DEPLOY_HOOK_CONTENT, { mkdirParent: true, mode: "0755" });
    }

    if (await hasSystemd(executor)) {
      let selected: string | null = null;
      for (const timer of TIMERS.slice(0, 2)) {
        if ((await sh(executor, `systemctl cat ${timer} >/dev/null 2>&1`)).exitCode === 0) {
          selected = timer;
          break;
        }
      }
      if (!selected) {
        await writeSudo(executor, RENEW_SERVICE, SERVICE_CONTENT, { mkdirParent: true });
        await writeSudo(executor, RENEW_TIMER, TIMER_CONTENT, { mkdirParent: true });
        const reload = await sh(executor, "sudo -n systemctl daemon-reload");
        if (reload.exitCode !== 0) throw new ValidationError(`No se pudo registrar el programador de renovación: ${reload.stderr || reload.stdout}`);
        selected = "luxipanel-certbot-renew.timer";
      }
      const enable = await sh(executor, `sudo -n systemctl enable --now ${selected}`);
      if (enable.exitCode !== 0) throw new ValidationError(`No se pudo activar ${selected}: ${enable.stderr || enable.stdout}`);
    } else {
      const cronDir = await sh(executor, "test -d /etc/cron.d");
      if (cronDir.exitCode !== 0) throw new ValidationError("Este servidor no tiene systemd ni /etc/cron.d para programar renovaciones.");
      await writeSudo(executor, RENEW_CRON, CRON_CONTENT);
    }

    const status = await this.renewalStatusWithExecutor(executor);
    if (!status.automatic) throw new ValidationError("La renovación no quedó activa. Revisa el temporizador o el servicio cron del servidor.");
    log.info({ target: executor.target.id, scheduler: status.scheduler }, "certbot automatic renewal enabled");
    return status;
  },

  /** Test the renewal path against Let's Encrypt staging without issuing a production certificate. */
  async dryRunRenewalWithExecutor(executor: Executor): Promise<{ ok: boolean; output: string }> {
    const out = await executor.exec(quoteCmd("sudo", ["-n", "certbot", "renew", "--dry-run", "--non-interactive"]), { timeoutMs: 300_000 });
    return { ok: out.exitCode === 0, output: [out.stdout, out.stderr].filter(Boolean).join("\n").trim().slice(0, 16_000) };
  },

  async issueWithExecutor(domain: string, email: string, executor: Executor): Promise<{ success: boolean; certPath?: string; keyPath?: string; error?: string }> {
    // Validate BEFORE building any command. `domain`/`email` land in argv
    // (`-d <domain>`, `-m <email>`), so `quoteCmd` already blocks shell
    // injection — but two argv-level hazards remain that validation closes:
    //   • a `domain` shaped like a flag (e.g. `--foo`, `-x`) or with odd chars
    //     that certbot would misparse → require a real FQDN (domainSchema also
    //     rejects a leading `-`, since it must start `[a-zA-Z0-9]`).
    //   • an over-long `domain`/`email` blowing the arg list past E2BIG and
    //     failing the exec → domainSchema caps 253, emailSchema caps 320.
    // On invalid input return the typed failure result WITHOUT touching the
    // executor (no certbot spawn), mirroring the certbot-failed shape.
    const parsedDomain = domainSchema.safeParse(domain);
    if (!parsedDomain.success) {
      return { success: false, error: `Dominio inválido para certbot: ${parsedDomain.error.issues[0]?.message ?? "formato no válido"}` };
    }
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      return { success: false, error: `Email inválido para certbot: ${parsedEmail.error.issues[0]?.message ?? "formato no válido"}` };
    }
    domain = parsedDomain.data;
    email = parsedEmail.data;
    try {
      // certbot writes /etc/letsencrypt (root-only) and reloads nginx, so it
      // needs sudo. `sudo -n` is at command position → the executor injects
      // the credential (NOPASSWD certbot from luxipanel-modules.sudoers, or
      // the login/LP passphrase). exec does NOT throw on non-zero, so inspect
      // exitCode explicitly instead of assuming success.
      const out = await executor.exec(quoteCmd("sudo", ["-n", "certbot", "certonly", "--nginx", "--non-interactive", "--agree-tos", "-m", email, "-d", domain]), { timeoutMs: 120_000 });
      if (out.exitCode !== 0) {
        return { success: false, error: (out.stderr || out.stdout || "certbot certonly falló").trim() };
      }
      const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
      const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;
      return { success: true, certPath, keyPath };
    } catch (err) {
      const message = errMessage(err);
      return { success: false, error: message };
    }
  },
};
