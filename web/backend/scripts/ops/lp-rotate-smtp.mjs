#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs, { constants } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import dotenv from "dotenv";
import nodemailer from "nodemailer";

const LP_ENV = "/var/www/LP-LICENSE-SERVER/backend/.env";
const LUXIPANEL_ENV = path.resolve(import.meta.dirname, "../../.env");
const TARGET_STORE = "/etc/luxipanel/servers/targets.json";
const REMOTE_USERS = "/etc/dovecot/users";
const LOCK_PATH = `${LP_ENV}.phase1-smtp.lock`;
const OP_ID = /^\d{14}-[a-f0-9]{12}$/;

let disposeAllVaultExecutors = async () => undefined;
let lockHandle;
let ownsLock = false;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const allowed = new Set(["--apply", "--confirm-phase1-smtp", "--verify"]);
  const cleanupArgs = argv.filter((arg) => arg.startsWith("--cleanup-op="));
  for (const arg of argv) {
    if (!allowed.has(arg) && !arg.startsWith("--cleanup-op=")) {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (cleanupArgs.length > 1) fail("Only one cleanup operation may be specified");
  const apply = argv.includes("--apply");
  const confirm = argv.includes("--confirm-phase1-smtp");
  const verify = argv.includes("--verify");
  const cleanupOp = cleanupArgs[0]?.slice("--cleanup-op=".length) ?? null;
  if (cleanupOp && !OP_ID.test(cleanupOp)) fail("Invalid cleanup operation identifier");
  if (cleanupOp && (apply || confirm || verify)) fail("Cleanup cannot be combined with other modes");
  if (verify && (apply || confirm)) fail("Verify cannot be combined with apply flags");
  if (apply !== confirm) fail("Writes require both apply confirmation flags");
  return { apply, cleanupOp, verify };
}

function uniqueEnvValue(parsed, key) {
  const value = parsed[key];
  if (typeof value !== "string" || !value.length) fail(`${key} is required`);
  return value;
}

function smtpConfig(parsed, password = uniqueEnvValue(parsed, "SMTP_PASS")) {
  const port = Number(uniqueEnvValue(parsed, "SMTP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("SMTP_PORT is invalid");
  const secureRaw = String(parsed.SMTP_SECURE ?? "").toLowerCase();
  const secure = secureRaw ? secureRaw === "true" : port === 465;
  return {
    host: uniqueEnvValue(parsed, "SMTP_HOST"),
    port,
    secure,
    auth: {
      user: uniqueEnvValue(parsed, "SMTP_USER"),
      pass: password,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { rejectUnauthorized: true },
  };
}

async function verifySmtp(parsed, password) {
  const transporter = nodemailer.createTransport(smtpConfig(parsed, password));
  try {
    await transporter.verify();
  } catch {
    fail("SMTP credential verification failed");
  } finally {
    transporter.close();
  }
}

function replaceDovecotHash(raw, username, passwordHash) {
  const chunks = raw.split(/(?<=\n)/);
  let matches = 0;
  const next = chunks.map((chunk) => {
    const newline = chunk.endsWith("\r\n") ? "\r\n" : chunk.endsWith("\n") ? "\n" : "";
    const body = newline ? chunk.slice(0, -newline.length) : chunk;
    if (!body || body.startsWith("#")) return chunk;
    const fields = body.split(":");
    if (fields[0] !== username) return chunk;
    if (fields.length < 2) fail("Dovecot user record is malformed");
    matches += 1;
    const scheme = fields[1].match(/^\{[^}]+\}/)?.[0] ?? "{SHA512-CRYPT}";
    fields[1] = `${scheme}${passwordHash}`;
    return `${fields.join(":")}${newline}`;
  });
  if (matches !== 1) fail("Expected exactly one Dovecot user record");
  return next.join("");
}

async function sha512Crypt(password) {
  return new Promise((resolve, reject) => {
    const child = spawn("openssl", ["passwd", "-6", "-stdin"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.resume();
    child.once("error", () => reject(new Error("Password hash generation failed")));
    child.once("close", (code) => {
      const result = stdout.trim();
      if (code !== 0 || !/^\$6\$[^\s:]+$/.test(result)) {
        reject(new Error("Password hash generation failed"));
      } else {
        resolve(result);
      }
    });
    child.stdin.end(`${password}\n`);
  });
}

function replaceEnvPassword(envText, newPassword) {
  const expression = /^SMTP_PASS=(.*)$/gm;
  const matches = [...envText.matchAll(expression)];
  if (matches.length !== 1) fail("SMTP_PASS must appear exactly once");
  const oldRaw = matches[0][1].trim();
  const quote = oldRaw.match(/^(["']).*\1$/)?.[1] ?? "";
  return envText.replace(expression, `SMTP_PASS=${quote}${newPassword}${quote}`);
}

async function atomicReplaceEnv(expectedCurrent, next, opId) {
  const current = await fs.readFile(LP_ENV, "utf8");
  if (current !== expectedCurrent) fail("LP environment changed during execution");
  const stat = await fs.stat(LP_ENV);
  if ((stat.mode & 0o077) !== 0) fail("LP environment permissions exceed 0600");
  const temporary = `${LP_ENV}.phase1-smtp-${opId}.tmp`;
  let handle;
  try {
    handle = await fs.open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    await handle.writeFile(next, "utf8");
    await handle.sync();
    await handle.chown(stat.uid, stat.gid);
    await handle.chmod(0o600);
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, LP_ENV);
    const directory = await fs.open(path.dirname(LP_ENV), constants.O_RDONLY);
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function remoteExec(executor, command) {
  const result = await executor.exec(command, { timeoutMs: 20_000 });
  if (result.exitCode !== 0) fail("Remote privileged operation failed");
  return result.stdout;
}

async function remoteExists(executor, remotePath) {
  const result = await executor.exec(`sudo -n test -e '${remotePath}'`, { timeoutMs: 10_000 });
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  fail("Remote existence check failed");
}

async function readRemoteUsers(executor) {
  return remoteExec(executor, `sudo -n cat -- '${REMOTE_USERS}'`);
}

async function rollbackRemote(executor, backupPath, oldRaw, parsed) {
  await remoteExec(
    executor,
    `sudo -n mv -- '${backupPath}' '${REMOTE_USERS}' && sudo -n chown root:dovecot '${REMOTE_USERS}' && sudo -n chmod 0640 '${REMOTE_USERS}'`,
  );
  const restored = await readRemoteUsers(executor);
  if (restored !== oldRaw) fail("Remote SMTP rollback verification failed");
  await verifySmtp(parsed, uniqueEnvValue(parsed, "SMTP_PASS"));
}

async function acquireLock() {
  try {
    lockHandle = await fs.open(
      LOCK_PATH,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    ownsLock = true;
    await lockHandle.writeFile(`${process.pid}\n`, "utf8");
    await lockHandle.sync();
  } catch (error) {
    if (error?.code === "EEXIST") fail("Another SMTP rotation is active");
    throw error;
  }
}

async function recordPhase(opId, phase) {
  if (!ownsLock) return;
  const state = `${JSON.stringify({ pid: process.pid, opId, phase })}\n`;
  await fs.writeFile(LOCK_PATH, state, { encoding: "utf8", mode: 0o600 });
  const handle = await fs.open(LOCK_PATH, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function main() {
  const mode = parseArgs(process.argv.slice(2));
  if (mode.apply || mode.cleanupOp) await acquireLock();

  process.env.LOG_LEVEL = "error";
  const luxipanelText = await fs.readFile(LUXIPANEL_ENV, "utf8");
  for (const [key, value] of Object.entries(dotenv.parse(luxipanelText))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const lpEnvText = await fs.readFile(LP_ENV, "utf8");
  const parsed = dotenv.parse(lpEnvText);
  const username = uniqueEnvValue(parsed, "SMTP_USER");
  const store = JSON.parse(await fs.readFile(TARGET_STORE, "utf8"));
  const targetIds = Object.keys(store ?? {});
  if (targetIds.length !== 1) fail("Expected exactly one managed target");
  const imported = await import("../../dist/shared/executor/vault-executor.js");
  disposeAllVaultExecutors = imported.disposeAllVaultExecutors;
  const executor = await imported.getVaultExecutor(targetIds[0]);
  if (!executor) fail("Managed target executor unavailable");

  await verifySmtp(parsed, uniqueEnvValue(parsed, "SMTP_PASS"));
  if (mode.verify) {
    console.log("verify=PASS writes=0");
    return;
  }

  const oldRemote = await readRemoteUsers(executor);
  replaceDovecotHash(oldRemote, username, "$6$dry-run-placeholder");
  console.log("preflight=PASS targets=1 dovecot_users=1 smtp=PASS");

  if (mode.cleanupOp) {
    const backupPath = `${REMOTE_USERS}.phase1-pre-smtp-${mode.cleanupOp}.bak`;
    if (!(await remoteExists(executor, backupPath))) fail("Matching SMTP backup not found");
    await remoteExec(executor, `sudo -n unlink -- '${backupPath}'`);
    if (await remoteExists(executor, backupPath)) fail("SMTP backup cleanup verification failed");
    console.log("cleanup=PASS removed=1");
    return;
  }
  if (!mode.apply) {
    console.log("dry_run=PASS writes=0");
    return;
  }

  const opId = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(6).toString("hex")}`;
  const newPassword = randomBytes(32).toString("base64url");
  const passwordHash = await sha512Crypt(newPassword);
  const nextRemote = replaceDovecotHash(oldRemote, username, passwordHash);
  const nextEnv = replaceEnvPassword(lpEnvText, newPassword);
  const temporary = `/tmp/.lp-phase1-smtp-${opId}.tmp`;
  const staged = `/etc/dovecot/.users.phase1-smtp-${opId}.staged`;
  const backupPath = `${REMOTE_USERS}.phase1-pre-smtp-${opId}.bak`;
  let remoteSwapped = false;
  let envSwapped = false;
  try {
    await recordPhase(opId, "PREPARING");
    for (const reserved of [temporary, staged, backupPath]) {
      if (await remoteExists(executor, reserved)) fail("Reserved SMTP operation path exists");
    }
    await executor.writeFile(temporary, nextRemote, { encoding: "utf8", mode: 0o600 });
    await remoteExec(
      executor,
      `sudo -n install -o root -g dovecot -m 0640 -- '${temporary}' '${staged}' && sudo -n cp --preserve=mode,ownership,timestamps -- '${REMOTE_USERS}' '${backupPath}' && sudo -n mv -- '${staged}' '${REMOTE_USERS}'`,
    );
    remoteSwapped = true;
    await recordPhase(opId, "REMOTE_SWAPPED");
    const published = await readRemoteUsers(executor);
    if (published !== nextRemote) fail("Published Dovecot data verification failed");
    await verifySmtp(parsed, newPassword);
    await atomicReplaceEnv(lpEnvText, nextEnv, opId);
    envSwapped = true;
    await recordPhase(opId, "ENV_SWAPPED");
    await verifySmtp(dotenv.parse(nextEnv), newPassword);
  } catch (error) {
    let envRestored = !envSwapped;
    if (envSwapped) {
      try {
        await atomicReplaceEnv(nextEnv, lpEnvText, `${opId}-rollback`);
        envRestored = true;
        await recordPhase(opId, "ENV_ROLLED_BACK");
      } catch {
        await recordPhase(opId, "ENV_ROLLBACK_FAILED").catch(() => undefined);
        fail("SMTP rotation inconsistent: environment rollback failed; remote retained");
      }
    }
    if (remoteSwapped && envRestored) {
      try {
        await rollbackRemote(executor, backupPath, oldRemote, parsed);
        await recordPhase(opId, "ROLLED_BACK");
      } catch {
        await recordPhase(opId, "REMOTE_ROLLBACK_FAILED").catch(() => undefined);
        fail("SMTP rotation inconsistent: remote rollback failed");
      }
    }
    throw error;
  } finally {
    await executor.unlink(temporary).catch(() => undefined);
    await remoteExec(executor, `sudo -n unlink -- '${staged}'`).catch(() => undefined);
  }

  await recordPhase(opId, "COMPLETED");
  console.log(`apply=PASS opId=${opId} rotated=1`);
  console.log("next=restart license-backend with ecosystem re-evaluation, then run --verify and cleanup-op");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main()
    .catch((error) => {
      console.error(`smtp_rotation=FAILED reason=${error?.message ?? "unknown"}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disposeAllVaultExecutors().catch(() => undefined);
      await lockHandle?.close().catch(() => undefined);
      if (ownsLock) await fs.unlink(LOCK_PATH).catch(() => undefined);
    });
}

export { parseArgs, replaceDovecotHash, replaceEnvPassword };
