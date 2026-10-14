import { sdkRangeSupported } from "../../../shared/module-sdk/sdk-range.js";
import { SDK_VERSION } from "../../../shared/module-sdk/sdk-version.js";
import { chatContractErrors } from "../../../shared/module-sdk/chat-contract.js";
/**
 * Validador PURO de `module.manifest.json` — sin Ajv, sin fs, sin express.
 *
 * Refleja a mano las reglas de /var/www/LUXIPANEL/module.manifest.schema.json
 * (el JSON Schema sigue siendo el contrato canónico; los tests de este archivo
 * fijan la paridad). Decisión de diseño: validador hecho a mano para no añadir
 * dependencia nueva (pnpm v11 con minimumReleaseAge/allowBuilds) y para poder
 * emitir WARNINGS de negocio que un schema no expresa:
 *   - campos AUTO presentes (version/os_compat/arch/path/commit) → "lo fija la
 *     plataforma" (MODULE-DEV-AI-FLOW.md §4);
 *   - entry .ts → el loader importa JS en producción;
 *   - propiedades desconocidas (additionalProperties) → warning, no error.
 */

import type { ManifestIssue, ManifestValidationResult } from "../models/index.js";

// ── Constantes del schema ───────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "id",
  "name",
  "description",
  "sdk",
  "category",
  "icon",
  "color",
  "scope",
  "min_specs",
  "capabilities",
  "pricing",
  "entry",
  "chat",
] as const;

const KNOWN_FIELDS = new Set<string>([
  ...REQUIRED_FIELDS,
  "version",
  "path",
  "commit",
  "os_compat",
  "arch",
  "runtime_deps",
  "http_allowlist",
  "surface",
  "tool_permissions",
  "configFields",
  "dependencies",
]);

/** Campos que fija la plataforma — un valor del dev/IA se sobreescribe. */
const AUTO_FIELDS = ["version", "os_compat", "arch", "path", "commit"] as const;

// Same pattern as shared/marketplace-link's MODULE_ID_RE, but kept LOCAL on
// purpose: this validator is intentionally dependency-free (see file header —
// "sin Ajv, sin fs, sin express") and reflects the canonical JSON Schema
// (module.manifest.schema.json), a different contract from the runtime id check.
// Importing marketplace-link (a repository module) here would regress that purity.
const ID_RE = /^[a-z][a-z0-9-]{2,38}$/;
const ICON_RE = /^(tabler|vscode-icons):[a-z0-9-]+$/;
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const SDK_RANGE_RE = /^([\^~]?\d+(\.\d+){0,2}|(>=|>|<=|<)\d+(\.\d+){0,2})$/;
const PATH_RE = /^(?:web\/)?modules\/[a-z][a-z0-9-]{2,38}$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;
const OS_COMPAT_ITEM_RE = /^[a-z][a-z0-9+._-]*([><]=?[0-9][0-9.]*)?$/;
const RUNTIME_DEP_RE = OS_COMPAT_ITEM_RE;
const HTTP_HOST_RE = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/;
const SLUG_RE = /^[a-z][a-z0-9_-]*([.:][a-z0-9_-]+)*$/;
const TOOL_SUFFIX_RE = /^[a-z][a-z0-9_-]*$/;
const CONFIG_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ENTRY_BACKEND_RE = /^backend\/[A-Za-z0-9_./-]+\.(js|mjs|ts)$/;
const ENTRY_FRONTEND_RE = /^frontend(\/[A-Za-z0-9_./-]*)?$/;

/** Path traversal en entries: '..' (en cualquier posición, paridad con el
 *  schema canónico) y segmentos '.'/vacíos quedan FUERA aunque el regex de
 *  forma los admita (el loader hace path.resolve + import del entry). */
function hasUnsafePathSegments(rel: string): boolean {
  return rel.includes("..") || rel.split("/").some((seg) => seg === "." || seg === "");
}

const CATEGORIES = ["communication", "infrastructure", "security", "developer"] as const;

const COLORS = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose",
] as const;

const SCOPES = ["local", "global"] as const;

