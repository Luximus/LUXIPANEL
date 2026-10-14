// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * secret-store — almacena los shared secrets recibidos por push de
 * LP-LICENSE-SERVER. In-memory + persistencia local en JSON para que
 * sobreviva restarts.
 *
 * Modelo:
 *   - Cada `kind` tiene un `active` (el último recibido) y un `previous`
 *     (el anterior, válido durante grace).
 *   - `getActive(kind)` devuelve el active actual.
 *
 * Persistencia: ${LUXIPANEL_CONFIG_DIR}/shared-secrets.json (modo 0600).
 * El archivo NO está cifrado: la KEK del lado LP-LS estaría en el .env de
 * LUXIPANEL — duplicar el material no aporta defensa real (mismo radio).
 * En cambio, restringimos permisos del archivo y dependemos de la seguridad
 * del filesystem del host LUXIPANEL.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CONFIG_DIR } from "@config/paths.js";
import { env } from "@config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const log = createModuleLogger("secret-store");

interface SecretEntry {
  active: string;
  previous: string | null;
  /** ISO. Cuándo el active entró en vigor. */
  rotatedAt: string;
  /** ISO. Hasta cuándo el previous sigue siendo válido. null = ya inválido. */
  previousValidUntil: string | null;
}

type StoreShape = Record<string, SecretEntry>;

/**
 * Resolución del archivo de persistencia con cascada de paths writable:
 *   1. ${SECRET_ROTATION_FILE} si está definido (override explícito).
 *   2. ${LUXIPANEL_CONFIG_DIR}/shared-secrets.json (default; típicamente
 *      /etc/luxipanel — requiere permisos en ese dir).
 *   3. ${HOME}/.luxipanel/shared-secrets.json (fallback usuario).
 *
 * El primero del que se pueda escribir gana. Si todos fallan, el store vive
 * sólo en memoria — los secrets se pierden al restart pero el siguiente push
 * de rotación los repuebla (o el env actúa como bootstrap fallback).
 *
 * NO se cae a `${cwd}/data`: escribir shared secrets en claro dentro del árbol
 * desplegado los expone a cualquier lectura del directorio de la app.
 */
const CANDIDATE_PATHS: string[] = [
  env.SECRET_ROTATION_FILE,
  path.join(CONFIG_DIR, "shared-secrets.json"),
  path.join(os.homedir() || "/tmp", ".luxipanel", "shared-secrets.json"),
].filter((p): p is string => typeof p === "string" && !!p);

let resolvedFilePath: string | null = null;

async function resolveWritablePath(): Promise<string | null> {
  for (const candidate of CANDIDATE_PATHS) {
    try {
      await fs.mkdir(path.dirname(candidate), { recursive: true });
      // Crear con 0600 desde el inicio (evita la ventana con el umask 0644 que
      // dejaba el fichero legible por todos antes del chmod).
      const fh = await fs.open(candidate, "a", 0o600);
      await fh.close();
      // Endurecer 0600 aunque el fichero ya existiera con permisos laxos. Fallar
      // RUIDOSAMENTE: si no se puede restringir, NO usar este path (el contenido
      // son secretos en claro).
      try {
        await fs.chmod(candidate, 0o600);
      } catch (chmodErr: any) {
        log.error(
          { path: candidate, err: chmodErr?.code },
          "No se pudo fijar 0600 en shared-secrets — descartando path por seguridad",
        );
        continue;
      }
      log.info({ path: candidate }, "Secret store persistence path resuelto");
      return candidate;
    } catch (err: any) {
      log.debug({ path: candidate, err: err?.code }, "Path no writable, probando siguiente");
    }
  }
  log.warn("Ningún path writable para secret store — modo solo-memoria");
  return null;
}

let cache: StoreShape = {};
let initialized = false;

async function loadFromDisk(): Promise<void> {
  if (!resolvedFilePath) {
    resolvedFilePath = await resolveWritablePath();
  }
  if (!resolvedFilePath) {
    cache = {};
    initialized = true;
    return;
  }
  try {
    const raw = await fs.readFile(resolvedFilePath, "utf8");
    if (raw.trim().length === 0) {
      cache = {};
    } else {
      const parsed = JSON.parse(raw) as StoreShape;
      cache = parsed && typeof parsed === "object" ? parsed : {};
    }
    log.info({ kinds: Object.keys(cache), path: resolvedFilePath }, "Secret store cargado desde disco");
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      log.info({ path: resolvedFilePath }, "Secret store vacío en disco — empezando vacío");
      cache = {};
    } else {
      log.error({ err: err?.message, path: resolvedFilePath }, "Error leyendo shared-secrets — empezando vacío");
      cache = {};
    }
  }
  initialized = true;
}

async function persistToDisk(): Promise<void> {
  if (!resolvedFilePath) return; // modo memoria-only
  try {
    const tmp = `${resolvedFilePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2), { mode: 0o600 });
    await fs.rename(tmp, resolvedFilePath);
    await fs.chmod(resolvedFilePath, 0o600).catch(() => undefined);
  } catch (err: any) {
    log.error({ err: err?.message, path: resolvedFilePath }, "No se pudo persistir shared-secrets.json");
  }
}

export async function initSecretStore(): Promise<void> {
  if (initialized) return;
  await loadFromDisk();
}

/** Plaintext active del kind, o null si no se ha recibido ninguno. */
export function getActive(kind: string): string | null {
  return cache[kind]?.active ?? null;
}

/** Actualiza un kind: nuevo active + previous + grace. Persiste a disco. */
export async function setSecret(
  kind: string,
  newActive: string,
  previous: string | null,
  rotatedAtIso: string,
  previousValidUntilIso: string | null,
): Promise<void> {
  if (!initialized) await loadFromDisk();
  cache[kind] = {
    active: newActive,
    previous,
    rotatedAt: rotatedAtIso,
    previousValidUntil: previousValidUntilIso,
  };
  await persistToDisk();
  log.info({ kind, rotatedAt: rotatedAtIso }, "Shared secret actualizado");
}

/** Snapshot debug (no expone plaintexts). */
export function getDebugSummary(): Array<{ kind: string; rotatedAt: string; hasPrevious: boolean; previousValidUntil: string | null }> {
  return Object.entries(cache).map(([kind, e]) => ({
    kind,
    rotatedAt: e.rotatedAt,
    hasPrevious: !!e.previous,
    previousValidUntil: e.previousValidUntil,
  }));
}
