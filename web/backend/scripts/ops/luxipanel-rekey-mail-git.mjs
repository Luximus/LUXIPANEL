#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import fs, { constants } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { decrypt, encrypt } from "../../dist/shared/utils/crypto.js";

let disposeAllVaultExecutors = async () => undefined;
let getVaultExecutor;
let activeLockHandle;
let ownsLock = false;

const ENV_PATH = path.resolve(import.meta.dirname, "../../.env");
const LOCK_PATH = `${ENV_PATH}.phase1-rekey.lock`;
const TARGET_STORE = "/etc/luxipanel/servers/targets.json";
const HEX_KEY = /^[a-fA-F0-9]{64}$/;
const CIPHERTEXT = /^[a-fA-F0-9]{24}:[a-fA-F0-9]{32}:(?:[a-fA-F0-9]{2})+$/;

const SPECS = [
  {
    label: "mail",
    remotePath: "/etc/luxipanel/mail/credentials.json",
    field: "passwordEncrypted",
    envKey: "MAIL_ENCRYPTION_KEY",
  },
  {
    label: "git",
    remotePath: "/etc/luxipanel/files/git-credentials.json",
    field: "secretEnc",
    envKey: "GIT_ENCRYPTION_KEY",
  },
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const allowed = new Set(["--apply", "--confirm-phase1-rekey", "--verify"]);
  const cleanupArgs = argv.filter((arg) => arg.startsWith("--cleanup-op="));
  for (const arg of argv) {
    if (!allowed.has(arg) && !arg.startsWith("--cleanup-op=")) {
      fail(`Unknown argument: ${arg}`);
    }
  }
  if (cleanupArgs.length > 1) fail("Only one cleanup operation may be specified");
  const apply = argv.includes("--apply");
  const confirm = argv.includes("--confirm-phase1-rekey");
  const verify = argv.includes("--verify");
  const cleanupOp = cleanupArgs[0]?.slice("--cleanup-op=".length) ?? null;
  if (cleanupOp && !/^\d{14}-[a-f0-9]{12}$/.test(cleanupOp)) {
    fail("Invalid cleanup operation identifier");
  }
  if (cleanupOp && (apply || confirm || verify)) {
    fail("Cleanup cannot be combined with other modes");
  }
  if (verify && (apply || confirm)) fail("--verify cannot be combined with apply flags");
  if (apply !== confirm) {
    fail("Writes require both --apply and --confirm-phase1-rekey");
  }
  return { apply, cleanupOp, verify };
}

