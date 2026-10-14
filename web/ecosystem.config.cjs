// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const repository = path.basename(root) === "web" ? path.dirname(root) : root;
const releaseMarker = path.sep + ".releases" + path.sep;
const installation = repository.includes(releaseMarker) ? repository.slice(0, repository.indexOf(releaseMarker)) : repository;
const backendEnvPath = path.join(root, "backend", ".env");
const frontendEnvPath = path.join(root, "frontend", ".env");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = rawLine.indexOf("=");
    if (separator < 1) {
      continue;
    }

    const key = rawLine.slice(0, separator).trim();
    let value = rawLine.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const backendEnv = loadEnvFile(backendEnvPath);
const frontendEnv = loadEnvFile(frontendEnvPath);

/**
 * Both panel processes are the same pm2 app modulo name / cwd / entrypoint /
 * env source, so the shared fields are declared once here.
 *
 * @param {string} name    pm2 process name
 * @param {string} dir     project directory under the repo root
 * @param {string[]} entry path segments of the built entrypoint, relative to dir
 * @param {object} env     parsed .env for that project
 */
function makeApp(name, dir, entry, env) {
  return {
    name,
    cwd: path.join(root, dir),
    script: path.join(root, dir, ...entry),
    interpreter: "node",
    exec_mode: "fork",
    instances: 1,
    autorestart: true,
    // With a fixed 5s delay, max_restarts:10 burned through in ~50s and pm2
    // marked the app `errored` for good — silently (a corrupt SSR manifest
    // after an interrupted build did exactly this). Exponential backoff
    // (capped) keeps pm2 retrying long enough for a transient cause to clear,
    // and a higher ceiling avoids a permanent silent-down after a burst.
    max_restarts: 50,
    exp_backoff_restart_delay: 5000,
    watch: false,
    env: {
      ...env,
      NODE_ENV: "production",
      LUXIPANEL_INSTALL_ROOT: env.LUXIPANEL_INSTALL_ROOT || installation,
    },
  };
}

module.exports = {
  apps: [
    makeApp("luxipanel-backend", "backend", ["dist", "server.js"], backendEnv),
    makeApp("luxipanel-frontend", "frontend", ["dist", "server", "entry.mjs"], frontendEnv),
  ],
};
