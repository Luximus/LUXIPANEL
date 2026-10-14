// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/preferences/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * User Preferences — /panel/preferences
 * Perfil, passkeys, 2FA, códigos de recuperación, log de auditoría
 */
import PanelLayout from "../module-frame";
import { getInitials } from "../view-context";
import { getPageMessages } from "../view-context";
export default function pages_panel_preferences_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["preferences"]);
  const user = Astro.locals.user;
  const initials = getInitials(user);
  const prefView = Astro.url.searchParams.get("workspaceView");
  const isolatedPrefView =
    Astro.url.searchParams.get("embed") === "1" &&
    ["profile", "security", "audit"].includes(prefView ?? "");
  const showPrefView = (view: string) => !isolatedPrefView || prefView === view;

  return (
    <Fragment>
      <PanelLayout title={t.preferences.pageTitle} activeModule="preferences">
        <div id="pref-root" className="space-y-6 max-w-3xl">
          {/** Header */}
          <div>
            <h1 className="text-xl font-semibold">
              {t.preferences.header.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t.preferences.header.subtitle}
            </p>
          </div>

          {/** Profile */}
          {showPrefView("profile") && (
            <Fragment>
              <section
                id="pref-profile"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <i className="ti ti-user text-primary text-sm"></i>
                  </div>
                  <h2 className="text-sm font-semibold">
                    {t.preferences.profile.sectionTitle}
                  </h2>
                </div>
                <div className="p-5 flex flex-col sm:flex-row gap-6">
                  {/** Avatar */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
                      {initials}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {user?.username}
                    </span>
                  </div>
                  {/** Fields */}
                  <div className="flex-1 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t.preferences.profile.labelDisplayName}
                      </label>
                      <input
                        id="pref-display-name"
                        type="text"
                        defaultValue={user?.displayName ?? ""}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t.preferences.profile.labelPhone}
                      </label>
                      <input
                        id="pref-phone"
                        type="tel"
                        placeholder={t.preferences.placeholders.phone}
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t.preferences.profile.labelUsername}
                      </label>
                      <input
                        type="text"
                        defaultValue={user?.username ?? ""}
                        disabled
                        className="w-full h-10 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {t.preferences.profile.labelRole}
                      </label>
                      <input
                        type="text"
                        defaultValue={user?.role ?? "user"}
                        disabled
                        className="w-full h-10 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground capitalize cursor-not-allowed"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <button
                        id="btn-save-profile"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <i className="ti ti-device-floppy text-sm"></i>
                        {t.preferences.profile.btnSave}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </Fragment>
          )}

          {/** Change password */}
          {showPrefView("security") && (
            <Fragment>
              <section
                id="pref-password"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <i className="ti ti-key text-amber-500 text-sm"></i>
                  </div>
                  <h2 className="text-sm font-semibold">
                    {t.preferences.password.sectionTitle}
                  </h2>
                </div>
                <div className="p-5">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {t.preferences.password.disabledNotice}
                    </p>
                  </div>
                </div>
              </section>
            </Fragment>
          )}

          {/** Passkeys */}
          {showPrefView("security") && (
            <Fragment>
              <section
                id="pref-passkeys"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                      <i className="ti ti-fingerprint text-blue-500 text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">
                        {t.preferences.passkeys.sectionTitle}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t.preferences.passkeys.sectionSubtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-add-passkey"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <i className="ti ti-plus text-sm"></i>
                    {t.preferences.passkeys.btnAdd}
                  </button>
                </div>
                <div className="p-5">
                  <div id="passkeys-skeleton" className="space-y-2">
                    {Array.from({ length: 2 }).map(() => (
                      <Fragment>
                        <div className="h-12 rounded-lg bg-muted animate-pulse" />
                      </Fragment>
                    ))}
                  </div>
                  <div id="passkeys-list" className="hidden space-y-2"></div>
                  <p
                    id="passkeys-empty"
                    className="hidden text-sm text-muted-foreground text-center py-6"
                  >
                    <i className="ti ti-fingerprint text-2xl block mb-2 opacity-30"></i>
                    {t.preferences.passkeys.emptyState}
                  </p>
                </div>
              </section>
            </Fragment>
          )}

          {/** Recovery codes */}
          {showPrefView("security") && (
            <Fragment>
              <section
                id="pref-recovery-codes"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <i className="ti ti-shield-check text-emerald-500 text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">
                        {t.preferences.recoveryCodes.sectionTitle}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t.preferences.recoveryCodes.sectionSubtitle}
                      </p>
                    </div>
                  </div>
                  <button
                    id="btn-gen-codes"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    <i className="ti ti-refresh text-sm"></i>
                    {t.preferences.recoveryCodes.btnRegenerate}
                  </button>
                </div>
                <div className="p-5">
                  <div
                    id="codes-status"
                    className="text-sm text-muted-foreground"
                  >
                    {t.preferences.recoveryCodes.loading}
                  </div>
                  <div
                    id="codes-grid"
                    className="hidden grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3"
                  ></div>
                  <div
                    id="codes-warning"
                    className="hidden mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
                  >
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      <i className="ti ti-alert-triangle mr-1"></i>
                      {t.preferences.recoveryCodes.warning}
                    </p>
                  </div>
                  <div id="codes-actions" className="hidden flex gap-2 mt-3">
                    <button
                      id="btn-copy-codes"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      <i className="ti ti-copy text-sm"></i>
                      {t.preferences.recoveryCodes.btnCopy}
                    </button>
                    <button
                      id="btn-print-codes"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                    >
                      <i className="ti ti-printer text-sm"></i>
                      {t.preferences.recoveryCodes.btnPrint}
                    </button>
                  </div>
                </div>
              </section>
            </Fragment>
          )}

          {/** Two-Factor Authentication (2FA) */}
          {showPrefView("security") && (
            <Fragment>
              <section
                id="pref-2fa"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                      <i className="ti ti-shield-lock text-purple-500 text-sm"></i>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">
                        {t.preferences.twoFactor.sectionTitle}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {t.preferences.twoFactor.sectionSubtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    id="2fa-badge"
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground"
                  >
                    <i className="ti ti-circle-x text-sm"></i>
                    {t.preferences.twoFactor.badgeDisabled}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  {/** Status text */}
                  <p
                    id="2fa-description"
                    className="text-sm text-muted-foreground hidden"
                  >
                    <i className="ti ti-circle-check text-sm text-emerald-600 dark:text-emerald-400 mr-2"></i>
                    {t.preferences.twoFactor.enabledDescription}
                  </p>

                  {/** Buttons */}
                  <div id="2fa-actions" className="flex gap-2">
                    <button
                      id="btn-setup-2fa"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <i className="ti ti-plus text-sm"></i>
                      {t.preferences.twoFactor.btnEnable}
                    </button>
                    <button
                      id="btn-disable-2fa"
                      className="hidden inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <i className="ti ti-x text-sm"></i>
                      {t.preferences.twoFactor.btnDisable}
                    </button>
                  </div>
                </div>
              </section>
            </Fragment>
          )}

          {/** Audit log */}
          {showPrefView("audit") && (
            <Fragment>
              <section
                id="pref-audit"
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <i className="ti ti-history text-purple-500 text-sm"></i>
                  </div>
                  <h2 className="text-sm font-semibold">
                    {t.preferences.auditLog.sectionTitle}
                  </h2>
                </div>
                <div className="p-5">
                  <div id="audit-skeleton" className="space-y-2">
                    {Array.from({ length: 4 }).map(() => (
                      <Fragment>
                        <div className="h-10 rounded-lg bg-muted animate-pulse" />
                      </Fragment>
                    ))}
                  </div>
                  <div
                    id="audit-list"
                    className="hidden divide-y divide-border"
                  ></div>
                  <p
                    id="audit-empty"
                    className="hidden text-sm text-muted-foreground text-center py-6"
                  >
                    {t.preferences.auditLog.emptyState}
                  </p>
                </div>
              </section>
            </Fragment>
          )}
        </div>

        {/** Toast */}
        <div id="toast" className="fixed bottom-5 right-5 z-50 hidden">
          <div
            id="toast-inner"
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm"
          >
            <i id="toast-icon" className="text-base"></i>
            <span id="toast-msg"></span>
          </div>
        </div>

        {/** Confirm regenerate dialog */}
        {showPrefView("security") && (
          <Fragment>
            <dialog
              id="dlg-confirm-regen"
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
            >
              <div className="text-center space-y-3 mb-5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <i className="ti ti-alert-triangle text-xl text-destructive"></i>
                </div>
                <h3 className="text-base font-semibold">
                  {t.preferences.dialogRegenCodes.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.preferences.dialogRegenCodes.body}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    (document.getElementById("dlg-confirm-regen") as HTMLDialogElement | null)?.close();
                  }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  {t.preferences.dialogRegenCodes.btnCancel}
                </button>
                <button
                  id="btn-confirm-regen"
                  className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {t.preferences.dialogRegenCodes.btnConfirm}
                </button>
              </div>
            </dialog>
          </Fragment>
        )}

        {/** Setup 2FA dialog */}
        {showPrefView("security") && (
          <Fragment>
            <dialog
              id="dlg-setup-2fa"
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
            >
              <div className="text-center space-y-4 mb-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <i className="ti ti-shield-lock text-xl text-primary"></i>
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {t.preferences.dialogSetup2fa.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t.preferences.dialogSetup2fa.subtitle}
                  </p>
                </div>
              </div>

              {/** QR Code */}
              <div className="flex justify-center mb-6">
                <canvas
                  id="qr-canvas"
                  className="border border-border rounded-lg p-3"
                ></canvas>
              </div>

              {/** Secret text (fallback) */}
              <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.preferences.dialogSetup2fa.manualEntryLabel}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    id="secret-text"
                    type="text"
                    readOnly
                    className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs font-mono text-center focus:outline-none"
                  />
                  <button
                    id="btn-copy-secret"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent transition-colors"
                    title={t.preferences.dialogSetup2fa.titleCopySecret}
                  >
                    <i className="ti ti-copy text-sm"></i>
                  </button>
                </div>
              </div>

              {/** Code verification */}
              <div className="space-y-3 mb-6">
                <label
                  htmlFor="verify-code-input"
                  className="text-sm font-medium"
                >
                  {t.preferences.dialogSetup2fa.verifyCodeLabel}
                </label>
                <input
                  id="verify-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="w-full h-11 rounded-lg border border-input bg-background px-4 text-center text-lg font-mono tracking-[0.2em] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/** Error message */}
              <p
                id="2fa-setup-error"
                className="hidden text-xs text-destructive mb-4"
              ></p>

              {/** Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    (document.getElementById("dlg-setup-2fa") as HTMLDialogElement | null)?.close();
                  }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  {t.preferences.dialogSetup2fa.btnCancel}
                </button>
                <button
                  id="btn-confirm-2fa-enable"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t.preferences.dialogSetup2fa.btnConfirm}
                </button>
              </div>
            </dialog>
          </Fragment>
        )}

        {/** Disable 2FA confirmation dialog */}
        {showPrefView("security") && (
          <Fragment>
            <dialog
              id="dlg-disable-2fa"
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
            >
              <div className="text-center space-y-3 mb-5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <i className="ti ti-alert-triangle text-xl text-destructive"></i>
                </div>
                <h3 className="text-base font-semibold">
                  {t.preferences.dialogDisable2fa.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.preferences.dialogDisable2fa.body}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    (document.getElementById("dlg-disable-2fa") as HTMLDialogElement | null)?.close();
                  }}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                >
                  {t.preferences.dialogDisable2fa.btnCancel}
                </button>
                <button
                  id="btn-confirm-2fa-disable"
                  className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  {t.preferences.dialogDisable2fa.btnConfirm}
                </button>
              </div>
            </dialog>
          </Fragment>
        )}
      </PanelLayout>

      <script
        id="preferences-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["preferences"]) }}
      ></script>
    </Fragment>
  );
}
