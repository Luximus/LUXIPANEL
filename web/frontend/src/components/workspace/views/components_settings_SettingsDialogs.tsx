// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsDialogs.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_settings_SettingsDialogs(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <input
        id="logo-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/x-icon,image/gif,image/avif,.ico"
        className="hidden"
      />

      {/** Image picker dialog */}
      <dialog
        id="dlg-image-picker"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">
              {t.settings.imagePicker.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.settings.imagePicker.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              (document.getElementById("dlg-image-picker") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div
          id="img-picker-skeleton"
          className="grid grid-cols-3 sm:grid-cols-4 gap-3"
        >
          {Array.from({ length: 8 }).map(() => (
            <Fragment>
              <div className="aspect-square rounded-lg bg-muted animate-pulse" />
            </Fragment>
          ))}
        </div>
        <div
          id="img-picker-grid"
          className="hidden grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1"
        ></div>
        <p
          id="img-picker-empty"
          className="hidden text-sm text-muted-foreground text-center py-10"
        >
          <i className="ti ti-photo-off text-2xl block mb-2 opacity-30"></i>
          {t.settings.imagePicker.empty}
        </p>
        <div className="mt-4 flex justify-between gap-3">
          <button
            type="button"
            id="btn-img-picker-upload"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
          >
            <i className="ti ti-upload text-sm"></i>
            {t.settings.imagePicker.btnUpload}
          </button>
          <button
            type="button"
            onClick={() => {
              (document.getElementById("dlg-image-picker") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t.settings.imagePicker.btnCancel}
          </button>
        </div>
      </dialog>

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

      {/** Test SMTP dialog */}
      <dialog
        id="dlg-test-smtp"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">
            {t.settings.smtpTest.dialogTitle}
          </h3>
          <button
            onClick={() => {
              (document.getElementById("dlg-test-smtp") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t.settings.smtpTest.labelRecipient}
            </label>
            <input
              id="test-smtp-to"
              type="email"
              placeholder={t.settings.smtpTest.placeholderRecipient}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                (document.getElementById("dlg-test-smtp") as HTMLDialogElement | null)?.close();
              }}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              {t.settings.smtpTest.btnCancel}
            </button>
            <button
              id="btn-send-test"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t.settings.smtpTest.btnSend}
            </button>
          </div>
        </div>
      </dialog>

      {/** Passkeys dialog */}
      <dialog
        id="dlg-passkeys-settings"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">
            {t.settings.passkeysDialog.title}
          </h3>
          <button
            onClick={() => {
              (document.getElementById("dlg-passkeys-settings") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              id="btn-add-passkey-settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <i className="ti ti-plus text-sm"></i>
              {t.settings.passkeysDialog.btnAdd}
            </button>
          </div>
          <div id="passkeys-settings-skeleton" className="space-y-2">
            {Array.from({ length: 2 }).map(() => (
              <Fragment>
                <div className="h-12 rounded-lg bg-muted animate-pulse" />
              </Fragment>
            ))}
          </div>
          <div id="passkeys-settings-list" className="hidden space-y-2"></div>
          <p
            id="passkeys-settings-empty"
            className="hidden text-sm text-muted-foreground text-center py-6"
          >
            <i className="ti ti-fingerprint text-2xl block mb-2 opacity-30"></i>
            {t.settings.passkeysDialog.empty}
          </p>
        </div>
      </dialog>

      {/** Recovery codes dialog */}
      <dialog
        id="dlg-recovery-settings"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">
            {t.settings.recoveryDialog.title}
          </h3>
          <button
            type="button"
            onClick={() => {
              (document.getElementById("dlg-recovery-settings") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              id="btn-gen-codes-settings"
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <i className="ti ti-refresh text-sm"></i>
              {t.settings.recoveryDialog.btnGenerate}
            </button>
          </div>
          <p
            id="codes-status-settings"
            className="text-sm text-muted-foreground"
          >
            {t.settings.recoveryDialog.loading}
          </p>
          <div
            id="codes-grid-settings"
            className="hidden grid grid-cols-2 sm:grid-cols-4 gap-2"
          ></div>
          <div
            id="codes-warning-settings"
            className="hidden rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
          >
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <i className="ti ti-alert-triangle mr-1"></i>
              {t.settings.recoveryDialog.warningText}
            </p>
          </div>
          <div id="codes-actions-settings" className="hidden flex gap-2">
            <button
              id="btn-copy-codes-settings"
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <i className="ti ti-copy text-sm"></i>
              {t.settings.recoveryDialog.btnCopy}
            </button>
            <button
              id="btn-print-codes-settings"
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <i className="ti ti-printer text-sm"></i>
              {t.settings.recoveryDialog.btnPrint}
            </button>
          </div>
        </div>
      </dialog>

      {/** Setup 2FA dialog */}
      <dialog
        id="dlg-setup-2fa-settings"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="text-center space-y-4 mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <i className="ti ti-shield-lock text-xl text-primary"></i>
          </div>
          <div>
            <h3 className="text-base font-semibold">
              {t.settings.setup2faDialog.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t.settings.setup2faDialog.subtitle}
            </p>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <canvas
            id="qr-canvas-settings"
            className="border border-border rounded-lg p-3"
          ></canvas>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t.settings.setup2faDialog.secretLabel}
          </p>
          <div className="flex items-center gap-2">
            <input
              id="secret-text-settings"
              type="text"
              readOnly
              className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-xs font-mono text-center focus:outline-none"
            />
            <button
              id="btn-copy-secret-settings"
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent transition-colors"
              title={t.settings.setup2faDialog.copyTitle}
            >
              <i className="ti ti-copy text-sm"></i>
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <label
            htmlFor="verify-code-input-settings"
            className="text-sm font-medium"
          >
            {t.settings.setup2faDialog.verifyLabel}
          </label>
          <input
            id="verify-code-input-settings"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full h-11 rounded-lg border border-input bg-background px-4 text-center text-lg font-mono tracking-[0.2em] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <p
          id="2fa-setup-error-settings"
          className="hidden text-xs text-destructive mb-4"
        ></p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              (document.getElementById("dlg-setup-2fa-settings") as HTMLDialogElement | null)?.close();
            }}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t.settings.setup2faDialog.btnCancel}
          </button>
          <button
            id="btn-confirm-2fa-enable-settings"
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t.settings.setup2faDialog.btnActivate}
          </button>
        </div>
      </dialog>

      {/** Disable 2FA dialog */}
      <dialog
        id="dlg-disable-2fa-settings"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="text-center space-y-3 mb-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <i className="ti ti-alert-triangle text-xl text-destructive"></i>
          </div>
          <h3 className="text-base font-semibold">
            {t.settings.disable2faDialog.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.settings.disable2faDialog.body}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              (document.getElementById("dlg-disable-2fa-settings") as HTMLDialogElement | null)?.close();
            }}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t.settings.disable2faDialog.btnCancel}
          </button>
          <button
            id="btn-confirm-2fa-disable-settings"
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {t.settings.disable2faDialog.btnConfirm}
          </button>
        </div>
      </dialog>

      {/** Delete 2FA dialog */}
      <dialog
        id="dlg-delete-2fa-settings"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="text-center space-y-3 mb-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <i className="ti ti-trash text-xl text-destructive"></i>
          </div>
          <h3 className="text-base font-semibold">
            {t.settings.delete2faDialog.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.settings.delete2faDialog.body}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              (document.getElementById("dlg-delete-2fa-settings") as HTMLDialogElement | null)?.close();
            }}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            {t.settings.delete2faDialog.btnCancel}
          </button>
          <button
            id="btn-confirm-2fa-delete-settings"
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {t.settings.delete2faDialog.btnConfirm}
          </button>
        </div>
      </dialog>

      {/** Audit log dialog */}
      <dialog
        id="dlg-audit-log-settings"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold">
            {t.settings.auditLogDialog.title}
          </h3>
          <button
            onClick={() => {
              (document.getElementById("dlg-audit-log-settings") as HTMLDialogElement | null)?.close();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div id="audit-settings-skeleton" className="space-y-2">
          {Array.from({ length: 4 }).map(() => (
            <Fragment>
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
            </Fragment>
          ))}
        </div>
        <div
          id="audit-settings-list"
          className="hidden divide-y divide-border"
        ></div>
        <p
          id="audit-settings-empty"
          className="hidden text-sm text-muted-foreground text-center py-6"
        >
          {t.settings.auditLogDialog.empty}
        </p>
      </dialog>
    </Fragment>
  );
}
