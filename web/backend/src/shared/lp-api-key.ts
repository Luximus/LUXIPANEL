/** Online validation of the per-installation LP API key.
 * Protected features fail closed: no cached authorization survives an LP outage.
 */
import type { RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { CONFIG_DIR } from "../config/paths.js";

const KEY_PATTERN = /^lxp_live_[0-9a-f]{64}$/;
const TIMEOUT_MS = 10_000;
const KEY_FILE = path.join(CONFIG_DIR, "installation-api-key");

export type LpKeyStatus = "valid" | "missing" | "invalid" | "unavailable";

function configuredKey(): string {
  try {
    // The web-configured key takes precedence over the install-time env value.
    // Read each time so every worker sees rotation immediately after the
    // atomic rename, without a process restart or an authorization cache.
    return readFileSync(KEY_FILE, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return env.LP_PANEL_CREDENTIAL.trim();
  }
}

export function lpApiKey(): string | null {
  const key = configuredKey();
  return KEY_PATTERN.test(key) ? key : null;
}

export function lpApiAuthorization(): string {
  const key = lpApiKey();
  if (!key) throw new Error("API KEY de LUXIPANEL no configurada");
  return `Bearer ${key}`;
}

export async function validateLpApiKey(candidate?: string): Promise<LpKeyStatus> {
  const raw = candidate === undefined ? configuredKey() : candidate.trim();
  if (!raw) return "missing";
  if (!KEY_PATTERN.test(raw)) return "invalid";
  try {
    const response = await fetch(`${env.LICENSE_SERVER_URL.replace(/\/$/, "")}/panel-api/server-key`, {
      headers: { Authorization: `Bearer ${raw}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return "invalid";
    if (!response.ok) return "unavailable";
    const body = await response.json() as { ok?: boolean; serverKeys?: Array<{ isActive?: boolean }> };
    return body.ok && body.serverKeys?.length === 1 && body.serverKeys[0]?.isActive === true
      ? "valid" : "invalid";
  } catch {
    return "unavailable";
  }
}

/** Persist a validated key on the panel host. The plaintext never enters a
 * per-target settings store or a browser response. */
export async function saveLpApiKey(key: string): Promise<void> {
  if (!KEY_PATTERN.test(key)) throw new Error("Formato de API KEY inválido");
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const temporary = `${KEY_FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${key}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temporary, KEY_FILE);
    await fs.chmod(KEY_FILE, 0o600);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export const requireLpApiKey: RequestHandler = async (_req, res, next) => {
  const status = await validateLpApiKey();
  if (status === "valid") { next(); return; }
  res.set("Cache-Control", "no-store");
  res.status(status === "unavailable" ? 503 : 403).json({
    ok: false,
    code: status === "unavailable" ? "LP_API_KEY_UNAVAILABLE" : "LP_API_KEY_REQUIRED",
    error: status === "unavailable"
      ? "No se pudo validar la API KEY con LUXIPANEL. Inténtalo de nuevo cuando el servicio responda."
      : "Configura una API KEY válida de este servidor para usar esta función.",
  });
};
