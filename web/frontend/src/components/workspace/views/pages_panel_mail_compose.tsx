// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/mail/compose.astro.
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
 * Compose email — /panel/mail/compose
 * Query params:
 *   from=<accountId>   — sending account
 *   replyTo=<uid>      — reply mode
 *   forward=<uid>      — forward mode
 *   folder=<name>      — source folder for reply/forward/draft
 *   draftUid=<uid>     — edit an existing draft
 */
import PanelLayout from "../module-frame";
import { getPageMessages } from "../view-context";
export default function pages_panel_mail_compose(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["mail"]);
  const { from, replyTo, forward, folder } = Object.fromEntries(
    Astro.url.searchParams,
  );

  return (
    <Fragment>
      <PanelLayout title={t.mail.compose.pageTitle} activeModule="mail">
        <div className="max-w-4xl space-y-4">
          {/** Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href={from ? `/panel/mail/${from}/inbox` : "/panel/mail"}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <i className="ti ti-arrow-left text-base"></i>
              </a>
              <h1 id="compose-title" className="text-lg font-semibold">
                {replyTo
                  ? t.mail.compose.titleReply
                  : forward
                    ? t.mail.compose.titleForward
                    : t.mail.compose.titleNew}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-save-draft"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
              >
                <i className="ti ti-device-floppy text-sm"></i>
                {t.mail.compose.btnSaveDraft}
              </button>
              <button
                id="btn-send"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                <i className="ti ti-send text-sm" id="send-icon"></i>
                <span id="send-text">{t.mail.compose.btnSend}</span>
              </button>
            </div>
          </div>

          {/** Compose form */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <label className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm">
              <input
                id="mail-compose-encrypted"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
              />
              <i className="ti ti-lock" aria-hidden="true"></i>{" "}
              {t.mail.compose.encryptOnSend}
              <span className="text-xs text-muted-foreground">
                {t.mail.compose.encryptRequirements}
              </span>
            </label>

            {/** From selector */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">
                {t.mail.compose.labelFrom}
              </span>
              <select
                id="from-account"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              >
                <option value="">{t.mail.compose.loadingAccounts}</option>
              </select>
            </div>

            {/** To */}
            <div className="flex items-start gap-3 border-b border-border px-5 py-3">
              <span className="text-xs font-medium text-muted-foreground w-12 shrink-0 pt-1.5">
                {t.mail.compose.labelTo}
              </span>
              <div className="flex-1">
                <div id="to-tags" className="flex flex-wrap gap-1.5 mb-1"></div>
                <input
                  id="to-input"
                  type="text"
                  placeholder={t.mail.compose.placeholderTo}
                  className="w-full text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
              <button
                id="btn-toggle-cc"
                className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-1.5"
              >
                {t.mail.compose.btnToggleCc}
              </button>
              <button
                id="btn-toggle-bcc"
                className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-1.5"
              >
                Cco
              </button>
            </div>

            <div
              id="bcc-row"
              className="hidden flex items-center gap-3 border-b border-border px-5 py-3"
            >
              <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">
                Cco
              </span>
              <div className="flex-1">
                <div
                  id="bcc-tags"
                  className="flex flex-wrap gap-1.5 mb-1"
                ></div>
                <input
                  id="bcc-input"
                  type="text"
                  placeholder={t.mail.compose.placeholderTo}
                  className="w-full text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/** CC (hidden by default) */}
            <div
              id="cc-row"
              className="hidden flex items-center gap-3 border-b border-border px-5 py-3"
            >
              <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">
                {t.mail.compose.labelCc}
              </span>
              <div className="flex-1">
                <div id="cc-tags" className="flex flex-wrap gap-1.5 mb-1"></div>
                <input
                  id="cc-input"
                  type="text"
                  placeholder={t.mail.compose.placeholderCc}
                  className="w-full text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/** Subject */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <span className="text-xs font-medium text-muted-foreground w-12 shrink-0">
                {t.mail.compose.labelSubject}
              </span>
              <input
                id="subject"
                type="text"
                placeholder={t.mail.compose.placeholderSubject}
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground font-medium"
              />
            </div>

            {/** Toolbar */}
            <div className="flex items-center gap-1 border-b border-border px-3 py-2">
              {[
                {
                  cmd: "bold",
                  icon: "ti-bold",
                  title: t.mail.compose.toolbarBold,
                },
                {
                  cmd: "italic",
                  icon: "ti-italic",
                  title: t.mail.compose.toolbarItalic,
                },
                {
                  cmd: "underline",
                  icon: "ti-underline",
                  title: t.mail.compose.toolbarUnderline,
                },
                {
                  cmd: "strikeThrough",
                  icon: "ti-strikethrough",
                  title: t.mail.compose.toolbarStrike,
                },
              ].map((btn: any) => (
                <Fragment>
                  <button
                    type="button"
                    data-cmd={btn.cmd}
                    className="format-btn rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title={btn.title}
                  >
                    <i className={`ti ${btn.icon} text-sm`}></i>
                  </button>
                </Fragment>
              ))}
              <div className="h-4 w-px bg-border mx-1"></div>
              {[
                {
                  cmd: "insertUnorderedList",
                  icon: "ti-list",
                  title: t.mail.compose.toolbarList,
                },
                {
                  cmd: "insertOrderedList",
                  icon: "ti-list-numbers",
                  title: t.mail.compose.toolbarOrderedList,
                },
              ].map((btn: any) => (
                <Fragment>
                  <button
                    type="button"
                    data-cmd={btn.cmd}
                    className="format-btn rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title={btn.title}
                  >
                    <i className={`ti ${btn.icon} text-sm`}></i>
                  </button>
                </Fragment>
              ))}
              <div className="h-4 w-px bg-border mx-1"></div>
              <button
                type="button"
                id="btn-attach"
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title={t.mail.compose.toolbarAttach}
              >
                <i className="ti ti-paperclip text-sm"></i>
              </button>
              <input id="file-input" type="file" multiple className="hidden" />
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  id="btn-plain-text"
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  {t.mail.compose.btnPlainText}
                </button>
              </div>
            </div>

            {/** Body: rich text editor */}
            <div
              id="body-rich"
              contentEditable="true"
              className="min-h-64 max-h-[calc(100vh-28rem)] overflow-y-auto px-5 py-4 text-sm focus:outline-none"
              style={cssStyle("word-break: break-word;")}
              data-placeholder={t.mail.compose.placeholderBody}
            ></div>

            {/** Body: plain text fallback */}
            <textarea
              id="body-plain"
              className="hidden min-h-64 w-full px-5 py-4 text-sm bg-transparent resize-y focus:outline-none font-mono"
              placeholder={t.mail.compose.placeholderBody}
            ></textarea>

            {/** Attachments preview */}
            <div
              id="attachments-preview"
              className="hidden border-t border-border px-5 py-3"
            >
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {t.mail.compose.attachmentsLabel}
              </p>
              <div id="attachments-list" className="flex flex-wrap gap-2"></div>
            </div>
          </div>
        </div>

        {/** Toast */}
        <div id="toast" className="fixed bottom-5 right-5 z-50 hidden">
          <div
            id="toast-inner"
            className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
          >
            <i id="toast-icon" className="text-base"></i>
            <span id="toast-msg"></span>
          </div>
        </div>
      </PanelLayout>

      <style>{`{"\\n  @import \\"../../../styles/extracted/pages/panel/mail/compose-style1.css\\";\\n"}`}</style>

      <script
        id="compose-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["mail"]) }}
      ></script>
    </Fragment>
  );
}
