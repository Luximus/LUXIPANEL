import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Application from "expo-application";
import { ENV } from "../config/env";
import { loadSessionState } from "../lib/session-state";
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
  required: boolean;
  currentVersion: string | null;
  platform: "android" | "ios" | null;
  info: UpdateInfo | null;
  received: number;
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

function readPackageVersion(): string {
  return Application.nativeApplicationVersion ?? "0.0.0";
}

function readPlatform(): "android" | "ios" {
  return Platform.OS === "ios" ? "ios" : "android";
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

  const checkNow = useCallback(async () => {
    setState((current) => ({ ...current, phase: "checking", error: null }));
    try {
      const version = readPackageVersion();
      const platform = readPlatform();
      const lang = normalizeLocale(loadSessionState().language);
      const url = `${ENV.apiUrl}/public/app/latest-version?platform=${encodeURIComponent(platform)}&lang=${encodeURIComponent(lang)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      if (!res.ok) {
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

  useEffect(() => {
    void checkNow();
    const id = setInterval(() => void checkNow(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkNow]);

  const startUpdate = useCallback(async () => {
    if (!state.info) return;
    setState((current) => ({ ...current, phase: "downloading" }));
    try {
      // On mobile, "update" means redirect to the store / hosted APK URL.
      await Linking.openURL(state.info.artifact.url);
      setState((current) => ({ ...current, phase: "installing" }));
    } catch (error) {
      setState((current) => ({
        ...current,
        phase: "error",
        error: error instanceof Error ? error.message : getMessages(loadSessionState().language).update.errorOpenFailed,
      }));
    }
  }, [state.info]);

  return { state, checkNow, startUpdate };
}
