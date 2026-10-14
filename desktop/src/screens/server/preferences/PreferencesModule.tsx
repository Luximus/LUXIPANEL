import { useEffect, useState } from "react";
import type { ModuleProps } from "../module-host";
import { useNativeModuleVisible } from "../module-visibility";
import {
  useServerPreferences,
  PANEL_LANGUAGES,
  PREFERENCE_CHOICES,
  preferenceChoiceLabel,
  PANEL_LANGUAGE_NAMES,
} from "../../../lib/use-server-preferences";
import { serverUserText } from "../../../i18n/server-user-messages";
export function PreferencesModule({ serverId, language }: ModuleProps) {
  const visible = useNativeModuleVisible();
  const p = useServerPreferences(serverId, visible),
    t = serverUserText(language),
    [confirm, setConfirm] = useState<string | null>(null),
    [passkeyLabel, setPasskeyLabel] = useState("Passkey");
  useEffect(() => {
    if (!visible) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (confirm || p.setup)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (confirm) setConfirm(null);
        else p.setSetup(null);
      }
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [visible, confirm, p.setup]);
  const title = (label: string) => (
    <h3 className="mt-6 text-lg font-semibold">{label}</h3>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {p.error ? (
        <p role="alert" className="text-error">
          {p.error}
        </p>
      ) : null}
      {p.notice ? <p role="status">{p.notice}</p> : null}
      {title(t("preferences.profile.sectionTitle"))}
      <p>{p.username}</p>
      <label className="block">
        {t("preferences.profile.labelDisplayName")}
        <input
          className="input block w-full"
          value={p.displayName}
          onChange={(event) => p.setDisplayName(event.target.value)}
        />
      </label>
      <label className="block">
        {t("preferences.profile.labelPhone")}
        <input
          className="input block w-full"
          type="tel"
          value={p.phone}
          onChange={(event) => p.setPhone(event.target.value)}
        />
      </label>
      <button
        className="btn btn-primary"
        disabled={p.busy}
        onClick={() => void p.saveProfile()}
      >
        {t("preferences.profile.btnSave")}
      </button>
      {title(t("preferences.password.sectionTitle"))}
      <p className="opacity-60">{t("preferences.password.disabledNotice")}</p>
      <div className="flex gap-2">
        {["light", "dark", "system"].map((value, index) => (
          <button
            key={value}
            className={`btn ${p.ui.theme === value ? "btn-primary" : "btn-ghost"}`}
            onClick={() =>
              p.setUi((previous) => ({ ...previous, theme: value }))
            }
          >
            {["☀", "☾", "◐"][index]}
          </button>
        ))}
      </div>
      <label className="block">
        {t("common.language")}
        <select
          className="select ml-3"
          value={p.ui.language}
          onChange={(event) =>
            p.setUi((previous) => ({
              ...previous,
              language: event.target.value,
            }))
          }
        >
          {PANEL_LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {PANEL_LANGUAGE_NAMES[value]}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn btn-primary"
        disabled={p.busy}
        onClick={() => void p.saveUi()}
      >
        {t("chat.save")}
      </button>
      {title(t("chat.settings.title"))}
      {Object.entries(p.chat).map(([section, fields]) => (
        <fieldset
          key={section}
          className="space-y-3 rounded-xl border border-base-300 p-4"
        >
          <legend>{t(`chat.settings.tabs.${section}`)}</legend>
          {Object.entries(fields).map(([key, value]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3"
            >
              <span>{t(`chat.settings.${section}.${key}`)}</span>
              {typeof value === "boolean" ? (
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={value}
                  onChange={(event) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: {
                        ...previous[section],
                        [key]: event.target.checked,
                      },
                    }))
                  }
                />
              ) : PREFERENCE_CHOICES[key] ? (
                <select
                  className="select"
                  value={String(value)}
                  onChange={(event) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: {
                        ...previous[section],
                        [key]:
                          typeof value === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                      },
                    }))
                  }
                >
                  {PREFERENCE_CHOICES[key].map((option) => (
                    <option key={option} value={option}>
                      {preferenceChoiceLabel(section, key, option, t)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="input"
                  value={String(value)}
                  onChange={(event) =>
                    p.setChat((previous) => ({
                      ...previous,
                      [section]: {
                        ...previous[section],
                        [key]: event.target.value,
                      },
                    }))
                  }
                />
              )}
            </label>
          ))}
        </fieldset>
      ))}
      <label className="flex gap-3">
        <input
          type="checkbox"
          className="checkbox"
          checked={p.presence.showOnline}
          onChange={(event) =>
            p.setPresence((previous) => ({
              ...previous,
              showOnline: event.target.checked,
            }))
          }
        />
        {t("chat.settings.presence.showOnline")}
      </label>
      <label className="block">
        {t("chat.settings.presence.statusMessage")}
        <input
          className="input block w-full"
          value={p.presence.statusMessage}
          maxLength={80}
          onChange={(event) =>
            p.setPresence((previous) => ({
              ...previous,
              statusMessage: event.target.value,
            }))
          }
        />
      </label>
      <button
        className="btn btn-primary"
        disabled={p.busy}
        onClick={() => void p.saveChat()}
      >
        {t("chat.save")}
      </button>
      {title(t("preferences.twoFactor.sectionTitle"))}
      <p>
        {t(
          p.totp.enabled
            ? "preferences.labels.twoFaBadgeEnabled"
            : "preferences.labels.twoFaBadgeDisabled",
        )}
      </p>
      <button
        className="btn"
        onClick={() => {
          if (p.totp.enabled) setConfirm("disable");
          else void p.setupTotp();
        }}
      >
        {t(
          p.totp.enabled
            ? "preferences.twoFactor.btnDisable"
            : "preferences.twoFactor.btnEnable",
        )}
      </button>
      {title(t("preferences.passkeys.sectionTitle"))}
      <input
        className="input"
        value={passkeyLabel}
        aria-label={t("preferences.passkeys.sectionTitle")}
        onChange={(event) => setPasskeyLabel(event.target.value)}
      />
      <button
        className="btn"
        disabled={!!p.enrollment}
        onClick={() =>
          void p.register(
            (url) =>
              window.electronApi?.openExternal(url) ??
              Promise.resolve(window.open(url, "_blank", "noopener")),
            passkeyLabel,
          )
        }
      >
        {t("preferences.passkeys.btnAdd")}
      </button>
      {p.passkeys.map((key) => (
        <div key={key.id} className="flex items-center gap-3">
          <span>{key.label}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirm(key.id)}
          >
            {t("chat.delete")}
          </button>
        </div>
      ))}
      {title(t("preferences.recoveryCodes.sectionTitle"))}
      <p>
        {t(
          p.recovery
            ? "preferences.labels.hasActiveCodes"
            : "preferences.labels.noActiveCodes",
        )}
      </p>
      <button className="btn" onClick={() => setConfirm("regenerate")}>
        {t("preferences.recoveryCodes.btnRegenerate")}
      </button>
      {p.codes.length ? (
        <div>
          <p>{t("preferences.recoveryCodes.warning")}</p>
          <pre>{p.codes.join("\n")}</pre>
          <button
            className="btn"
            onClick={() =>
              void navigator.clipboard.writeText(p.codes.join("\n"))
            }
          >
            {t("preferences.recoveryCodes.btnCopy")}
          </button>
          <button className="btn" onClick={() => p.setCodes([])}>
            {t("chat.close")}
          </button>
        </div>
      ) : null}
      {title(t("preferences.auditLog.sectionTitle"))}
      {p.audit.map((entry) => (
        <p key={entry.id}>
          {entry.eventType} ·{" "}
          {new Date(entry.createdAt).toLocaleString(language)}
        </p>
      ))}
      {p.setup ? (
        <div role="dialog" className="absolute inset-0 z-20 bg-base-100 p-5">
          <h3>{t("preferences.dialogSetup2fa.title")}</h3>
          {p.error && (
            <p role="alert" className="text-error">
              {p.error}
            </p>
          )}
          <p>{t("preferences.dialogSetup2fa.manualEntryLabel")}</p>
          <code>{p.setup.secret}</code>
          <input
            className="input block"
            inputMode="numeric"
            maxLength={6}
            value={p.code}
            onChange={(event) => p.setCode(event.target.value)}
            aria-label={t("preferences.dialogSetup2fa.verifyCodeLabel")}
          />
          <button
            className="btn btn-primary"
            disabled={!/^\d{6}$/.test(p.code)}
            onClick={() => void p.enableTotp()}
          >
            {t("preferences.dialogSetup2fa.btnConfirm")}
          </button>
          <button className="btn" onClick={() => p.setSetup(null)}>
            {t("chat.cancel")}
          </button>
        </div>
      ) : null}
      {confirm ? (
        <div role="dialog" className="absolute inset-0 z-20 bg-base-100 p-5">
          {p.error && (
            <p role="alert" className="text-error">
              {p.error}
            </p>
          )}
          <h3>
            {t(
              confirm === "disable"
                ? "preferences.dialogDisable2fa.title"
                : confirm === "regenerate"
                  ? "preferences.dialogRegenCodes.title"
                  : "preferences.confirm.deletePasskeyTitle",
            )}
          </h3>
          <p>
            {t(
              confirm === "disable"
                ? "preferences.dialogDisable2fa.body"
                : confirm === "regenerate"
                  ? "preferences.dialogRegenCodes.body"
                  : "preferences.confirm.deletePasskey",
            )}
          </p>
          <button
            className="btn btn-error"
            disabled={p.busy}
            onClick={() => {
              void (
                confirm === "disable"
                  ? p.disableTotp()
                  : confirm === "regenerate"
                    ? p.regenerate()
                    : p.revoke(confirm)
              ).then((ok) => {
                if (ok) setConfirm(null);
              });
            }}
          >
            {t("chat.save")}
          </button>
          <button className="btn" onClick={() => setConfirm(null)}>
            {t("chat.cancel")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
