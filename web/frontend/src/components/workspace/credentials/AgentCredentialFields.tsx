import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "../../floating-assistant/i18n";
import { agentsTabFallback } from "../../floating-assistant/agents-tab/messages";
export function AgentCredentialFields({draft,setDraft}:{draft:any;setDraft:(draft:any)=>void}) { const t={editor:mergeNamespaces(agentsTabFallback.editor,useAssistantI18n().agentsTab.editor)}; return (<div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-xs font-medium text-foreground">{t.editor.credentialTitle}</span>
          <p className="text-[11px] text-muted-foreground">{t.editor.credentialHint}</p>
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
            {t.editor.credentialWarn2fa}
          </p>
          {draft.credentialSaved && !draft.credentialClear && !draft.credentialInput ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-muted px-2 py-1 font-mono">
                {formatAssistantMessage(t.editor.credentialSet, { user: draft.credentialSaved.username })}
                {draft.credentialSaved.label ? ` · ${draft.credentialSaved.label}` : ""}
              </span>
              <button
                type="button"
                className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
                onClick={() =>
                  setDraft({
                    ...draft,
                    credentialInput: { label: draft.credentialSaved?.label ?? "", username: draft.credentialSaved?.username ?? "", secret: "" },
                  })
                }
              >
                {t.editor.credentialReplace}
              </button>
              <button
                type="button"
                className="rounded-md border border-input px-2 py-1 text-[11px] text-red-500 hover:bg-muted/50"
                onClick={() => setDraft({ ...draft, credentialClear: true, credentialInput: null })}
              >
                {t.editor.credentialRemove}
              </button>
            </div>
          ) : draft.credentialClear ? (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{t.editor.credentialRemoved}</span>
              <button
                type="button"
                className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
                onClick={() => setDraft({ ...draft, credentialClear: false })}
              >
                {t.editor.credentialCancel}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                autoComplete="off"
                placeholder={t.editor.credentialUser}
                value={draft.credentialInput?.username ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, credentialInput: { label: draft.credentialInput?.label ?? "", username: e.target.value, secret: draft.credentialInput?.secret ?? "" } })
                }
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder={t.editor.credentialPass}
                value={draft.credentialInput?.secret ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, credentialInput: { label: draft.credentialInput?.label ?? "", username: draft.credentialInput?.username ?? "", secret: e.target.value } })
                }
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              <input
                type="text"
                autoComplete="off"
                placeholder={t.editor.credentialLabel}
                value={draft.credentialInput?.label ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, credentialInput: { label: e.target.value, username: draft.credentialInput?.username ?? "", secret: draft.credentialInput?.secret ?? "" } })
                }
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              {draft.credentialSaved && (
                <button
                  type="button"
                  className="self-start rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
                  onClick={() => setDraft({ ...draft, credentialInput: null })}
                >
                  {t.editor.credentialCancel}
                </button>
              )}
            </div>
          )}
        </div>); }