const CAPABILITIES = [
  "server.exec",
  "server.sudo",
  "server.fs.read",
  "server.fs.write",
  "storage",
  "http",
] as const;

const PRICING_MODELS = ["free", "subscription"] as const;
const ARCHES = ["x86_64", "arm64"] as const;
const CONFIG_FIELD_TYPES = ["text", "email", "password", "select"] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function uniqueViolation(arr: unknown[]): boolean {
  return new Set(arr.map((x) => JSON.stringify(x))).size !== arr.length;
}

/**
 * Validate an array of string-ish entries with the recurring manifest shape:
 *   • not an array (or empty when `requireNonEmpty`) → `arrayMessage`
 *   • duplicate entries → "entradas duplicadas"
 *   • each entry that fails `validItem` → `itemMessage` at `<path>[i]`
 *
 * `err` is the issue-collector closure from {@link validateManifest}.
 */
function validateStringArray(
  value: unknown,
  path: string,
  err: (path: string, message: string) => void,
  opts: {
    validItem: (item: unknown) => boolean;
    arrayMessage: string;
    itemMessage: string;
    requireNonEmpty?: boolean;
  },
): void {
  if (!Array.isArray(value) || (opts.requireNonEmpty && value.length < 1)) {
    err(path, opts.arrayMessage);
    return;
  }
  if (uniqueViolation(value)) err(path, "entradas duplicadas");
  value.forEach((item, i) => {
    if (!opts.validItem(item)) err(`${path}[${i}]`, opts.itemMessage);
  });
}

// ── Validador ───────────────────────────────────────────────────────────────

