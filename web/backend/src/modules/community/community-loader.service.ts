import { createHash } from "node:crypto";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { chatContractErrors } from "../../shared/module-sdk/chat-contract.js";
import { getModuleCatalog } from "../../shared/module-state/index.js";
/**
 * Loader de módulos de comunidad (estado de instancia; corre en runOnPanelHost).
 * Escanea modules/community/installed/<id>/, importa el factory (defineModule),
 * construye el AgentCapability vía el SDK y lo registra. Soporta carga/descarga
 * en caliente (publicar/suspender). Ver MODULE-SDK-SPEC §5.
 *
 * NOTA: los módulos aprobados se vendorizan en `installed/<id>/` (separado de la
 * infra del loader). La verificación firma+content_hash se hará en el job de
 * integración (Fase F); aquí se asume ya verificado.
 *
 * ⚠️ SEGURIDAD (clasificación fail-closed del `import()` en proceso). Cargar un
 * dir con `await import()` ejecuta su código DENTRO del proceso del panel, que
 * en managed comparte heap con material mTLS, LUXIPANEL_KEY y executores SSH de
 * OTROS tenants. Por eso la decisión "este dir puede importarse en proceso" NO
 * puede depender de la AUSENCIA de un marker (un marker borrado/parcial/no
 * legible degradaría código de un dev adversario a import() completo — el bug
 * fail-OPEN señalado por revisión). Reglas duras:
 *   1. `.preview.json` presente → preview Modo B: SOLO se importa con el
 *      kill-switch encendido Y (hoy) NUNCA en proceso, porque el runtime
 *      aislado out-of-process todavía no existe (ver `previewSandboxRuntime`).
 *   2. Marker ilegible/corrupto → se SALTA (nunca se reclasifica a aprobado).
 *   3. Aprobado = señal POSITIVA verificada (firma+content_hash, Fase F). Hasta
 *      que exista, `isApprovedForInProcessImport` exige que `entry.backend`
 *      apunte a `community/installed/` y que el dir NO tenga marker de preview;
 *      esa es la única puerta al `import()` y es la que Fase F endurecerá. No
 *      añadas rutas paralelas de import — toda carga pasa por `loadFromDisk`.
 */
import fs from "node:fs";
import { repositoryRoot } from "../../shared/installation-layout.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { agentCapabilityRegistry } from "../../shared/agent-capability/registry.js";
import { sdkRangeSupported } from "../../shared/module-sdk/sdk-range.js";
import { buildCapability, SDK_VERSION, type ModuleManifest, type ModuleFactory } from "../../shared/module-sdk/index.js";
import { communityCatalog } from "../../shared/community-catalog.js";
import {
  communityPreviewRegistry,
  getCommunityInstalledDir,
  PREVIEW_MARKER_FILE,
  type PreviewMeta,
} from "../../shared/community-preview/index.js";
import type { ModuleDefinition } from "../admin/services/module-registry.service.js";
import { createModuleLogger } from "../../shared/logger/index.js";
import { previewSandboxRuntime } from "../../shared/preview-sandbox/runtime.js";
import { env } from "../../config/env.js";
import { validateLpApiKey } from "../../shared/lp-api-key.js";

/** Deriva un ModuleDefinition (catálogo/sidebar) del manifest. */
function manifestToDefinition(m: any): ModuleDefinition {
  return {
    id: m.id,
    name: m.name ?? m.id,
    description: m.description ?? "",
    tag: (m.priceTokens ?? m.price_tokens ?? 0) > 0 ? "premium" : "free",
    icon: m.icon ?? "tabler:package",
    color: m.color ?? "slate",
    category: (m.category ?? "developer") as ModuleDefinition["category"],
    features: Array.isArray(m.features) ? m.features : [],
    dependencies: Array.isArray(m.dependencies) ? m.dependencies : undefined,
    permissions: m.surface ?? undefined,
  };
}

const log = createModuleLogger("community-loader");

// Path canónico de installed/ — única fuente: shared/community-preview (lo
// comparte module-dev para el vendorizado de previews Modo B).
const INSTALLED_DIR = getCommunityInstalledDir();

/** Manifests de los módulos cargados (para dispatch/unload). */
const loaded = new Map<string, ModuleManifest>();
const generations = new Map<string, number>();

