// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/mail/[id]/inbox.astro.
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
 * Mailbox view — /panel/mail/[id]/inbox
 * 3-column layout: folders | message list | message viewer
 */
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import { getPageMessages } from "../view-context";
export default function pages_panel_mail__id__inbox(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["mail"]);
  const { id } = Astro.params;

  return (
    <Fragment>
      <PanelLayout title={t.mail.inbox.pageTitle} activeModule="mail">
        <div className="flex h-[calc(100dvh-6rem)] rounded-xl border border-border bg-card overflow-hidden">
          {/** ── Folder sidebar ─────────────────────────────────── */}
          <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-border bg-muted/20">
            {/** Account header */}
            <div className="border-b border-border px-4 py-3">
              <p
                id="account-email"
                className="text-xs font-semibold truncate text-foreground"
              >
                {t.mail.inbox.loadingAccount}
              </p>
              <a
                href="/panel/mail"
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <i className="ti ti-arrow-left text-xs"></i>
                {t.mail.inbox.allAccounts}
              </a>
            </div>

            {/** Folder list */}
            <nav
              id="folders-list"
              className="flex-1 overflow-y-auto p-2 space-y-0.5"
            >
              {/** Skeleton */}
              {Array.from({ length: 5 }).map(() => (
                <Fragment>
                  <div className="h-8 rounded-lg bg-muted animate-pulse" />
                </Fragment>
              ))}
            </nav>

            {/** Compose button */}
            <div className="border-t border-border p-3">
              <button
                id="btn-open-folders-manager"
                type="button"
                className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <i className="ti ti-folders text-sm"></i>
                {t.mail.inbox.btnManageFolders}
              </button>
              <a
                href={`/panel/mail/compose?from=${id}`}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <i className="ti ti-edit text-sm"></i>
                {t.mail.inbox.btnCompose}
              </a>
            </div>
          </aside>

          {/** ── Message list ───────────────────────────────────── */}
          <div className="flex w-72 shrink-0 flex-col border-r border-border">
            {/** Toolbar */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                {/** Mobile: back to folders */}
                <button
                  id="btn-show-folders"
                  className="md:hidden rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <i className="ti ti-layout-sidebar text-sm"></i>
                </button>
                <h2 id="folder-name" className="text-sm font-semibold">
                  INBOX
                </h2>
                <span
                  id="folder-count"
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary hidden"
                >
                  0
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  id="btn-open-contacts"
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title={t.mail.inbox.titleContacts}
                >
                  <i className="ti ti-address-book text-sm"></i>
                  <span className="hidden sm:inline">
                    {t.mail.inbox.titleContacts}
                  </span>
                </button>
                <button
                  id="btn-refresh"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title={t.mail.inbox.titleRefresh}
                >
                  <i className="ti ti-refresh text-sm"></i>
                </button>
                <button
                  id="btn-mark-all-read"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title={t.mail.inbox.titleMarkAllRead}
                >
                  <i className="ti ti-checks text-sm"></i>
                </button>
              </div>
            </div>

            {/** Search */}
            <div className="border-b border-border px-3 py-2">
              <div className="relative">
                <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs"></i>
                <input
                  id="msg-search"
                  type="text"
                  placeholder={t.mail.inbox.placeholderSearch}
                  className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  id="msg-filter-email"
                  type="text"
                  placeholder={t.mail.inbox.placeholderFilterEmail}
                  className="col-span-2 h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  id="msg-filter-date-from"
                  type="date"
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <input
                  id="msg-filter-date-to"
                  type="date"
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <select
                  id="msg-sort-order"
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                >
                  <option value="desc">{t.mail.inbox.sortNewest}</option>
                  <option value="asc">{t.mail.inbox.sortOldest}</option>
                </select>
                <button
                  id="btn-clear-filters"
                  type="button"
                  className="h-8 rounded-lg border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {t.mail.inbox.btnClearFilters}
                </button>
              </div>
            </div>

            {/** Messages */}
            <div
              id="messages-list"
              className="flex-1 overflow-y-auto divide-y divide-border/50"
            >
              {/** Skeleton */}
              {Array.from({ length: 6 }).map(() => (
                <Fragment>
                  <div className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                      <div className="ml-auto h-3 w-12 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    <div className="h-3 w-3/4 rounded bg-muted/60 animate-pulse" />
                  </div>
                </Fragment>
              ))}
            </div>

            {/** Pagination */}
            <div
              id="msg-pagination"
              className="hidden border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground"
            >
              <button
                id="btn-prev-page"
                className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ti ti-chevron-left"></i>
              </button>
              <span id="page-info"></span>
              <button
                id="btn-next-page"
                className="rounded px-2 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="ti ti-chevron-right"></i>
              </button>
            </div>
          </div>

          {/** ── Message viewer ─────────────────────────────────── */}
          <div
            id="message-viewer"
            className="flex flex-1 flex-col overflow-hidden"
          >
            {/** Empty state */}
            <div
              id="viewer-empty"
              className="flex flex-1 flex-col items-center justify-center text-center p-8"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
                <i className="ti ti-mail-opened text-2xl text-muted-foreground/50"></i>
              </div>
              <p className="text-sm font-medium">
                {t.mail.inbox.viewerEmptyTitle}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.mail.inbox.viewerEmptyDesc}
              </p>
            </div>

            {/** Message content */}
            <div
              id="viewer-content"
              className="hidden flex flex-col h-full overflow-hidden"
            >
              {/** Message header */}
              <div className="border-b border-border px-6 py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h3
                    id="msg-subject"
                    className="text-base font-semibold leading-tight flex-1"
                  ></h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      id="btn-reply"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.mail.inbox.titleReply}
                    >
                      <i className="ti ti-arrow-back-up text-base"></i>
                    </button>
                    <button
                      id="btn-edit-draft"
                      className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.mail.inbox.editDraft}
                      aria-label={t.mail.inbox.editDraft}
                    >
                      <i className="ti ti-pencil text-base"></i>
                    </button>
                    <button
                      id="btn-forward"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.mail.inbox.titleForward}
                    >
                      <i className="ti ti-arrow-forward-up text-base"></i>
                    </button>
                    <button
                      id="btn-delete-msg"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title={t.mail.inbox.titleDelete}
                    >
                      <i className="ti ti-trash text-base"></i>
                    </button>
                    <button
                      id="btn-move"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      title={t.mail.inbox.titleMove}
                    >
                      <i className="ti ti-folder-arrow-right text-base"></i>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">
                      {t.mail.inbox.labelFrom}
                    </span>{" "}
                    <span id="msg-from"></span>
                  </span>
                  <span>
                    <span className="font-medium text-foreground">
                      {t.mail.inbox.labelTo}
                    </span>{" "}
                    <span id="msg-to"></span>
                  </span>
                  <span id="msg-date" className="ml-auto"></span>
                </div>

                <div
                  id="msg-cc-row"
                  className="hidden text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {t.mail.inbox.labelCc}
                  </span>{" "}
                  <span id="msg-cc"></span>
                </div>
              </div>

              {/** Message body */}
              <div
                id="mail-pgp-unlock"
                className="hidden border-b border-border bg-muted/20 px-6 py-4"
              >
                <label
                  htmlFor="mail-pgp-passphrase"
                  className="block text-sm font-medium"
                >
                  {t.mail.inbox.pgpEncryptedMessage}
                </label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.mail.inbox.pgpPassphraseHint}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    id="mail-pgp-passphrase"
                    type="password"
                    autoComplete="off"
                    placeholder={
                      t.mail.settingsModal.encryption.privateKeyPassphrase
                    }
                    className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                  />
                  <button
                    id="mail-pgp-decrypt"
                    type="button"
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    {t.mail.inbox.pgpDecrypt}
                  </button>
                </div>
                <p
                  id="mail-pgp-error"
                  role="status"
                  className="mt-2 hidden text-xs text-destructive"
                ></p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {/** HTML content in sandboxed iframe */}
                <iframe
                  id="msg-iframe"
                  className="hidden w-full border-0 block"
                  style={cssStyle("min-height:240px")}
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  title={t.mail.inbox.msgIframeTitle}
                ></iframe>
                {/** Plain text fallback */}
                <pre
                  id="msg-text"
                  className="hidden whitespace-pre-wrap break-words font-sans text-sm text-foreground p-6 leading-relaxed"
                ></pre>
              </div>

              {/** Attachments */}
              <div
                id="msg-attachments"
                className="hidden border-t border-border px-6 py-3"
              >
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {t.mail.inbox.attachmentsLabel}
                </p>
                <div
                  id="attachments-list"
                  className="flex flex-wrap gap-2"
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/** Move to folder dialog */}
        <dialog
          id="dlg-move"
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl backdrop:bg-black/50"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">
              {t.mail.inbox.moveDlgTitle}
            </h3>
            <button
              onClick={() => {
                (document.getElementById("dlg-move") as HTMLDialogElement | null)?.close();
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            >
              <i className="ti ti-x"></i>
            </button>
          </div>
          <div
            id="move-folders-list"
            className="space-y-1 max-h-64 overflow-y-auto mb-4"
          ></div>
        </dialog>

        {/** Folder manager dialog */}
        <dialog
          id="dlg-folders-manager"
          className="w-full max-w-3xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={t.mail.inbox.foldersDlgTitle}
            closeId="folders-manager-close"
          />
          <p
            id="folders-manager-account-email"
            className="px-6 pt-4 text-xs text-muted-foreground"
          ></p>

          <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-border">
              <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
                {t.mail.inbox.foldersExistingHeader}
              </div>
              <div
                id="folders-manager-list-body"
                className="max-h-[420px] space-y-2 overflow-auto p-3 text-xs"
              ></div>
            </div>

            <form
              id="folders-manager-form"
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <input id="folders-manager-edit-path" type="hidden" />
              <div
                id="folders-manager-feedback"
                className="hidden rounded-lg px-4 py-2 text-sm"
              ></div>
              <div
                id="folders-manager-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              ></div>
              <div className="space-y-1.5">
                <label
                  htmlFor="folders-manager-parent"
                  className="text-sm font-medium"
                >
                  {t.mail.inbox.labelFolderParent}
                </label>
                <select
                  id="folders-manager-parent"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">
                    {t.mail.inbox.selectFolderParentDefault}
                  </option>
                </select>
                <p
                  id="folders-manager-parent-help"
                  className="text-[11px] text-muted-foreground"
                >
                  {t.mail.inbox.folderParentHelp}
                </p>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="folders-manager-name"
                  className="text-sm font-medium"
                >
                  {t.mail.inbox.labelFolderName}
                </label>
                <input
                  id="folders-manager-name"
                  type="text"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  {t.mail.inbox.btnSaveFolder}
                </button>
              </div>
            </form>
          </div>
        </dialog>

        {/** Contacts dialog */}
        <dialog
          id="dlg-contacts"
          className="w-full max-w-4xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={t.mail.inbox.contactsDlgTitle}
            closeId="contacts-dialog-close"
          />
          <p
            id="contacts-account-email"
            className="px-6 pt-4 text-xs text-muted-foreground"
          ></p>

          <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[1.1fr_1fr]">
            <div className="rounded-xl border border-border">
              <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
                {t.mail.inbox.contactsSavedHeader}
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-2 text-left">
                        {t.mail.inbox.colEmail}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t.mail.inbox.colName}
                      </th>
                      <th className="px-3 py-2 text-right">
                        {t.mail.inbox.colActions}
                      </th>
                    </tr>
                  </thead>
                  <tbody id="contacts-list-body"></tbody>
                </table>
              </div>
            </div>

            <form
              id="contacts-form"
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <input id="contacts-edit-id" type="hidden" />
              <div
                id="contacts-feedback"
                className="hidden rounded-lg px-4 py-2 text-sm"
              ></div>
              <div
                id="contacts-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              ></div>
              <div className="space-y-1.5">
                <label htmlFor="contacts-email" className="text-sm font-medium">
                  {t.mail.inbox.labelEmail}
                </label>
                <input
                  id="contacts-email"
                  type="email"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="contacts-name" className="text-sm font-medium">
                  {t.mail.inbox.labelName}
                </label>
                <input
                  id="contacts-name"
                  type="text"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  id="contacts-new"
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  {t.mail.inbox.btnNew}
                </button>
                <button
                  type="button"
                  id="contacts-cancel"
                  className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                >
                  {t.mail.inbox.btnClose}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                >
                  {t.mail.inbox.btnSave}
                </button>
              </div>
            </form>
          </div>
        </dialog>

        {/** Credential recovery dialog */}
        {/** Modal A: usar contraseña ACTUAL (validar por IMAP, sin cambiarla) */}
        <dialog
          id="dlg-mail-credential-current"
          className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={t.mail.inbox.credentialCurrentTitle}
            closeId="mailcur-close"
          />
          <p
            id="mailcur-account-email"
            className="px-6 pt-4 text-xs text-muted-foreground"
          ></p>
          <form id="mailcur-form" className="space-y-3 px-6 py-5">
            <p className="text-xs text-muted-foreground">
              {t.mail.inbox.credentialCurrentDesc}{" "}
              <strong>{t.mail.inbox.credentialCurrentDescStrong}</strong>{" "}
              {t.mail.inbox.credentialCurrentDescSuffix}{" "}
              <strong>{t.mail.inbox.credentialCurrentNoChange}</strong>
              {t.mail.inbox.credentialCurrentDescEnd}
            </p>
            <div
              id="mailcur-feedback"
              className="hidden rounded-lg px-4 py-2 text-sm"
            ></div>
            <div
              id="mailcur-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>
            <div
              id="mailcur-loading"
              className="hidden rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-80"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                  ></path>
                </svg>
                <span>{t.mail.inbox.credentialValidating}</span>
              </span>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="mailcur-password" className="text-sm font-medium">
                {t.mail.inbox.labelCurrentPassword}
              </label>
              <input
                id="mailcur-password"
                type="password"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                id="mailcur-cancel"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.inbox.btnCancelCurrent}
              </button>
              <button
                id="mailcur-submit"
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.inbox.btnValidateUse}
              </button>
            </div>
          </form>
        </dialog>

        {/** Modal B: CAMBIAR la contraseña del buzón (define una nueva) */}
        <dialog
          id="dlg-mail-credentials"
          className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={t.mail.inbox.credentialChangeTitle}
            closeId="mail-credential-dialog-close"
          />
          <p
            id="mail-credential-account-email"
            className="px-6 pt-4 text-xs text-muted-foreground"
          ></p>
          <form id="mail-credential-form" className="space-y-3 px-6 py-5">
            <p className="text-xs text-muted-foreground">
              {t.mail.inbox.credentialChangeDesc}{" "}
              <strong>{t.mail.inbox.credentialChangeDescStrong}</strong>{" "}
              {t.mail.inbox.credentialChangeDescSuffix}
            </p>
            <div
              id="mail-credential-feedback"
              className="hidden rounded-lg px-4 py-2 text-sm"
            ></div>
            <div
              id="mail-credential-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>
            <div
              id="mail-credential-loading"
              className="hidden rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-80"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
                  ></path>
                </svg>
                <span id="mail-credential-loading-text">
                  {t.mail.inbox.credentialChangingText}
                </span>
              </span>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="mail-credential-password"
                className="text-sm font-medium"
              >
                {t.mail.inbox.labelNewPassword}
              </label>
              <input
                id="mail-credential-password"
                type="password"
                minLength={6}
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="mail-credential-confirm"
                className="text-sm font-medium"
              >
                {t.mail.inbox.labelConfirmPassword}
              </label>
              <input
                id="mail-credential-confirm"
                type="password"
                minLength={6}
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                id="mail-credential-cancel"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.inbox.btnCancelChange}
              </button>
              <button
                id="mail-credential-submit"
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.inbox.btnChangePassword}
              </button>
            </div>
          </form>
        </dialog>
      </PanelLayout>

      <script
        id="inbox-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["mail"]) }}
      ></script>
    </Fragment>
  );
}
