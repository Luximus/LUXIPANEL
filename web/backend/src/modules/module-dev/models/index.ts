/**
 * Modelos del módulo module-dev ("Mis módulos" del marketplace).
 */

/** Un problema concreto del manifest (ruta JSON + mensaje). */
export interface ManifestIssue {
  path: string;
  message: string;
}

/** Resultado del validador puro de module.manifest.json. */
export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestIssue[];
  warnings: ManifestIssue[];
}

/** Resultado del runner de tests sobre el servidor target. */
export interface TestRunResult {
  /** Comando efectivo ejecutado (sin envolver en sh -lc). */
  command: string;
  /** Exit code del proceso; null si se mató por timeout sin código. */
  exitCode: number | null;
  passed: boolean;
  timedOut: boolean;
  durationMs: number;
  /** Salida capada a MODULE_DEV_TEST_MAX_OUTPUT_KB. */
  stdout: string;
  stderr: string;
}

/** Resultado de los checks estáticos (no ejecuta nada). */
export interface ChecksRunResult {
  moduleId: string;
  manifestFound: boolean;
  validation: ManifestValidationResult;
  entryExists: boolean;
  notes: string[];
}

/** Resultado de una instalación preview (Modo B). */
export interface PreviewInstallResult {
  moduleId: string;
  /** Nº de archivos vendorizados. */
  files: number;
  /** Bytes totales copiados. */
  bytes: number;
  /** true si el loader llegó a registrar las tools tras el reload. */
  loaded: boolean;
  warnings: string[];
}

/** Lectura proxied a LP con semántica de caché de instancia. */
export interface CachedRead<T> {
  data: T;
  /** true cuando LP no respondió y se sirvió la última copia buena. */
  stale: boolean;
  /** ISO de cuándo se obtuvo `data` de LP (null si nunca). */
  fetchedAt: string | null;
}
