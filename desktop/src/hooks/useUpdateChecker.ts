import { useCallback, useEffect, useRef, useState } from "react";
import { ENV } from "../config/env";
import { loadSessionState } from "../lib/session-state";
import { emitRateLimited, parseRetryAfterSeconds } from "../lib/rate-limit-notice";
import { getMessages, normalizeLocale } from "../i18n";

export type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "error";

export type UpdateArtifact = {
  url: string;
  sizeBytes: number | null;
  sha256: string | null;
};

export type UpdateInfo = {
  version: string;
  releaseNotes: string;
  releasedAt: string | null;
  artifact: UpdateArtifact;
};

export type UpdateState = {
  phase: UpdatePhase;
  /** True when a new version is available and the user MUST update. */
  required: boolean;
  currentVersion: string | null;
  platform: "windows" | "mac" | "linux" | null;
  info: UpdateInfo | null;
  /** Bytes received during download. */
  received: number;
  /** Total bytes for current download (0 = unknown). */
  total: number;
  error: string | null;
};

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/i, "").split(/[.\-+]/).map((p) => Number.parseInt(p, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

async function readPackageVersion(): Promise<string> {
  // In Electron we ask the main process; in dev/web fall back to a hardcoded "0.0.0".
  const api = window.electronApi;
  if (api?.getAppVersion) {
    try { return await api.getAppVersion(); } catch { /* ignore */ }
  }
  return "0.0.0";
}

async function readPlatform(): Promise<"windows" | "mac" | "linux"> {
  const api = window.electronApi;
  if (api?.getAppPlatform) {
    try { return await api.getAppPlatform(); } catch { /* ignore */ }
  }
  // Best-effort fallback for non-Electron contexts.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    phase: "idle",
    required: false,
    currentVersion: null,
    platform: null,
    info: null,
    received: 0,
    total: 0,
    error: null,
  });

  const downloadedPathRef = useRef<string | null>(null);

  const checkNow = useCallback(async () => {
    setState((current) => ({ ...current, phase: "checking", error: null }));
    try {
      const [version, platform] = await Promise.all([readPackageVersion(), readPlatform()]);
      const lang = normalizeLocale(loadSessionState().language);
      const url = `${ENV.apiUrl}/public/desktop/latest-version?platform=${encodeURIComponent(platform)}&lang=${encodeURIComponent(lang)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) {
        // 429 = el backend está limitando peticiones: avisa al modal global con
        // el tiempo de reintento (no es un error de update, así que abajo se
        // degrada a "sin actualización" sin marcar phase: "error").
        if (res.status === 429) {
          let retryBody: unknown = null;
          try { retryBody = await res.clone().json(); } catch { /* body no-JSON */ }
          emitRateLimited(parseRetryAfterSeconds(retryBody, res.headers.get("Retry-After")));
        }
        // 404 = no release published for this platform → treat as no update needed.
        setState((current) => ({
          ...current,
          phase: "idle",
          currentVersion: version,
          platform,
          required: false,
          info: null,
        }));
        return;
      }
      const body = await res.json() as {
        ok: boolean;
        version?: string;
        releaseNotes?: string;
        releasedAt?: string;
        artifact?: { url: string; sizeBytes: number | null; sha256: string | null };
      };

      if (!body.ok || !body.version || !body.artifact?.url) {
        setState((current) => ({
          ...current,
          phase: "idle",
          currentVersion: version,
          platform,
          required: false,
        }));
        return;
      }

      const required = compareSemver(body.version, version) > 0;
      setState((current) => ({
        ...current,
        phase: required ? "available" : "idle",
        currentVersion: version,
        platform,
        required,
        info: required
          ? {
              version: body.version!,
              releaseNotes: body.releaseNotes ?? "",
              releasedAt: body.releasedAt ?? null,
              artifact: body.artifact!,
            }
          : null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        error: error instanceof Error ? error.message : getMessages(loadSessionState().language).update.errorCheckFailed,
      }));
    }
  }, []);

  // Initial + periodic check.
  useEffect(() => {
    void checkNow();
    const id = window.setInterval(() => void checkNow(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [checkNow]);

  // Subscribe to download progress (Electron only).
  useEffect(() => {
    const api = window.electronApi;
    if (!api?.onUpdateProgress) return;
    const off = api.onUpdateProgress(({ received, total }) => {
      setState((current) => ({ ...current, received, total }));
    });
    return () => off();
  }, []);

  const startUpdate = useCallback(async () => {
    const api = window.electronApi;
    if (!api?.downloadUpdate || !api?.installUpdate) {
      setState((current) => ({ ...current, phase: "error", error: getMessages(loadSessionState().language).update.errorCannotUpdateHere }));
      return;
    }
    if (!state.info) return;

    setState((current) => ({ ...current, phase: "downloading", received: 0, total: state.info?.artifact.sizeBytes ?? 0, error: null }));
    const { artifact, version } = state.info;
    const ext = (() => {
      try { return new URL(artifact.url).pathname.split("/").pop() ?? "update"; }
      catch { return "update"; }
    })();
    const suggestedName = `luxipanel-${version}-${ext}`;

    const result = await api.downloadUpdate({
      url: artifact.url,
      sha256: artifact.sha256,
      suggestedName,
    });

    if (!result.ok) {
      setState((current) => ({ ...current, phase: "error", error: result.error }));
      return;
    }

    downloadedPathRef.current = result.path;
    setState((current) => ({ ...current, phase: "installing" }));

    const installRes = await api.installUpdate({ path: result.path });
    if (!installRes.ok) {
      setState((current) => ({ ...current, phase: "error", error: installRes.error }));
    }
    // On success the app will quit shortly; nothing else to do.
  }, [state.info]);

  return { state, checkNow, startUpdate };
}
