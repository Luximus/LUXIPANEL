import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { publishChatPreferences } from "./chat-activity";
import { userRequest } from "../api/serverUserApi";
export type ChatPreferences = Record<
  string,
  Record<string, string | boolean | number>
>;
export const CHAT_DEFAULTS: ChatPreferences = {
  general: {
    soundOnNewMessage: true,
    desktopNotifications: false,
    previewInBell: true,
    enterSends: true,
  },
  appearance: { density: "comfortable", fontSize: "md" },
  groups: { collapsedByDefault: true, latestPageSize: 5 },
  calls: {
    language: "es",
    translate: false,
    provider: "auto",
    micDefault: "on",
    ringtone: "default",
    dnd: false,
  },
};
export const PREFERENCE_CHOICES: Record<string, string[]> = {
  density: ["comfortable", "compact"],
  fontSize: ["sm", "md", "lg"],
  latestPageSize: ["5", "10", "15"],
  provider: ["auto", "elevenlabs", "openai-realtime"],
  micDefault: ["on", "muted"],
  ringtone: ["default", "off"],
};
export const PANEL_LANGUAGES = [
  "es",
  "en",
  "pt",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "ru",
  "ar",
  "hi",
  "bn",
];
export function useServerPreferences(serverId: string, visible: boolean) {
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [displayName, setDisplayName] = useState(""),
    [phone, setPhone] = useState(""),
    [username, setUsername] = useState(""),
    [ui, setUi] = useState({ theme: "system", language: "es" });
  const [chat, setChat] = useState<ChatPreferences>(CHAT_DEFAULTS),
    [presence, setPresence] = useState({ showOnline: true, statusMessage: "" });
  const [totp, setTotp] = useState({ enabled: false, configured: false }),
    [setup, setSetup] = useState<{ secret: string; qrUri: string } | null>(
      null,
    ),
    [code, setCode] = useState(""),
    [passkeys, setPasskeys] = useState<
      Array<{ id: string; label: string; createdAt: string }>
    >([]),
    [recovery, setRecovery] = useState(false),
    [codes, setCodes] = useState<string[]>([]),
    [audit, setAudit] = useState<
      Array<{ id: string; eventType: string; createdAt: string }>
    >([]);
  const [enrollment, setEnrollment] = useState<{
    id: string;
    expiresAt: number;
  } | null>(null);
  const request = useCallback(
    <T>(
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      path: string,
      body?: unknown,
    ) => userRequest<T>(serverId, method, path, body),
    [serverId],
  );
  const refreshSecurity = useCallback(async () => {
    const results = await Promise.allSettled([
      request<typeof totp>("GET", "/api/auth/totp/status"),
      request<typeof passkeys>("GET", "/api/auth/passkeys"),
      request<{ hasActiveCodes: boolean }>("GET", "/api/auth/recovery/status"),
      request<typeof audit>("GET", "/api/preferences/audit-log"),
    ]);
    if (results[0].status === "fulfilled") setTotp(results[0].value);
    if (results[1].status === "fulfilled") setPasskeys(results[1].value);
    if (results[2].status === "fulfilled")
      setRecovery(results[2].value.hasActiveCodes);
    if (results[3].status === "fulfilled") setAudit(results[3].value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected")
      setError(
        failed.reason instanceof Error ? failed.reason.message : "Error",
      );
  }, [request]);
  useEffect(() => {
    if (!visible || loaded) return;
    let alive = true;
    void Promise.all([
      request<{
        username: string;
        displayName: string;
        phoneE164: string | null;
      }>("GET", "/api/preferences"),
      request<typeof ui>("GET", "/api/preferences/ui"),
      request<ChatPreferences>("GET", "/api/preferences/chat"),
      request<typeof presence>("GET", "/api/chat/me/profile"),
    ])
      .then(([profile, uiValue, chatValue, presenceValue]) => {
        if (!alive) return;
        setDisplayName(profile.displayName);
        setUsername(profile.username);
        setPhone(profile.phoneE164 ?? "");
        setUi({ theme: uiValue.theme, language: uiValue.language ?? "es" });
        setChat(chatValue);
        setPresence({
          showOnline: presenceValue.showOnline,
          statusMessage: presenceValue.statusMessage ?? "",
        });
        setLoaded(true);
        void refreshSecurity();
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Error");
      });
    return () => {
      alive = false;
    };
  }, [visible, loaded, request, refreshSecurity]);
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice("✓");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!enrollment || !visible) return;
    let alive = true;
    const check = async () => {
      if (enrollment.expiresAt < Date.now()) {
        setEnrollment(null);
        return;
      }
      try {
        const result = await request<{ status: string }>(
          "GET",
          `/api/auth/passkeys/enrollment/${encodeURIComponent(enrollment.id)}`,
        );
        if (!alive) return;
        if (result.status === "complete") {
          setEnrollment(null);
          await refreshSecurity();
          setNotice("✓");
        } else if (result.status === "failed") {
          setEnrollment(null);
          setError("Passkey registration failed.");
        }
      } catch (err) {
        if (alive) {
          setEnrollment(null);
          setError(err instanceof Error ? err.message : "Error");
        }
      }
    };
    void check();
    const timer = setInterval(() => void check(), 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enrollment, visible, request, refreshSecurity]);
  const saveProfile = () =>
    perform(() =>
      request("PUT", "/api/preferences", {
        displayName,
        phoneE164: phone.trim() || null,
      }),
    );
  const saveUi = () => perform(() => request("PUT", "/api/preferences/ui", ui));
  const saveChat = () =>
    perform(async () => {
      if (chat.general?.desktopNotifications) {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.status !== "granted") await Notifications.requestPermissionsAsync();
      }
      await request("PUT", "/api/preferences/chat", chat);
      await request("PUT", "/api/chat/me/profile", presence);
      publishChatPreferences(serverId, chat);
    });
  const setupTotp = () =>
    perform(async () => {
      setSetup(await request("GET", "/api/auth/totp/setup"));
    });
  const enableTotp = () =>
    perform(async () => {
      await request("POST", "/api/auth/totp/enable", { code });
      setSetup(null);
      setCode("");
      await refreshSecurity();
    });
  const disableTotp = () =>
    perform(async () => {
      await request("PATCH", "/api/auth/totp/disable");
      await refreshSecurity();
    });
  const revoke = (id: string) =>
    perform(async () => {
      await request("DELETE", `/api/auth/passkeys/${encodeURIComponent(id)}`);
      await refreshSecurity();
    });
  const regenerate = () =>
    perform(async () => {
      const result = await request<{ codes: string[] }>(
        "POST",
        "/api/auth/recovery/generate",
      );
      setCodes(result.codes);
      setRecovery(true);
    });
  const register = (open: (url: string) => Promise<unknown>, label: string) =>
    perform(async () => {
      const grant = await request<{ id: string; url: string }>(
        "POST",
        "/api/auth/passkeys/enrollment",
        { label, language: ui.language },
      );
      setEnrollment({ id: grant.id, expiresAt: Date.now() + 300000 });
      await open(grant.url);
    });
  return {
    loaded,
    busy,
    error,
    notice,
    displayName,
    setDisplayName,
    phone,
    setPhone,
    username,
    ui,
    setUi,
    chat,
    setChat,
    presence,
    setPresence,
    totp,
    setup,
    setSetup,
    code,
    setCode,
    passkeys,
    recovery,
    codes,
    setCodes,
    audit,
    enrollment,
    saveProfile,
    saveUi,
    saveChat,
    setupTotp,
    enableTotp,
    disableTotp,
    revoke,
    regenerate,
    register,
    refreshSecurity,
  };
}

export function preferenceChoiceLabel(
  section: string,
  key: string,
  value: string,
  t: (path: string, fallback?: string) => string,
): string {
  const choices: Record<string, Record<string, string>> = {
    density: { comfortable: "densityComfortable", compact: "densityCompact" },
    fontSize: { sm: "fontSm", md: "fontMd", lg: "fontLg" },
    provider: {
      auto: "providerAuto",
      elevenlabs: "providerElevenlabs",
      "openai-realtime": "providerOpenai",
    },
    micDefault: { on: "micOn", muted: "micMuted" },
    ringtone: { default: "ringtoneDefault", off: "ringtoneOff" },
  };
  const label = choices[key]?.[value];
  return label ? t(`chat.settings.${section}.${label}`, value) : value;
}
export const PANEL_LANGUAGE_NAMES: Record<string, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  ar: "العربية",
  hi: "हिन्दी",
  bn: "বাংলা",
};