/** Carga (o recarga) un módulo desde un factory ya importado + su manifest.
 *  Con `preview` (Modo B, marker `.preview.json`): registra las tools pero NO
 *  publica el módulo en communityCatalog → invisible en catálogo/sidebar/
 *  /panel/modules para TODOS; solo el owner lo ve vía asistente/MCP/module-dev. */
export function loadModule(manifest: ModuleManifest, factory: ModuleFactory, preview?: PreviewMeta | null): void {
  if (!loaded.has(manifest.id) && (getModuleCatalog().some(module => module.id === manifest.id) || agentCapabilityRegistry.get(manifest.id))) throw new Error("Community module collides with an existing module");
  const cap = buildCapability(manifest, factory);
  const guarded = {
    ...cap,
    tools: cap.tools.map((tool) => ({
      ...tool,
      handler: async (input: unknown) => {
        if (await validateLpApiKey() !== "valid") return { ok: false, output: "API KEY válida requerida para módulos de comunidad." };
        return tool.handler(input);
      },
    })),
    dataPanels: cap.dataPanels?.map((panel) => ({
      ...panel,
      collect: async () => {
        if (await validateLpApiKey() !== "valid") throw new Error("API KEY válida requerida para módulos de comunidad");
        return panel.collect();
      },
    })),
  };
  agentCapabilityRegistry.register(guarded); // idempotente: reemplaza si ya existía
  loaded.set(manifest.id, manifest);
  if (preview) {
    communityPreviewRegistry.register({ ...preview, moduleId: manifest.id });
    communityCatalog.remove(manifest.id); // por si una versión previa era pública
    log.info(
      { moduleId: manifest.id, tools: cap.tools.length, ownerUserId: preview.ownerUserId },
      "community PREVIEW module loaded (solo-dev, fuera del catálogo)",
    );
    return;
  }
  communityCatalog.set(manifestToDefinition(manifest)); // visible en getCatalog/sidebar
  log.info({ moduleId: manifest.id, tools: cap.tools.length }, "community module loaded");
}

/** Descarga un módulo (suspender/inactivar). El código sigue residente hasta restart. */
export function unloadModule(moduleId: string): void {
  generations.set(moduleId, (generations.get(moduleId) ?? 0) + 1);
  if (!loaded.has(moduleId)) return; // Never unregister an unrelated core module.
  agentCapabilityRegistry.unregister(moduleId);
  loaded.delete(moduleId);
  communityCatalog.remove(moduleId);
  communityPreviewRegistry.unregister(moduleId);
  log.info({ moduleId }, "community module unloaded");
}

/** Lee el marker `.preview.json` del dir. Devuelve:
 *  - null → no es preview (módulo aprobado normal);
 *  - PreviewMeta → preview válido;
 *  - "corrupt" → marker ilegible: NUNCA cargar como público (fail-closed). */
function readPreviewMarker(dir: string): PreviewMeta | null | "corrupt" {
  const markerPath = path.join(dir, PREVIEW_MARKER_FILE);
  if (!fs.existsSync(markerPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(markerPath, "utf-8")) as Record<string, unknown>;
    const ownerUserId = String(raw.ownerUserId ?? "");
    if (!ownerUserId) return "corrupt";
    return {
      moduleId: String(raw.moduleId ?? path.basename(dir)),
      ownerUserId,
      ...(raw.ownerUsername ? { ownerUsername: String(raw.ownerUsername) } : {}),
      ...(raw.projectId ? { projectId: String(raw.projectId) } : {}),
      installedAt: String(raw.installedAt ?? ""),
    };
  } catch {
    return "corrupt";
  }
}

/**
 * Señal POSITIVA de "aprobado → puede importarse en proceso". Hoy es un gate
 * estructural mínimo (sin firma): el dir NO debe tener marker de preview y su
 * `entry.backend` debe resolver DENTRO de `community/installed/<id>/`. La
 * verificación criptográfica real (firma + content_hash del bundle aprobado por
 * LP) es la Fase F y DEBE reemplazar este cuerpo antes de tratar import() como
 * seguro frente a un bundle manipulado en disco. La clave de seguridad: esta es
 * una comprobación POSITIVA — la ausencia de marker NO basta; si un futuro
 * refactor la deja devolver `true` por defecto, reintroduce el fail-OPEN.
 */
