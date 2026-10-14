// Files page — perm-gating submodule (code-move from index-script1.ts; no behavior change).
import { t } from "./i18n";
import { S } from "./state";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

  let policyRequest: Promise<void> | null = null;
  let policyRequestScope = "";
  let policyVersion = 0;

  export function invalidateFileAccessPolicy(): void {
    policyVersion++;
    policyRequest = null;
    policyRequestScope = "";
    S.fileAccessPolicyLoaded = false;
  }

  /** Load the caller's effective file-access policy once (allowAll +
   *  defaultPath). Drives where the module opens and the denied-path fallback. */
  export async function ensureFileAccessPolicy(): Promise<void> {
    if (S.fileAccessPolicyLoaded) return;
    const scope = S.activeTargetScope || "local";
    if (policyRequest && policyRequestScope === scope) return policyRequest;
    const version = policyVersion;
    const pending = (async () => {
      try {
        const pol = await api.get<any>("/api/files/allowed-bases");
        // Tolerate either an unwrapped payload or a {data:{…}} envelope.
        const d: any = (pol.data && (pol.data as any).defaultPath !== undefined) ? pol.data : ((pol.data as any)?.data ?? pol.data);
        if (pol.ok && d && version === policyVersion && scope === (S.activeTargetScope || "local")) {
          S.filesAllowAll = Boolean(d.allowAll);
          S.filesAllowPaths = Array.isArray(d.allowPaths)
            ? d.allowPaths.map((p: unknown) => String(p).replace(/\/+$/, "") || "/")
            : [];
          const dp = d.defaultPath;
          S.filesDefaultBase = typeof dp === "string" && dp.trim() ? dp.trim() : "/";
          if (Array.isArray(d.actions)) S.filesActions = new Set<string>(d.actions);
        }
      } catch { /* keep the current policy until the next scope change */ }
      finally {
        if (version === policyVersion && scope === (S.activeTargetScope || "local")) S.fileAccessPolicyLoaded = true;
      }
    })().finally(() => { if (policyRequest === pending) policyRequest = null; });
    policyRequestScope = scope;
    policyRequest = pending;
    return pending;
  }

  /** True if the user has a file action permission (permissive until loaded). */
  export function filesCan(action: string): boolean {
    return S.filesActions === null || S.filesActions.has(action);
  }

  // Absolute system directories the backend's path policy ALWAYS denies (403),
  // regardless of the caller (including allowAll/admin). Requesting dir-size for
  // these only produces already-handled 403s that flood the console, so we never
  // emit the request. Matched by exact absolute path OR as a parent prefix
  // (`<dir>/…`). Keep paths normalized (no trailing slash).
  export const ALWAYS_DENIED_SYSTEM_PATHS = new Set<string>([
    "/proc", "/sys", "/dev", "/run", "/boot", "/tmp", "/root",
    "/usr", "/srv", "/mnt", "/media", "/lost+found",
  ]);

  /** True when `rawPath` is (or lives under) a system dir the backend always
   *  403s — so we skip its dir-size request entirely, even with allowAll. */
  export function isAlwaysDeniedSystemPath(rawPath: string): boolean {
    const path = (rawPath.startsWith("/") ? rawPath : `/${rawPath}`).replace(/\/+$/, "") || "/";
    if (ALWAYS_DENIED_SYSTEM_PATHS.has(path)) return true;
    for (const denied of ALWAYS_DENIED_SYSTEM_PATHS) {
      if (path.startsWith(`${denied}/`)) return true;
    }
    return false;
  }

  /** Client-side mirror of the backend `canAccessPath(read)` scope check. Used
   *  only to skip dir-size requests the backend would 403; the backend remains
   *  the real authority. Conservative: when allowAll, everything passes (deny/
   *  config-dir denials are rare and still handled gracefully on 403). */
  export function canReadPathClient(rawPath: string): boolean {
    if (S.filesAllowAll) return true;
    const path = (rawPath.startsWith("/") ? rawPath : `/${rawPath}`).replace(/\/+$/, "") || "/";
    return S.filesAllowPaths.some((rule) => rule === "/" || path === rule || path.startsWith(`${rule}/`));
  }

  // Permission → button ids it controls. Desktop inline buttons end with `-d`;
  // the actions-menu variants don't — both listed.
  export const FILE_BTN_GROUPS: Array<[string, string[]]> = [
    ["files.write", ["btn-new-file", "btn-new-file-d", "btn-save", "btn-search-replace"]],
    ["files.create", ["btn-mkdir", "btn-mkdir-d"]],
    ["files.upload", ["btn-upload", "btn-upload-d"]],
    ["files.git", ["btn-git", "btn-git-d"]],
    ["files.compare", ["btn-compare", "btn-compare-d"]],
    ["files.history", ["btn-history", "btn-history-d"]],
    ["files.security", ["btn-exposure", "btn-exposure-d", "btn-malware", "btn-malware-d"]],
    ["files.projects", ["btn-project-map", "btn-project-map-d", "btn-projects-d", "btn-view-projects", "btn-scan-projects", "btn-projects-rescan", "btn-projects-scan-cta"]],
    ["files.copypath", ["btn-copy-path"]],
    ["files.tabs", ["btn-new-files-manager-tab"]],
    ["files.config", ["files-settings-modal-trigger"]],
    ["files.search", ["files-search-box"]],
    ["files.hidden", ["btn-toggle-hidden"]],
  ];
  export const FILE_COLS = ["type", "size", "owner", "group", "modified", "perms"];

  /** Inject (once) the CSS that hides buttons/columns flagged via body classes.
   *  We gate via CSS on <body> (NOT by toggling the elements' own class) because
   *  the toolbar/header are React-rendered and React reconciliation would wipe a
   *  `hidden` class we set imperatively on every re-render. <head> CSS + body
   *  classes are outside React's control, so the gating sticks. */
  export function ensureFilesPermStyle(): void {
    if (document.getElementById("lxp-files-perm-style")) return;
    const rules: string[] = [];
    for (const [perm, ids] of FILE_BTN_GROUPS) {
      const slug = perm.replace(/\./g, "-");
      rules.push(`${ids.map((id) => `body.fno-${slug} #${id}`).join(",")}{display:none !important;}`);
    }
    for (const c of FILE_COLS) rules.push(`body.fhide-${c} .fcol-${c}{display:none !important;}`);
    // When the user has NONE of the actions-menu actions, hide the trigger so we
    // never pop an empty menu box.
    rules.push(`body.fno-files-actions #btn-files-actions-menu-trigger{display:none !important;}`);
    // Open-files quick-access button: greyed-out + non-clickable until at least
    // one file is open (toggled via the `files-has-open` body class, robust to
    // React re-renders of the toolbar).
    rules.push(`body:not(.files-has-open) #btn-open-files{opacity:.4 !important;pointer-events:none !important;}`);
    const st = document.createElement("style");
    st.id = "lxp-files-perm-style";
    st.textContent = rules.join("");
    document.head.appendChild(st);
  }

  /** Actions that live in the toolbar actions menu / inline group. */
  export const FILE_MENU_ACTIONS = ["files.write", "files.create", "files.upload", "files.search", "files.git", "files.compare", "files.history", "files.security", "files.projects"];

  /** Toggle the body gating classes from the user's effective file permissions.
   *  Runs on every entry; CSS keeps elements hidden across React re-renders. */
  export function applyFilePermGating(): void {
    ensureFilesPermStyle();
    const seen = new Set<string>();
    for (const [perm] of FILE_BTN_GROUPS) {
      if (seen.has(perm)) continue;
      seen.add(perm);
      document.body.classList.toggle(`fno-${perm.replace(/\./g, "-")}`, !filesCan(perm));
    }
    for (const c of FILE_COLS) document.body.classList.toggle(`fhide-${c}`, !filesCan(`files.col.${c}`));
    // Hide the actions-menu trigger when the user can't use any of its actions.
    document.body.classList.toggle("fno-files-actions", !FILE_MENU_ACTIONS.some((a) => filesCan(a)));
  }
