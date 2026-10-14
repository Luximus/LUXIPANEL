export function GitCredentialFields({ t }: { t: any }) {
  return (<div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                <div className="space-y-4 p-5">
                  <h3 className="text-sm font-semibold">{t.files.gitCreds.title}</h3>
                  <p className="text-xs text-muted-foreground">{t.files.gitCreds.securityNote}</p>
                  {/** Credenciales/identidades git YA configuradas en el servidor
             (solo lectura, sin secretos): se usan automáticamente para
             clonar/actualizar repos. `credentials-script1.ts` lo rellena
             desde GET /api/files/git/detect. */}
                  <div id="git-detected" className="space-y-2"></div>
                  <div
                    id="git-creds-list"
                    className="max-h-56 overflow-y-auto"
                  ></div>
                  <form
                    id="form-git-creds"
                    className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="git-cred-label"
                        type="text"
                        placeholder={t.files.gitCreds.placeholderLabel}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm"
                      />
                      <select
                        id="git-cred-type"
                        className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                      >
                        <option value="https">
                          {t.files.gitCreds.optionHttps}
                        </option>
                        <option value="ssh">
                          {t.files.gitCreds.optionSsh}
                        </option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id="git-cred-host"
                        type="text"
                        placeholder={t.files.gitCreds.placeholderHost}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm"
                      />
                      <input
                        id="git-cred-user"
                        type="text"
                        placeholder={t.files.gitCreds.placeholderUser}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm"
                      />
                    </div>
                    <textarea
                      id="git-cred-secret"
                      rows={3}
                      placeholder={t.files.gitCreds.placeholderSecret}
                      className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs"
                    ></textarea>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        id="git-cred-cancel"
                        className="hidden h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
                      >
                        {t.files.gitCreds.btnClose}
                      </button>
                      <button
                        type="submit"
                        id="git-cred-submit"
                        className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {t.files.gitCreds.btnSave}
                      </button>
                    </div>
                  </form>
                  {/** Gestor GitHub · SSH (diagnóstico de llaves, test, ~/.ssh/config, core.sshCommand) */}
                  <div className="border-t border-border pt-4">
                    <button
                      type="button"
                      id="btn-git-ssh-open"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent"
                    >
                      <i className="ti ti-brand-github text-base"></i>{" "}
                      {t.repositoryStore.sshDialog.manageButton}
                    </button>
                  </div>
                </div>
              </div>);
}