function isApprovedForInProcessImport(dir: string, manifest: ModuleManifest): boolean {
  // Defensa-en-profundidad: nunca importar un dir que tenga marker de preview
  // (loadFromDisk ya lo separa antes, pero esta función es la puerta del
  // import() y no debe confiar en su llamador).
  if (fs.existsSync(path.join(dir, PREVIEW_MARKER_FILE))) return false;
  if (!sdkRangeSupported(manifest.sdk, SDK_VERSION)) return false;
  const entry = (manifest as any).entry?.backend ?? "backend/index.js";
  const moduleRoot = fs.realpathSync(dir);
  const candidate = path.resolve(moduleRoot, String(entry));
  if (!fs.existsSync(candidate)) return false;
  const entryPath = fs.realpathSync(candidate);
  if (!entryPath.startsWith(moduleRoot + path.sep)) return false;
  // Only modules included by the official release pipeline may be imported.
  try {
    const releaseFile = path.join(repositoryRoot(path.resolve(INSTALLED_DIR, "../../../../..")), "release.manifest.json");
    const release = JSON.parse(fs.readFileSync(releaseFile, "utf8"));
    const approved = release.format === 1 && release.modules?.find((entry: { id: string; version: string }) => entry.id === manifest.id && entry.version === manifest.version);
    if (!approved?.files || !Object.keys(approved.files).length) return false;
    for (const [relative, digest] of Object.entries(approved.files)) {
      const file = path.resolve(moduleRoot, relative);
      if (!file.startsWith(moduleRoot + path.sep) || fs.lstatSync(file).isSymbolicLink() || createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== digest) return false;
    }
  } catch { return false; }
  const installedRoot = fs.realpathSync(INSTALLED_DIR);
  if (!moduleRoot.startsWith(installedRoot + path.sep)) return false;
  return true;
}

