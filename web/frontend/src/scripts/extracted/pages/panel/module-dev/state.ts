// Module-dev page — shared module-level state hub + row/lookup helpers + the
// DataTable id. LEAF module: imports NOTHING from the other module-dev submodules,
// so every submodule can import it without cycles. Cross-submodule reassignable
// state lives on the exported `state` object (importers read live `state.foo`;
// the owner writes `state.foo = …`).

// ── Types (espejo del contrato §2 — backend modules/module-dev) ──────────────
export type ReviewStatus = "enviado" | "revision" | "correccion" | "suspendido" | "inactivo" | "publico";

export interface DevModuleSummary {
  id: string;
  code: string;
  name: string;
  reviewStatus: ReviewStatus;
  status: string;
  scope: string;
  version: string | null;
  prUrl?: string | null;
  updatedAt: string;
}
export interface DevModulesPayload {
  modules: DevModuleSummary[];
  stale: boolean;
  fetchedAt: string | null;
  marketplaceAvailable?: boolean;
}
export interface DevModuleReviews {
  module: { code: string; reviewStatus: ReviewStatus };
  versions: unknown[];
  events: unknown[];
  stale: boolean;
  fetchedAt: string | null;
}
export interface MarketplaceLink {
  id?: string;
  projectId: string;
  moduleId: string;
  projectPath: string;
  provider: "claude" | "codex" | "gemini";
  reviewStatus?: ReviewStatus | string;
  createdAt?: string;
  updatedAt?: string;
}
export interface PreviewMeta {
  moduleId: string;
  ownerUserId: string;
  ownerUsername?: string;
  projectId?: string;
  installedAt: string;
}
export interface ManifestValidationIssue {
  path: string;
  message: string;
}
export interface ManifestValidationResult {
  valid: boolean;
  errors: ManifestValidationIssue[];
  warnings: ManifestValidationIssue[];
}
export interface ChecksRunResult {
  moduleId: string;
  manifestFound: boolean;
  validation: ManifestValidationResult;
  entryExists: boolean;
  notes: string[];
}
export interface TestRunResult {
  command: string;
  exitCode: number | null;
  passed: boolean;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}
export interface PreviewInstallResult {
  moduleId: string;
  files: number;
  bytes: number;
  loaded: boolean;
  warnings: string[];
}

export const state = {
  modules: [] as DevModuleSummary[],
  links: [] as MarketplaceLink[],
  previews: [] as PreviewMeta[],
  stale: false,
  marketplaceAvailable: true,
  fetchedAt: null as string | null,
  // Diálogo PR (submit/resubmit) y confirmación (unpublish/republish)
  prMode: "submit" as "submit" | "resubmit",
  prCode: "",
  confirmMode: "unpublish" as "unpublish" | "republish",
  confirmCode: "",
};

export function linkForModule(code: string): MarketplaceLink | null {
  return state.links.find((l) => l.moduleId === code) ?? null;
}

export function moduleForCode(code: string): DevModuleSummary | null {
  return state.modules.find((m) => m.code === code) ?? null;
}

export const MODULES_TABLE_ID = "module-dev-table";
