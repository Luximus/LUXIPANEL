// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX system service — global nginx.conf, service control
 * (start/stop/restart/reload/test), status and log tailing, all through
 * the executor on the connected target.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { quoteArg } from "../../../shared/executor/index.js";
import { NotFoundError, ValidationError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { systemctlIsActive } from "../../../shared/system/service-status.js";
import { sh, readMaybeSudo, testNginxConfig, writeWithNginxValidation } from "./nginx-sudo-io.js";
import { NGINX_CONF, NGINX_LOG_DIR, SITES_AVAILABLE, SITES_ENABLED } from "../nginx-constants.js";
import type { NginxStatus } from "../models/nginx.model.js";

const log = createModuleLogger("nginx-system");

export const nginxSystemService = {
  async testConfig(executor: Executor): Promise<{ ok: boolean; output: string }> {
    return testNginxConfig(executor);
  },

  async status(executor: Executor): Promise<NginxStatus> {
    const ver = await sh(executor, `nginx -v 2>&1 || sudo -n nginx -v 2>&1`);
    const versionMatch = (ver.stdout || ver.stderr).match(/nginx\/([\d.]+)/i);
    const installed = Boolean(versionMatch);
    const running = await systemctlIsActive(executor, "nginx", {
      sudoFallback: true,
      run: (command) => sh(executor, command),
    });
    const enabled = await sh(executor, `sudo -n ls -1 ${SITES_ENABLED} 2>/dev/null | wc -l`);
    const avail = await sh(executor, `sudo -n ls -1 ${SITES_AVAILABLE} 2>/dev/null | wc -l`);
    const test = installed ? await this.testConfig(executor) : { ok: false, output: "nginx no instalado" };

    return {
      installed,
      running,
      version: versionMatch?.[1] ?? null,
      enabledSites: Number.parseInt(enabled.stdout.trim() || "0", 10) || 0,
      availableSites: Number.parseInt(avail.stdout.trim() || "0", 10) || 0,
      configTest: test,
    };
  },

  /** start | stop | restart | reload | test */
  async serviceAction(
    executor: Executor,
    action: "start" | "stop" | "restart" | "reload" | "test",
  ): Promise<{ ok: boolean; output: string }> {
    if (action === "test") return this.testConfig(executor);

    // For restart/reload, validate first so we never take nginx down with a
    // broken config.
    if (action === "restart" || action === "reload") {
      const test = await this.testConfig(executor);
      if (!test.ok) throw new ValidationError(`nginx -t falló, no se ejecutó ${action}:\n${test.output}`);
    }
    const res = await sh(executor, `sudo -n systemctl ${action} nginx 2>&1`);
    log.info({ action, exit: res.exitCode, target: executor.target.id }, "nginx service action");
    return { ok: res.exitCode === 0, output: (res.stdout || res.stderr || "").trim() || `${action} ok` };
  },

  async readGlobalConfig(executor: Executor): Promise<string> {
    const content = await readMaybeSudo(executor, NGINX_CONF);
    if (content === null) throw new ValidationError(`No se pudo leer ${NGINX_CONF}`);
    return content;
  },

  async writeGlobalConfig(executor: Executor, content: string): Promise<void> {
    // Same backup → write → `nginx -t` → verified rollback → reload contract as
    // every other nginx write; see `nginx-sudo-io#writeWithNginxValidation`.
    // The staged `sudo cp` (never `… | sudo -S tee`, which ate the config as the
    // password) and the unique backup suffix live there.
    await writeWithNginxValidation(executor, [{ path: NGINX_CONF, content }], {
      invalidMessage: (testOutput) => `nginx.conf inválido, se restauró el backup:\n${testOutput}`,
      restoreFailedMessage: (testOutput, restoreOutput) =>
        `nginx.conf inválido y ADEMÁS falló la restauración del backup — revisa el servidor manualmente:\n${testOutput}\n${restoreOutput}`,
    });
    log.info({ target: executor.target.id }, "nginx.conf updated");
  },

  /** Tail an access/error log — global or per-site. */
  async tailLog(
    executor: Executor,
    opts: { site?: string; type: "access" | "error"; lines: number },
  ): Promise<{ path: string; lines: string }> {
    let path: string;
    if (opts.site) {
      const candidate = `${NGINX_LOG_DIR}/${opts.site}.${opts.type}.log`;
      const exists = await sh(executor, `sudo -n test -f ${quoteArg(candidate)} && echo y`);
      if (exists.stdout.trim() !== "y") throw new NotFoundError(`No existe un registro ${opts.type} para el sitio ${opts.site}`);
      path = candidate;
    } else {
      path = `${NGINX_LOG_DIR}/${opts.type}.log`;
    }
    const res = await sh(executor, `sudo -n tail -n ${opts.lines} -- ${quoteArg(path)} 2>/dev/null || tail -n ${opts.lines} -- ${quoteArg(path)} 2>/dev/null`);
    return { path, lines: res.stdout };
  },
};