/**
 * Valida un manifest borrador. Nunca lanza: cualquier entrada (incluido un
 * no-objeto) produce un `ManifestValidationResult` consumible por la UI/IA.
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: ManifestIssue[] = [];
  const warnings: ManifestIssue[] = [];
  const err = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });

  if (!isPlainObject(manifest)) {
    err("", "el manifest debe ser un objeto JSON");
    return { valid: false, errors, warnings };
  }
  const m = manifest;
  for (const message of chatContractErrors(m)) err("chat", message);

  // Requeridos
  for (const field of REQUIRED_FIELDS) {
    if (m[field] === undefined) err(field, "campo requerido ausente");
  }

  // additionalProperties → warning (no error: tolerante con borradores de la IA)
  for (const key of Object.keys(m)) {
    if (!KNOWN_FIELDS.has(key)) {
      warn(key, "propiedad desconocida — el pipeline la rechazará (additionalProperties: false)");
    }
  }

  // Campos AUTO → warning de negocio
  for (const field of AUTO_FIELDS) {
    if (m[field] !== undefined) {
      warn(field, "campo AUTO: lo fija la plataforma al aprobar — el valor escrito se ignora/sobreescribe");
    }
  }

  // id
  if (m.id !== undefined) {
    if (typeof m.id !== "string" || !ID_RE.test(m.id)) {
      err("id", "debe cumplir ^[a-z][a-z0-9-]{2,38}$ (minúsculas, dígitos y guiones; 3-39 chars)");
    }
  }

  // name / description
  if (m.name !== undefined && (typeof m.name !== "string" || m.name.length < 1 || m.name.length > 48)) {
    err("name", "string de 1 a 48 caracteres");
  }
  if (
    m.description !== undefined &&
    (typeof m.description !== "string" || m.description.length < 1 || m.description.length > 160)
  ) {
    err("description", "string de 1 a 160 caracteres");
  }

  // version (AUTO, pero si viene debe ser semver)
  if (m.version !== undefined && (typeof m.version !== "string" || !SEMVER_RE.test(m.version))) {
    err("version", "debe ser semver válido (la plataforma lo recalcula de todos modos)");
  }

  // sdk
  if (!sdkRangeSupported(m.sdk, SDK_VERSION)) err("sdk", `incompatible con SDK ${SDK_VERSION}`);
  if (m.sdk !== undefined && (typeof m.sdk !== "string" || !SDK_RANGE_RE.test(m.sdk))) {
    err("sdk", "rango npm simple, p.ej. \"^1.0.0\" o \">=1\"");
  }

  // category / icon / color / scope
  if (m.category !== undefined && !(CATEGORIES as readonly string[]).includes(m.category as string)) {
    err("category", `debe ser una de: ${CATEGORIES.join(", ")}`);
  }
  if (m.icon !== undefined && (typeof m.icon !== "string" || !ICON_RE.test(m.icon))) {
    err("icon", "set offline: tabler:<nombre> o vscode-icons:<nombre>");
  }
  if (m.color !== undefined && !(COLORS as readonly string[]).includes(m.color as string)) {
    err("color", `token de color Tailwind; uno de: ${COLORS.join(", ")}`);
  }
  if (m.scope !== undefined && !(SCOPES as readonly string[]).includes(m.scope as string)) {
    err("scope", 'debe ser "local" o "global"');
  }

  // path / commit (AUTO)
  if (m.path !== undefined && (typeof m.path !== "string" || !PATH_RE.test(m.path))) {
    err("path", "debe ser modules/<id> (lo fija la plataforma)");
  }
  if (m.commit !== undefined && (typeof m.commit !== "string" || !COMMIT_RE.test(m.commit))) {
    err("commit", "hash git hex de 7-40 chars (lo fija la plataforma)");
  }

  // os_compat / arch (AUTO)
  if (m.os_compat !== undefined) {
    validateStringArray(m.os_compat, "os_compat", err, {
      validItem: (item) => typeof item === "string" && OS_COMPAT_ITEM_RE.test(item),
      arrayMessage: "array con al menos 1 entrada",
      itemMessage: "formato distro o distro>=version, p.ej. ubuntu>=22.04",
      requireNonEmpty: true,
    });
  }
  if (m.arch !== undefined) {
    validateStringArray(m.arch, "arch", err, {
      validItem: (item) => (ARCHES as readonly string[]).includes(item as string),
      arrayMessage: "array con al menos 1 entrada",
      itemMessage: `debe ser una de: ${ARCHES.join(", ")}`,
      requireNonEmpty: true,
    });
  }

  // min_specs
  if (m.min_specs !== undefined) {
    if (!isPlainObject(m.min_specs)) {
      err("min_specs", "objeto { cpu, ramMb, diskMb }");
    } else {
      const s = m.min_specs;
      if (!isInt(s.cpu) || (s.cpu as number) < 1) err("min_specs.cpu", "entero ≥ 1 (vCPU)");
      if (!isInt(s.ramMb) || (s.ramMb as number) < 64) err("min_specs.ramMb", "entero ≥ 64");
      if (!isInt(s.diskMb) || (s.diskMb as number) < 10) err("min_specs.diskMb", "entero ≥ 10");
      for (const key of Object.keys(s)) {
        if (!["cpu", "ramMb", "diskMb"].includes(key)) {
          warn(`min_specs.${key}`, "propiedad desconocida en min_specs");
        }
      }
    }
  }

  // runtime_deps
  if (m.runtime_deps !== undefined) {
    validateStringArray(m.runtime_deps, "runtime_deps", err, {
      validItem: (item) => typeof item === "string" && RUNTIME_DEP_RE.test(item),
      arrayMessage: "debe ser un array",
      itemMessage: "formato paquete o paquete>=version, p.ej. nginx>=1.24",
    });
  }

  // capabilities (set cerrado de 6)
  const caps = new Set<string>();
  if (m.capabilities !== undefined) {
    if (!Array.isArray(m.capabilities)) {
      err("capabilities", "debe ser un array (set cerrado de capabilities)");
    } else {
      if (uniqueViolation(m.capabilities)) err("capabilities", "entradas duplicadas");
      m.capabilities.forEach((item, i) => {
        if (!(CAPABILITIES as readonly string[]).includes(item as string)) {
          err(`capabilities[${i}]`, `capability desconocida; set cerrado: ${CAPABILITIES.join(", ")}`);
        } else {
          caps.add(item as string);
        }
      });
    }
  }

  // http_allowlist
  if (m.http_allowlist !== undefined) {
    validateStringArray(m.http_allowlist, "http_allowlist", err, {
      validItem: (item) => typeof item === "string" && HTTP_HOST_RE.test(item),
      arrayMessage: "debe ser un array de hostnames",
      itemMessage: "hostname (con *. opcional), sin esquema ni path",
    });
  }

  // surface
  let surfaceHasSidebarOrViews = false;
  if (m.surface !== undefined) {
    if (!isPlainObject(m.surface)) {
      err("surface", "objeto { sidebar?, views?, actions? }");
    } else {
      for (const key of Object.keys(m.surface)) {
        if (!["sidebar", "views", "actions"].includes(key)) {
          warn(`surface.${key}`, "propiedad desconocida en surface");
          continue;
        }
        const arr = m.surface[key];
        if (!Array.isArray(arr)) {
          err(`surface.${key}`, "debe ser un array de slugs");
          continue;
        }
        if (uniqueViolation(arr)) err(`surface.${key}`, "entradas duplicadas");
        arr.forEach((item, i) => {
          if (typeof item !== "string" || !SLUG_RE.test(item)) {
            err(`surface.${key}[${i}]`, "slug inválido (p.ej. panel.mi-modulo o mi-modulo:accion)");
          }
        });
        if ((key === "sidebar" || key === "views") && arr.length > 0) surfaceHasSidebarOrViews = true;
      }
    }
  }

  // tool_permissions
  if (m.tool_permissions !== undefined) {
    if (!isPlainObject(m.tool_permissions)) {
      err("tool_permissions", "objeto { <sufijo de tool>: <slug de permiso> }");
    } else {
      for (const [suffix, slug] of Object.entries(m.tool_permissions)) {
        if (!TOOL_SUFFIX_RE.test(suffix)) {
          err(`tool_permissions.${suffix}`, "el sufijo de tool debe cumplir ^[a-z][a-z0-9_-]*$");
        }
        if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
          err(`tool_permissions.${suffix}`, "el valor debe ser un slug de permiso válido");
        }
      }
    }
  }

  // configFields
  if (m.configFields !== undefined) {
    if (!Array.isArray(m.configFields)) {
      err("configFields", "debe ser un array");
    } else {
      m.configFields.forEach((field, i) => {
        if (!isPlainObject(field)) {
          err(`configFields[${i}]`, "cada configField es un objeto");
          return;
        }
        for (const req of ["key", "label", "type", "required"]) {
          if (field[req] === undefined) err(`configFields[${i}].${req}`, "campo requerido ausente");
        }
        if (field.key !== undefined && (typeof field.key !== "string" || !CONFIG_KEY_RE.test(field.key))) {
          err(`configFields[${i}].key`, "identificador alfanumérico (^[a-zA-Z][a-zA-Z0-9_]*$)");
        }
        if (field.label !== undefined && (typeof field.label !== "string" || field.label.length < 1)) {
          err(`configFields[${i}].label`, "string no vacío");
        }
        if (
          field.type !== undefined &&
          !(CONFIG_FIELD_TYPES as readonly string[]).includes(field.type as string)
        ) {
          err(`configFields[${i}].type`, `debe ser uno de: ${CONFIG_FIELD_TYPES.join(", ")}`);
        }
        if (field.required !== undefined && typeof field.required !== "boolean") {
          err(`configFields[${i}].required`, "boolean");
        }
      });
    }
  }

  // dependencies
  if (m.dependencies !== undefined) {
    validateStringArray(m.dependencies, "dependencies", err, {
      validItem: (item) => typeof item === "string" && ID_RE.test(item),
      arrayMessage: "debe ser un array de ids de módulos core",
      itemMessage: "id de módulo inválido (^[a-z][a-z0-9-]{2,38}$)",
    });
  }

  // pricing
  let pricingModel: string | undefined;
  if (m.pricing !== undefined) {
    if (!isPlainObject(m.pricing)) {
      err("pricing", "objeto { model, tokensPerMonth, trialDays? }");
    } else {
      const p = m.pricing;
      if (p.model === undefined) err("pricing.model", "campo requerido ausente");
      else if (!(PRICING_MODELS as readonly string[]).includes(p.model as string)) {
        err("pricing.model", `debe ser uno de: ${PRICING_MODELS.join(", ")}`);
      } else {
        pricingModel = p.model as string;
      }
      if (p.tokensPerMonth === undefined) err("pricing.tokensPerMonth", "campo requerido ausente");
      else if (!isInt(p.tokensPerMonth) || (p.tokensPerMonth as number) < 0) {
        err("pricing.tokensPerMonth", "entero ≥ 0");
      }
      if (p.trialDays !== undefined && (!isInt(p.trialDays) || (p.trialDays as number) < 0 || (p.trialDays as number) > 90)) {
        err("pricing.trialDays", "entero entre 0 y 90");
      }
      for (const key of Object.keys(p)) {
        if (!["model", "tokensPerMonth", "trialDays"].includes(key)) {
          warn(`pricing.${key}`, "propiedad desconocida en pricing");
        }
      }
    }
  }

  // entry
  let hasFrontendEntry = false;
  if (m.entry !== undefined) {
    if (!isPlainObject(m.entry)) {
      err("entry", "objeto { backend, frontend? }");
    } else {
      const e = m.entry;
      if (e.backend === undefined) {
        err("entry.backend", "campo requerido ausente");
      } else if (typeof e.backend !== "string" || !ENTRY_BACKEND_RE.test(e.backend)) {
        err("entry.backend", "ruta backend/<...>.(js|mjs|ts) relativa a modules/<id>/");
      } else if (hasUnsafePathSegments(e.backend)) {
        // El loader resuelve e importa este path: '..' escaparía de modules/<id>/.
        err("entry.backend", "no puede contener segmentos '..', '.' ni vacíos (path traversal)");
      } else if (e.backend.endsWith(".ts")) {
        // El loader importa JS en producción: un entry .ts no carga sin build.
        warn("entry.backend", "entry .ts: el loader importa JS en producción — compila a .js antes de enviar/preview");
      }
      if (e.frontend !== undefined) {
        if (
          typeof e.frontend !== "string" ||
          !ENTRY_FRONTEND_RE.test(e.frontend) ||
          e.frontend.includes("..") ||
          e.frontend.split("/").some((seg) => seg === ".")
        ) {
          err("entry.frontend", "directorio frontend[/...] relativo a modules/<id>/ (sin '..')");
        } else {
          hasFrontendEntry = true;
        }
      }
      for (const key of Object.keys(e)) {
        if (!["backend", "frontend"].includes(key)) warn(`entry.${key}`, "propiedad desconocida en entry");
      }
    }
  }

  // ── Condicionales (allOf del schema) ──────────────────────────────────────

  // http → http_allowlist con ≥1 entrada
  if (caps.has("http")) {
    const allow = m.http_allowlist;
    if (!Array.isArray(allow) || allow.length < 1) {
      err("http_allowlist", 'la capability "http" exige http_allowlist con al menos 1 host');
    }
  }

  // server.sudo → server.exec | server.fs.write
  if (caps.has("server.sudo") && !caps.has("server.exec") && !caps.has("server.fs.write")) {
    err("capabilities", '"server.sudo" requiere también "server.exec" o "server.fs.write"');
  }

  // pricing free → tokensPerMonth = 0
  if (pricingModel === "free" && isInt((m.pricing as Record<string, unknown>)?.tokensPerMonth)) {
    if (((m.pricing as Record<string, unknown>).tokensPerMonth as number) !== 0) {
      err("pricing.tokensPerMonth", 'un módulo "free" debe tener tokensPerMonth = 0');
    }
  }

  // surface.sidebar|views → entry.frontend
  if (surfaceHasSidebarOrViews && !hasFrontendEntry) {
    err("entry.frontend", "surface.sidebar/views declarados exigen entry.frontend que los respalde");
  }

  return { valid: errors.length === 0, errors, warnings };
}