function parseEnv(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const values = entries.get(match[1]) ?? [];
    values.push(match[2].trim().replace(/^(["'])(.*)\1$/, "$2"));
    entries.set(match[1], values);
  }
  return entries;
}

function requireKeys(envText) {
  const entries = parseEnv(envText);
  const keys = {};
  for (const spec of SPECS) {
    const values = entries.get(spec.envKey) ?? [];
    if (values.length !== 1) fail(`${spec.envKey} must appear exactly once`);
    if (!HEX_KEY.test(values[0])) fail(`${spec.envKey} must be exactly 64 hex characters`);
    keys[spec.envKey] = values[0];
  }
  return keys;
}

function validateDocument(raw, spec, key) {
  let document;
  try {
    document = JSON.parse(raw);
  } catch {
    fail(`${spec.label}: invalid JSON`);
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    fail(`${spec.label}: root must be an object`);
  }
  let count = 0;
  for (const record of Object.values(document)) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      fail(`${spec.label}: every record must be an object`);
    }
    const ciphertext = record[spec.field];
    if (typeof ciphertext !== "string" || !CIPHERTEXT.test(ciphertext)) {
      fail(`${spec.label}: unsupported ciphertext format`);
    }
    try {
      decrypt(ciphertext, key);
    } catch {
      fail(`${spec.label}: ciphertext cannot be decrypted with the current key`);
    }
    count += 1;
  }
  return { document, count };
}

function reencryptDocument(document, spec, oldKey, newKey) {
  const next = structuredClone(document);
  for (const record of Object.values(next)) {
    const plaintext = decrypt(record[spec.field], oldKey);
    record[spec.field] = encrypt(plaintext, newKey);
  }
  return next;
}

function isMissing(error) {
  return error?.code === "ENOENT" || error?.code === 2 || error?.code === "2";
}

function permissionBits(mode) {
  if (typeof mode === "string" && /^[0-7]{3,4}$/.test(mode)) {
    return Number.parseInt(mode, 8) & 0o777;
  }
  if (typeof mode === "number" && Number.isInteger(mode) && mode >= 0) {
    return mode & 0o777;
  }
  fail("Unsupported remote mode format");
}

async function readRemote(executor, spec, key) {
  let raw;
  try {
    raw = String(await executor.readFile(spec.remotePath, "utf8"));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const checked = validateDocument(raw, spec, key);
  return { ...checked, raw };
}

async function verifyRemote(executor, spec, key, expectedCount) {
  const current = await readRemote(executor, spec, key);
  if (!current || current.count !== expectedCount) {
    fail(`${spec.label}: post-write verification count mismatch`);
  }
}

async function assertRemoteAbsent(executor, remotePath) {
  try {
    await executor.stat(remotePath);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  fail("A reserved rekey path already exists; aborting without overwrite");
}

async function assertNoRekeyArtifacts(executor, spec) {
  const dirname = path.posix.dirname(spec.remotePath);
  const basename = path.posix.basename(spec.remotePath);
  let entries;
  try {
    entries = await executor.readdir(dirname);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  const reserved = entries.some(
    (entry) =>
      entry.name.startsWith(`.${basename}.phase1-`) ||
      entry.name.startsWith(`${basename}.failed-`),
  );
  if (reserved) fail(`${spec.label}: unresolved prior rekey artifacts exist`);
}

async function rollback(swaps, oldKeys, opId) {
  const failures = [];
  for (const swap of [...swaps].reverse()) {
    const failedPath = `${swap.spec.remotePath}.failed-${opId}`;
    try {
      if (swap.state === "prepared") {
        continue;
      }
      if (swap.state === "active") {
        await swap.executor.rename(swap.spec.remotePath, failedPath);
      }
      await swap.executor.rename(swap.backupPath, swap.spec.remotePath);
      await verifyRemote(
        swap.executor,
        swap.spec,
        oldKeys[swap.spec.envKey],
        swap.count,
      );
    } catch {
      failures.push(swap.ordinal);
    } finally {
      await swap.executor.unlink(swap.temporary).catch(() => undefined);
    }
  }
  if (failures.length) fail(`Rollback failed on ${failures.length} target file(s)`);
}

async function atomicUpdateEnv(envText, newKeys, opId) {
  const current = await fs.readFile(ENV_PATH, "utf8");
  if (current !== envText) fail("Environment file changed during execution");

  let next = current;
  for (const spec of SPECS) {
    const line = new RegExp(`^${spec.envKey}=.*$`, "gm");
    const matches = next.match(line) ?? [];
    if (matches.length !== 1) fail(`${spec.envKey} must appear exactly once`);
    next = next.replace(line, `${spec.envKey}=${newKeys[spec.envKey]}`);
  }

  const stat = await fs.stat(ENV_PATH);
  if ((stat.mode & 0o077) !== 0) {
    fail("Environment file permissions exceed 0600");
  }
  const temporary = `${ENV_PATH}.phase1-rekey-${opId}.tmp`;
  let handle;
  try {
    handle = await fs.open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, stat.mode & 0o777);
    await handle.writeFile(next, "utf8");
    await handle.sync();
    await handle.chown(stat.uid, stat.gid);
    await handle.chmod(stat.mode & 0o777);
    await handle.close();
    handle = null;
    await fs.rename(temporary, ENV_PATH);
    const dir = await fs.open(path.dirname(ENV_PATH), constants.O_RDONLY);
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function main() {
  const mode = parseArgs(process.argv.slice(2));
  if (mode.apply || mode.cleanupOp) {
    try {
      activeLockHandle = await fs.open(
        LOCK_PATH,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        0o600,
      );
      ownsLock = true;
      await activeLockHandle.writeFile(`${process.pid}\n`, "utf8");
      await activeLockHandle.sync();
    } catch (error) {
      if (error?.code === "EEXIST") fail("Another rekey operation is active");
      throw error;
    }
  }
  // The shared executor logs target UUIDs and hosts at info level. Operational
  // rekey output must contain counts only, so load it after forcing error-only.
  process.env.LOG_LEVEL = "error";
  const envText = await fs.readFile(ENV_PATH, "utf8");
  for (const [key, values] of parseEnv(envText)) {
    if (values.length === 1 && process.env[key] === undefined) {
      process.env[key] = values[0];
    }
  }
  ({ disposeAllVaultExecutors, getVaultExecutor } = await import(
    "../../dist/shared/executor/vault-executor.js"
  ));
  const oldKeys = requireKeys(envText);
  const store = JSON.parse(await fs.readFile(TARGET_STORE, "utf8"));
  if (!store || typeof store !== "object" || Array.isArray(store)) {
    fail("Target store must be an object");
  }
  const targetIds = Object.keys(store);
  if (!targetIds.length) fail("Target store is empty");

  const plans = [];
  let ordinal = 0;
  for (const targetId of targetIds) {
    ordinal += 1;
    const executor = await getVaultExecutor(targetId);
    if (!executor) fail(`Target ${ordinal}: executor unavailable`);
    for (const spec of SPECS) {
      if (!mode.verify && !mode.cleanupOp) {
        await assertNoRekeyArtifacts(executor, spec);
      }
      const current = await readRemote(executor, spec, oldKeys[spec.envKey]);
      if (current) plans.push({ executor, ordinal, spec, ...current });
    }
  }

  const counts = Object.fromEntries(SPECS.map((spec) => [spec.label, 0]));
  for (const plan of plans) counts[plan.spec.label] += plan.count;
  console.log(`preflight=PASS targets=${targetIds.length} mail=${counts.mail} git=${counts.git}`);
  if (mode.cleanupOp) {
    let removed = 0;
    for (const plan of plans) {
      const basename = path.posix.basename(plan.spec.remotePath);
      const dirname = path.posix.dirname(plan.spec.remotePath);
      const backupPath = `${dirname}/.${basename}.phase1-pre-rekey-${mode.cleanupOp}.bak`;
      try {
        await plan.executor.stat(backupPath);
      } catch (error) {
        if (isMissing(error)) continue;
        throw error;
      }
      await plan.executor.unlink(backupPath);
      await assertRemoteAbsent(plan.executor, backupPath);
      removed += 1;
    }
    if (!removed) fail("No matching successful-operation backups were found");
    console.log(`cleanup=PASS removed=${removed}`);
    return;
  }
  if (!mode.apply) {
    console.log(mode.verify ? "verify=PASS writes=0" : "dry_run=PASS writes=0");
    return;
  }

  const opId = `${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(6).toString("hex")}`;
  const newKeys = {
    MAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    GIT_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  };
  if (newKeys.MAIL_ENCRYPTION_KEY === oldKeys.MAIL_ENCRYPTION_KEY ||
      newKeys.GIT_ENCRYPTION_KEY === oldKeys.GIT_ENCRYPTION_KEY ||
      newKeys.MAIL_ENCRYPTION_KEY === newKeys.GIT_ENCRYPTION_KEY) {
    fail("Generated key collision");
  }

  const swaps = [];
  try {
    for (const plan of plans) {
      const basename = path.posix.basename(plan.spec.remotePath);
      const dirname = path.posix.dirname(plan.spec.remotePath);
      const temporary = `${dirname}/.${basename}.phase1-rekey-${opId}.tmp`;
      const backupPath = `${dirname}/.${basename}.phase1-pre-rekey-${opId}.bak`;
      const failedPath = `${plan.spec.remotePath}.failed-${opId}`;
      await assertRemoteAbsent(plan.executor, temporary);
      await assertRemoteAbsent(plan.executor, backupPath);
      await assertRemoteAbsent(plan.executor, failedPath);

      const latest = await readRemote(
        plan.executor,
        plan.spec,
        oldKeys[plan.spec.envKey],
      );
      if (!latest || latest.raw !== plan.raw) {
        fail(`${plan.spec.label}: source changed during execution`);
      }
      const next = reencryptDocument(
        latest.document,
        plan.spec,
        oldKeys[plan.spec.envKey],
        newKeys[plan.spec.envKey],
      );
      await plan.executor.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      const stagedRaw = String(await plan.executor.readFile(temporary, "utf8"));
      const staged = validateDocument(stagedRaw, plan.spec, newKeys[plan.spec.envKey]);
      if (staged.count !== plan.count) fail(`${plan.spec.label}: staged count mismatch`);
      const swap = {
        ...plan,
        backupPath,
        temporary,
        state: "prepared",
      };
      swaps.push(swap);
      await plan.executor.rename(plan.spec.remotePath, backupPath);
      swap.state = "backed_up";
      await plan.executor.rename(temporary, plan.spec.remotePath);
      swap.state = "active";
      const remoteStat = await plan.executor.stat(plan.spec.remotePath);
      if (permissionBits(remoteStat.mode) !== 0o600) {
        fail(`${plan.spec.label}: resulting mode is not 0600`);
      }
      await verifyRemote(
        plan.executor,
        plan.spec,
        newKeys[plan.spec.envKey],
        plan.count,
      );
      console.log(`target=${plan.ordinal} path=${plan.spec.remotePath} migrated=${plan.count}`);
    }
    await atomicUpdateEnv(envText, newKeys, opId);
  } catch (error) {
    await rollback(swaps, oldKeys, opId);
    throw error;
  }

  console.log(`apply=PASS opId=${opId} mail=${counts.mail} git=${counts.git}`);
  console.log("next=restart luxipanel-backend with ecosystem re-evaluation, then run --verify");

  await activeLockHandle?.close();
  activeLockHandle = undefined;
  if (ownsLock) {
    await fs.unlink(LOCK_PATH);
    ownsLock = false;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main()
    .catch((error) => {
      console.error(`rekey=FAILED reason=${error?.message ?? "unknown"}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disposeAllVaultExecutors().catch(() => undefined);
      await activeLockHandle?.close().catch(() => undefined);
      if (ownsLock) await fs.unlink(LOCK_PATH).catch(() => undefined);
    });
}

export {
  parseArgs,
  parseEnv,
  permissionBits,
  reencryptDocument,
  requireKeys,
  validateDocument,
};