/** Carga un módulo vendored desde disco (installed/<id>/). */
async function loadFromDisk(dir: string): Promise<boolean> {
  const id = path.basename(dir), generation = (generations.get(id) ?? 0) + 1;
  generations.set(id, generation);
  const manifestPath = path.join(dir, "module.manifest.json");
  if (!fs.existsSync(manifestPath)) return false;
  let manifest: ModuleManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as ModuleManifest;
  } catch (err) {
    // Corrupt or partial JSON on disk: skip this module so a single bad
    // manifest can't take down the whole loader (and so the loader still
    // completes for the other installed modules).
    log.warn({ dir, err }, "community module manifest unreadable — module skipped");
    return false;
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) || !Array.isArray(manifest.capabilities) || typeof manifest.version !== "string") return false;
  if (!/^[a-z][a-z0-9-]{2,38}$/.test(manifest.id) || path.basename(dir) !== manifest.id || chatContractErrors(manifest).length || (!loaded.has(manifest.id) && getModuleCatalog().some(module => module.id === manifest.id))) return false;
  // Clasificación fail-closed (ver cabecera §SEGURIDAD). El destino del marker
  // decide si el dir es preview, aprobado o ambiguo — y NUNCA se cae a
  // "aprobado → import()" por ausencia de marker.
  const preview = readPreviewMarker(dir);
  if (preview === "corrupt") {
    // Marker presente pero ilegible/ambiguo: jamás reclasificar. Se salta el
    // módulo entero (no se importa, no se publica).
    log.warn({ moduleId: manifest.id, dir }, "preview marker corrupt/ambiguous — module skipped (fail-closed)");
    return false;
  }
  if (preview) {
    // Preview Modo B. Aunque el kill-switch esté ENCENDIDO, el preview NO se
    // importa en proceso: el único runtime aceptable para código de un dev
    // adversario es OUT-OF-PROCESS (separate OS process/container, sin secretos
    // heredados), y ese runtime todavía no está integrado en el loader
    // (`previewSandboxRuntime.isAvailable()` es la precondición dura). Hasta que
    // exista, un `await import()` aquí sería ejecutar código no revisado en el
    // proceso multi-tenant → se salta SIEMPRE (fail-closed). El registro de
    // tools del preview lo hará el runtime aislado cuando aterrice; no hay
    // camino en proceso.
    if (!env.MODULE_DEV_PREVIEW_ENABLED) {
      log.warn(
        { moduleId: manifest.id, dir },
        "preview module on disk but MODULE_DEV_PREVIEW_ENABLED=false — skipped (fail-closed)",
      );
      return false;
    }
    log.warn(
      { moduleId: manifest.id, dir, runtime: previewSandboxRuntime.describe() },
      "preview module present but no out-of-process sandbox runtime is integrated — " +
        "in-process import() is NEVER performed for previews (fail-closed); preview tools are inert until the sandbox lands",
    );
    return false;
  }
  // No-preview: candidato a módulo APROBADO. Sólo se importa en proceso si pasa
  // la señal POSITIVA de aprobado (Fase F la endurecerá a firma+content_hash).
  if (!isApprovedForInProcessImport(dir, manifest)) {
    log.warn(
      { moduleId: manifest.id, dir },
      "module not positively verified as approved — in-process import() refused (fail-closed)",
    );
    return false;
  }
  if (!sdkRangeSupported(manifest.sdk, SDK_VERSION)) return false;
  const entry = (manifest as any).entry?.backend ?? "backend/index.js";
  // Path-guard: el entry del manifest DEBE quedar DENTRO de installed/<id>/.
  // El validador ya rechaza '..', pero un manifest escrito a mano en disco no
  // pasó por él — sin esta contención `import()` saldría del directorio del
  // módulo (y rompería cualquier sandbox por-directorio futuro).
  const moduleRoot = fs.realpathSync(dir);
  const entryPath = path.resolve(moduleRoot, String(entry));
  if (!entryPath.startsWith(moduleRoot + path.sep)) {
    log.warn(
      { moduleId: manifest.id, entry, entryPath },
      "community module entry escapes its module dir — skipped (fail-closed)",
    );
    return false;
  }
  if (!fs.existsSync(entryPath)) {
    log.warn({ moduleId: manifest.id, entryPath }, "community module entry missing — skipping");
    return false;
  }
  try {
    // cache-bust con content_hash/version para soportar recarga en caliente.
    const v = `${manifest.version}:${fs.statSync(entryPath).mtimeMs}:${Date.now()}`;
    const mod = await import(`${pathToFileURL(entryPath).href}?v=${encodeURIComponent(String(v))}`);
    // `preview` es necesariamente null aquí (el bloque `if (preview)` retornó):
    // este `import()` es EXCLUSIVO de módulos aprobados verificados. Pasamos
    // null explícito — un preview JAMÁS llega a registrarse por esta vía.
    if (generations.get(id) !== generation) return false;
    loadModule(manifest, mod.default as ModuleFactory, null);
    return true;
  } catch (err) {
    // Rechazo AISLADO: un módulo de comunidad malo NUNCA tumba el proceso
    // (a diferencia de los core, cuyo error de prefijo sí crashea).
    log.error({ err, moduleId: manifest.id }, "community module failed to load — previous version retained");
    return false;
  }
}

/** (Re)carga un módulo por id desde installed/<id>/ si está vendored en disco. */
export async function reloadModule(moduleId: string): Promise<boolean> {
  if (!/^[a-z][a-z0-9-]{2,38}$/.test(moduleId)) return false;
  const dir = path.join(INSTALLED_DIR, moduleId);
  if (!fs.existsSync(path.join(dir, "module.manifest.json"))) {
    log.info({ moduleId }, "module not vendored on disk yet (pending integration job)");
    return false;
  }
  return loadFromDisk(dir);
}

/** Aplica un cambio del poll de LP (load/unload). */
export async function applyChange(change: { moduleId: string; action: "load" | "unload" }): Promise<void> {
  if (change.action === "unload") unloadModule(change.moduleId);
  else await reloadModule(change.moduleId);
}

/** Escanea installed/ y carga todos los módulos. No-op si el dir no existe. */
export async function loadCommunityModules(): Promise<void> {
  if (!fs.existsSync(INSTALLED_DIR)) {
    log.info({ dir: INSTALLED_DIR }, "no community modules installed yet");
    return;
  }
  const entries = fs.readdirSync(INSTALLED_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const e of entries) {
    await loadFromDisk(path.join(INSTALLED_DIR, e.name));
  }
  log.info({ count: loaded.size }, "community modules load complete");
}
