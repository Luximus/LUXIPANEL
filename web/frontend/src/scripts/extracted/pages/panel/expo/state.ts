// Expo page — shared module-level state hub.
// LEAF module: imports NOTHING from the other expo submodules, so every submodule
// can import it without cycles. Cross-submodule reassignable state lives on the
// exported object `S` (importers read a live `S.foo`; the owner writes `S.foo = …`).
// Shared types, the DataTable ids and pure config constants also live here.

// ── Types (mirror backend models in src/modules/expo/models) ──────────────────
export interface ExpoConfig {
  tokenSet: boolean;
  tokenPreview: string;
}
// GET /api/expo/account → GraphQL viewer (validates the token without needing a
// project on the server). `username` present ⇒ the token is valid / connected.
export interface ExpoAccount {
  username: string;
  accounts: string[];
}
export interface ExpoQuota {
  planName: string | null;
  concurrencies: number | string | null;
  remainingBuilds: number | string | null;
  usedBuilds: number | string | null;
  buildsThisMonth: number | string | null;
}
export interface ExpoProject {
  /** Absolute path of the project on the connected server (the row key). */
  path: string;
  name: string;
  slug: string | null;
  /** EAS projectId; null until the project is linked. */
  projectId: string | null;
  androidPackage: string | null;
  iosBundleIdentifier: string | null;
  runtime?: { expoInstalled: boolean; ngrokInstalled: boolean };
}
export interface ExpoInstallStatus {
  status: "running" | "done" | "error";
  done: boolean;
  ok: boolean;
  log: string;
  message: string;
}
export interface ExpoBuild {
  id: string;
  status: string;
  platform: string;
  profile: string | null;
  createdAt?: string | null;
  url?: string | null;
  artifactUrl?: string | null;
  appVersion?: string | null;
  appName?: string | null;
  appSlug?: string | null;
}
export interface ExpoEnvVar {
  id?: string | null;
  name: string;
  value?: string | null;
  scope: string;
  visibility: string;
  environments?: string[];
}
export interface ExpoStoreCredentials {
  google: {
    cloudKeys: Array<{ clientEmail: string | null; projectIdentifier: string | null; updatedAt: string | null }>;
    projectFile: { path: string; clientEmail: string | null } | null;
    localFile: boolean;
  };
  apple: {
    cloudKeys: Array<{ keyIdentifier: string | null; issuerIdentifier: string | null; name: string | null; updatedAt: string | null }>;
    projectFile: { path: string; keyId: string | null; issuerId: string | null } | null;
    localFile: boolean;
  };
}
/** One flattened row in the unified store-accounts table. */
export interface StoreRow {
  platform: string; // "Google Play" | "App Store Connect"
  source: string; // "EAS" | "Proyecto" | "Panel"
  sourceTone: string; // tailwind classes for the source badge
  detail: string; // email / key·issuer / filename
  updatedAt: string | null;
}
// POST /api/expo/dev-client → install-page URL of the latest dev build (QR rendered client-side)
export interface DevClientResult {
  url: string | null;
  artifactUrl?: string | null;
  buildId?: string | null;
  platform?: string | null;
  profile?: string | null;
  status?: string | null;
  createdAt?: string | null;
  qr?: string | null;
  raw?: string;
  messageCode?: string | null;
  detail?: string;
}
export interface DevClientStatus { status: "running" | "starting" | "stopped"; url: string | null }

// POST /api/expo/build-logs → readable logs + structured failure for one build
export interface ExpoBuildLogLine {
  phase: string | null;
  level: number | null;
  msg: string;
  time: string | null;
}
export interface ExpoBuildLogs {
  buildId: string;
  status: string;
  error: { errorCode: string | null; message: string | null; docsUrl: string | null } | null;
  lines: ExpoBuildLogLine[];
  truncated: boolean;
}
/** Build statuses that can still be cancelled. */
export const CANCELLABLE_STATUSES = new Set(["new", "in-queue", "in-progress"]);
export const BUILD_STATUS_TONE: Record<string, string> = {
  finished: "bg-emerald-500/10 text-emerald-500",
  errored: "bg-destructive/10 text-destructive",
  canceled: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  "in-progress": "bg-amber-500/10 text-amber-500",
  "in-queue": "bg-amber-500/10 text-amber-500",
  "new": "bg-sky-500/10 text-sky-500",
};
/** Client-side pagination page size (builds / env vars / store accounts). */
export const PAGE_SIZE = 10;
export const EXPO_BUILDS_TABLE_ID = "expo-builds-table";
export const EXPO_STORE_TABLE_ID = "expo-store-table";
export const EXPO_ENV_TABLE_ID = "expo-env-table";
export const S = {
  targetGeneration: 0,
  tokenSet: false,
  tokenPreview: "",
  account: null as ExpoAccount | null,
  projects: [] as ExpoProject[],
  installingPath: null as string | null,
  installErrorPath: null as string | null,
  installLog: "",
  // Per-project panels (builds / env / quota fallback / store creds) are scoped
  // to this project — every EAS operation needs an absolute project path.
  currentProject: null as ExpoProject | null,
  builds: [] as ExpoBuild[],
  buildsFiltered: [] as ExpoBuild[],
  buildsPage: 0,
  buildFilters: { status: "", platform: "", profile: "", from: "", to: "" },
  envVars: [] as ExpoEnvVar[],
  envFiltered: [] as ExpoEnvVar[],
  envVarsPage: 0,
  envFilters: { text: "", scope: "", visibility: "", environment: "" },
  editingEnvId: null as string | null,
  storeRows: [] as StoreRow[],
  storePage: 0,
  buildProject: null as ExpoProject | null,
  buildProfile: "development" as "development" | "production",
  devTestProject: null as ExpoProject | null,
  devSessions: new Map<string, DevClientStatus>(),
  devPending: new Set<string>(),
  devRevision: new Map<string, number>(),
  otaProject: null as ExpoProject | null,
  googleJsonContent: null as string | null,
  appleP8Content: null as string | null,
  // Build-log viewer (history table).
  logsBuild: null as ExpoBuild | null,
  logsData: null as ExpoBuildLogs | null,
  logsSearch: "",
  logsErrorsOnly: false,
};
