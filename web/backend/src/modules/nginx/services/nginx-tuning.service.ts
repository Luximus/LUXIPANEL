// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * NGINX performance tuning — managed via:
 *   • an http-context snippet at /etc/nginx/conf.d/lxp-performance.conf
 *     (gzip, sendfile, keepalive, open_file_cache, optional proxy_cache)
 *   • targeted patches of nginx.conf for `worker_processes` (main) and
 *     `worker_connections` (events) — those directives only exist in
 *     contexts a conf.d snippet cannot reach.
 *
 * Same safety gate as the rest of the module: backup → write →
 * `nginx -t` → restore-on-fail → reload-on-success.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { sh, readMaybeSudo, writeWithNginxValidation } from "./nginx-sudo-io.js";
import { NGINX_CACHE_DIR, NGINX_CONF, NGINX_CONF_D } from "../nginx-constants.js";
import type { PerformanceConfig } from "../models/nginx.model.js";

const log = createModuleLogger("nginx-tuning");

const PERF_SNIPPET = `${NGINX_CONF_D}/lxp-performance.conf`;

function buildSnippet(p: PerformanceConfig): string {
  const lines: string[] = ["# Generado por LUXIPANEL — rendimiento (no editar a mano)"];
  if (p.gzip) {
    lines.push("gzip on;");
    lines.push(`gzip_comp_level ${p.gzipLevel};`);
    lines.push("gzip_vary on;");
    lines.push("gzip_min_length 256;");
    lines.push("gzip_proxied any;");
    lines.push(
      "gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;",
    );
  } else {
    lines.push("gzip off;");
  }
  if (p.sendfile) {
    lines.push("sendfile on;", "tcp_nopush on;", "tcp_nodelay on;");
  }
  lines.push(`keepalive_timeout ${p.keepaliveTimeout};`);
  if (p.openFileCache) {
    lines.push(
      "open_file_cache max=10000 inactive=30s;",
      "open_file_cache_valid 60s;",
      "open_file_cache_min_uses 2;",
      "open_file_cache_errors on;",
    );
  }
  if (p.proxyCache) {
    const days = p.staticCacheDays > 0 ? p.staticCacheDays : 1;
    lines.push(
      `proxy_cache_path ${NGINX_CACHE_DIR}/lxp levels=1:2 keys_zone=lxp_cache:10m max_size=1g inactive=60m use_temp_path=off;`,
      `proxy_cache_valid 200 302 ${days}d;`,
      "proxy_cache_valid 404 1m;",
      "# Para usarla en un sitio proxied añade:  proxy_cache lxp_cache;",
    );
  }
  return lines.join("\n") + "\n";
}

function patchNginxConf(conf: string, p: PerformanceConfig): string {
  let out = conf;

  // worker_processes (main context)
  const wp = String(p.workerProcesses);
  if (/^\s*worker_processes\s+[^;]+;/m.test(out)) {
    out = out.replace(/^\s*worker_processes\s+[^;]+;/m, `worker_processes ${wp};`);
  } else {
    out = `worker_processes ${wp};\n${out}`;
  }

  // worker_connections (events context)
  if (/worker_connections\s+\d+\s*;/.test(out)) {
    out = out.replace(/worker_connections\s+\d+\s*;/, `worker_connections ${p.workerConnections};`);
  } else if (/events\s*\{/.test(out)) {
    out = out.replace(/events\s*\{/, `events {\n    worker_connections ${p.workerConnections};`);
  } else {
    out += `\nevents {\n    worker_connections ${p.workerConnections};\n}\n`;
  }
  return out;
}

function parseCurrent(snippet: string | null, conf: string | null): PerformanceConfig {
  const s = snippet ?? "";
  const c = conf ?? "";
  const num = (re: RegExp, def: number): number => {
    const m = (re.exec(s) ?? re.exec(c));
    return m ? Number.parseInt(m[1]!, 10) : def;
  };
  const wpMatch = /^\s*worker_processes\s+([^;]+);/m.exec(c);
  const wpRaw = wpMatch?.[1]?.trim() ?? "auto";
  return {
    gzip: snippet === null ? true : /^\s*gzip\s+on;/m.test(s),
    gzipLevel: num(/gzip_comp_level\s+(\d+)/, 5),
    sendfile: snippet === null ? true : /^\s*sendfile\s+on;/m.test(s),
    keepaliveTimeout: num(/keepalive_timeout\s+(\d+)/, 65),
    staticCacheDays: (() => {
      const m = /proxy_cache_valid\s+200[^;]*?\s(\d+)d/.exec(s);
      return m ? Number.parseInt(m[1]!, 10) : 30;
    })(),
    openFileCache: snippet === null ? true : /open_file_cache\s+max=/.test(s),
    proxyCache: /proxy_cache_path\s+/.test(s),
    workerProcesses: wpRaw === "auto" ? "auto" : Number.parseInt(wpRaw, 10) || "auto",
    workerConnections: num(/worker_connections\s+(\d+)/, 1024),
  };
}

export const nginxTuningService = {
  async get(executor: Executor): Promise<PerformanceConfig> {
    const [snippet, conf] = await Promise.all([
      readMaybeSudo(executor, PERF_SNIPPET),
      readMaybeSudo(executor, NGINX_CONF),
    ]);
    return parseCurrent(snippet, conf);
  },

  async apply(executor: Executor, p: PerformanceConfig): Promise<void> {
    await sh(executor, `sudo -n mkdir -p -- ${NGINX_CONF_D} ${NGINX_CACHE_DIR} 2>/dev/null`);
    const prevConf = await readMaybeSudo(executor, NGINX_CONF);

    // backup → write → `nginx -t` → rollback → reload, in one place. This
    // service used to carry its own copy with a FIXED `.lxp.bak` suffix, so two
    // concurrent tuning writes clobbered each other's backup and a rollback
    // could restore the wrong config; the shared helper mints a unique name and
    // VERIFIES the restore. A snippet that did not exist before is removed (not
    // restored) on rollback, exactly as before.
    await writeWithNginxValidation(
      executor,
      [
        { path: PERF_SNIPPET, content: buildSnippet(p) },
        ...(prevConf !== null ? [{ path: NGINX_CONF, content: patchNginxConf(prevConf, p) }] : []),
      ],
      {
        invalidMessage: (testOutput) =>
          `nginx -t falló, se restauró la configuración previa:\n${testOutput}`,
      },
    );
    log.info({ target: executor.target.id }, "nginx performance tuning applied");
  },
};
