import React from "react";
import { Search, Terminal, Trash2, X } from "lucide-react";
import type { PanelTaxonomy, SshKeyOption } from "../api/client";
import type { PanelEditorState } from "../features/app/viewModels";
import { getMessages } from "../i18n";
import { SshKeysManagerModal } from "./SshKeysManagerModal";
import { PanelCredentialSection } from "./PanelCredentialSection";
import { PassphraseInput } from "./ui/PassphraseInput";
import type { DataTableSettingsAdvanced } from "./DataTableSettings";
import styles from "./PanelEditorModal.module.css";

export function PanelEditorModal({
  panelEditor,
  taxonomy,
  sshKeys,
  setPanelEditor,
  closePanelEditor,
  submitPanelEditor,
  requestDeletePanel,
  sshAdvanced,
  language,
}: {
  panelEditor: PanelEditorState;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeyOption[];
  setPanelEditor: React.Dispatch<React.SetStateAction<PanelEditorState>>;
  closePanelEditor: () => void;
  submitPanelEditor: () => void;
  requestDeletePanel: () => void;
  /** Contexto para gestionar SSH keys en un modal apilado encima (tab SSH). */
  sshAdvanced?: DataTableSettingsAdvanced;
  language?: string;
}) {
  const t = getMessages(language);

  const isCreate = panelEditor.mode === "create";
  const hasSharedKeys = sshKeys.length > 0;
  const hasCategories = taxonomy.length > 0;
  // Los tags pertenecen a una categoría: solo se listan los tags de la
  // categoría seleccionada. Sin categoría seleccionada → no hay tags que elegir.
  const availableTags = React.useMemo(() => {
    const selected = taxonomy.find((cat) => cat.name === panelEditor.category);
    return selected ? selected.tags : [];
  }, [taxonomy, panelEditor.category]);
  const hasTags = availableTags.length > 0;
  const selectedTagsSet = new Set(panelEditor.tags);
  const selectedKeysSet = new Set(panelEditor.sshKeyIds);
  const portLabel = t.common.port;
  const [activeTab, setActiveTab] = React.useState<"general" | "ssh">("general");
  const [keySearch, setKeySearch] = React.useState("");
  const [sshManagerOpen, setSshManagerOpen] = React.useState(false);

  // Refs para enfocar el campo obligatorio que falló al guardar.
  const ipRef = React.useRef<HTMLInputElement>(null);
  const accessUrlRef = React.useRef<HTMLInputElement>(null);
  const sshUsernameRef = React.useRef<HTMLInputElement>(null);
  const sshKeyRef = React.useRef<HTMLTextAreaElement>(null);
  const sshPassphraseRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!panelEditor.open) return;
    setActiveTab("general");
    setKeySearch("");
    setSshManagerOpen(false);
  }, [panelEditor.open]);

  // Al fallar la validación de un campo obligatorio: cambia a su pestaña y lo
  // enfoca. Los campos SSH viven en el tab "ssh"; IP/subdominio en "general".
  const failedField = panelEditor.failedField;
  React.useEffect(() => {
    if (!failedField) return;
    const sshFields = new Set(["sshUsername", "sshPrivateKey", "sshPassphrase"]);
    const targetTab: "general" | "ssh" = sshFields.has(failedField) ? "ssh" : "general";
    setActiveTab(targetTab);
    // Espera un frame para que el input del tab destino esté montado.
    const id = window.requestAnimationFrame(() => {
      const map = {
        ip: ipRef,
        accessUrl: accessUrlRef,
        sshUsername: sshUsernameRef,
        sshPrivateKey: sshKeyRef,
        sshPassphrase: sshPassphraseRef,
      } as const;
      map[failedField]?.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [failedField]);

  function toggleTag(tagName: string) {
    setPanelEditor((current) => {
      const next = new Set(current.tags);
      if (next.has(tagName)) next.delete(tagName);
      else next.add(tagName);
      return { ...current, tags: Array.from(next) };
    });
  }

  function toggleKey(keyId: string) {
    setPanelEditor((current) => {
      const next = new Set(current.sshKeyIds);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return { ...current, sshKeyIds: Array.from(next) };
    });
  }

  function sanitizeIp(value: string): string {
    const cleaned = value.replace(/[^\d.]/g, "");
    let result = "";
    let groupLen = 0;
    let dots = 0;

    for (const ch of cleaned) {
      if (ch === ".") {
        if (groupLen === 0 || dots >= 3) continue;
        result += ".";
        dots += 1;
        groupLen = 0;
        continue;
      }

      if (groupLen === 3) {
        if (dots >= 3) continue;
        result += ".";
        dots += 1;
        groupLen = 0;
      }

      result += ch;
      groupLen += 1;
    }

    return result;
  }

  function sanitizePort(value: string): string {
    return value.replace(/[^\d]/g, "").slice(0, 5);
  }

  const filteredSshKeys = React.useMemo(() => {
    const search = keySearch.trim().toLowerCase();
    if (!search) return sshKeys;
    return sshKeys.filter((key) => (key.linuxUsername ?? "").toLowerCase().includes(search));
  }, [keySearch, sshKeys]);

  if (!panelEditor.open) return null;

  return (
    <>
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[140] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{isCreate ? t.panelEditor.titleCreate : t.panelEditor.titleEdit}</h3>
          <button type="button" className="lp-modal-close" onClick={closePanelEditor} aria-label={t.panelEditor.closeAria}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-tabs">
          <button
            type="button"
            className={`lp-modal-tab${activeTab === "general" ? " is-active" : ""}`}
            onClick={() => setActiveTab("general")}
          >
            {t.panelEditor.tabGeneral}
          </button>
          <button
            type="button"
            className={`lp-modal-tab${activeTab === "ssh" ? " is-active" : ""}`}
            onClick={() => setActiveTab("ssh")}
          >
            {t.panelEditor.tabSsh}
          </button>
        </div>

        <form
          className="lp-modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            void submitPanelEditor();
          }}
        >
          {activeTab === "general" ? (
            <>
              <div className={`${styles.gridIpRow} grid gap-3`}>
                <div>
                  <label className="lp-modal-label" htmlFor="panel-ip">{t.panelEditor.ipLabel}</label>
                  <input
                    id="panel-ip"
                    ref={ipRef}
                    className={`lp-modal-input${failedField === "ip" ? " lp-modal-input--error" : ""}`}
                    aria-invalid={failedField === "ip" || undefined}
                    type="text"
                    placeholder={t.panelEditor.ipPlaceholder}
                    value={panelEditor.ip}
                    onChange={(event) =>
                      setPanelEditor((current) => ({ ...current, ip: sanitizeIp(event.target.value), failedField: null }))
                    }
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="lp-modal-label" htmlFor="panel-port">{portLabel}</label>
                  <input
                    id="panel-port"
                    className="lp-modal-input"
                    type="text"
                    placeholder="22"
                    value={panelEditor.port}
                    onChange={(event) =>
                      setPanelEditor((current) => ({ ...current, port: sanitizePort(event.target.value) }))
                    }
                    inputMode="numeric"
                    maxLength={5}
                  />
                </div>
              </div>

              {/* URL COMPLETA de acceso al LUXIPANEL (customDomain): esquema y
                  puerto opcionales; reemplaza al subdominio managed retirado. */}
              <div className={styles.accessUrlRow}>
                <label className="lp-modal-label" htmlFor="panel-access-url">{t.panelEditor.accessUrlLabel}</label>
                <input
                  id="panel-access-url"
                  ref={accessUrlRef}
                  className={`lp-modal-input${failedField === "accessUrl" ? " lp-modal-input--error" : ""}`}
                  aria-invalid={failedField === "accessUrl" || undefined}
                  type="text"
                  maxLength={255}
                  placeholder={t.panelEditor.accessUrlPlaceholder}
                  value={panelEditor.accessUrl}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(event) =>
                    setPanelEditor((current) => ({ ...current, accessUrl: event.target.value, failedField: null }))
                  }
                />
              </div>

              {hasCategories || hasTags ? (
                <div className={`${styles.categorySection} grid grid-cols-1 gap-3 md:grid-cols-2`}>
                  {hasCategories ? (
                    <div>
                      <label className="lp-modal-label" htmlFor="panel-category">{t.panelEditor.categoryLabel}</label>
                      <select
                        id="panel-category"
                        className="lp-modal-select"
                        value={panelEditor.category}
                        onChange={(event) => {
                          const nextCategory = event.target.value;
                          // Al cambiar de categoría, conserva solo los tags que
                          // pertenezcan a la nueva (los demás dejan de aplicar).
                          const allowed = new Set(
                            (taxonomy.find((c) => c.name === nextCategory)?.tags ?? []).map((tg) => tg.name),
                          );
                          setPanelEditor((current) => ({
                            ...current,
                            category: nextCategory,
                            tags: current.tags.filter((name) => allowed.has(name)),
                          }));
                        }}
                      >
                        <option value="">{t.panelEditor.categoryEmpty}</option>
                        {taxonomy.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {hasTags ? (
                    <div>
                      <span className="lp-modal-label">{t.panelEditor.tagsLabel}</span>
                      <div className="lp-modal-checklist" role="group" aria-label={t.panelEditor.tagsAria}>
                        {availableTags.map((tag) => (
                          <label key={tag.id} className="lp-modal-chip">
                            <input
                              type="checkbox"
                              checked={selectedTagsSet.has(tag.name)}
                              onChange={() => toggleTag(tag.name)}
                            />
                            <span>{tag.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Credencial de conexión por-panel (lxp_live_): solo al EDITAR un
                  panel existente (necesita panelId). Ver/rotar/copiar/revocar. */}
              {!isCreate && panelEditor.panelId ? (
                <PanelCredentialSection panelId={panelEditor.panelId} language={language} />
              ) : null}

            </>
          ) : (
            <>
              {!hasSharedKeys ? (
                <>
                  <div>
                    <label className="lp-modal-label" htmlFor="panel-ssh-username">{t.panelEditor.sshUserLabel}</label>
                    <input
                      id="panel-ssh-username"
                      ref={sshUsernameRef}
                      className={`lp-modal-input${failedField === "sshUsername" ? " lp-modal-input--error" : ""}`}
                      aria-invalid={failedField === "sshUsername" || undefined}
                      type="text"
                      maxLength={64}
                      autoCapitalize="none"
                      placeholder={t.panelEditor.sshUserPlaceholder}
                      value={panelEditor.sshUsername}
                      onChange={(event) =>
                        setPanelEditor((current) => ({ ...current, sshUsername: event.target.value, failedField: null }))
                      }
                      onBlur={(event) =>
                        setPanelEditor((current) => ({ ...current, sshUsername: event.target.value.trim() }))
                      }
                    />
                    <p className="lp-modal-hint">
                      {t.panelEditor.sshUserHintBefore} <code>~/.ssh/authorized_keys</code> {t.panelEditor.sshUserHintAfter}
                    </p>
                  </div>
                  <div>
                    <label className="lp-modal-label" htmlFor="panel-ssh-key">{t.panelEditor.firstKeyLabel}</label>
                    <textarea
                      id="panel-ssh-key"
                      ref={sshKeyRef}
                      className={`lp-modal-textarea${failedField === "sshPrivateKey" ? " lp-modal-input--error" : ""}`}
                      aria-invalid={failedField === "sshPrivateKey" || undefined}
                      placeholder={t.panelEditor.firstKeyPlaceholder}
                      value={panelEditor.sshPrivateKey}
                      onChange={(event) =>
                        setPanelEditor((current) => ({ ...current, sshPrivateKey: event.target.value, failedField: null }))
                      }
                    />
                    <p className="lp-modal-hint">
                      {isCreate ? t.panelEditor.firstKeyHintCreate : t.panelEditor.firstKeyHintExisting}
                    </p>
                  </div>
                  <div>
                    <label className="lp-modal-label" htmlFor="panel-ssh-passphrase">{t.panelEditor.passphraseLabel}</label>
                    <PassphraseInput
                      id="panel-ssh-passphrase"
                      inputRef={sshPassphraseRef}
                      ariaInvalid={failedField === "sshPassphrase"}
                      className={`lp-modal-input${failedField === "sshPassphrase" ? " lp-modal-input--error" : ""}`}
                      placeholder={t.panelEditor.passphrasePlaceholder}
                      value={panelEditor.sshPassphrase}
                      onChange={(value) =>
                        setPanelEditor((current) => ({ ...current, sshPassphrase: value, failedField: null }))
                      }
                      ariaShow={t.connectLocalKey.showPassphraseAria}
                      ariaHide={t.connectLocalKey.hidePassphraseAria}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <p className={`${styles.keysHint} lp-modal-hint`}>
                    {t.panelEditor.panelKeysHint}
                  </p>
                  <div className="lp-modal-search-row">
                    <div className="lp-modal-search">
                      <Search size={14} />
                      <input
                        type="text"
                        placeholder={t.panelEditor.sshUserPlaceholder}
                        value={keySearch}
                        autoCapitalize="none"
                        onChange={(event) => setKeySearch(event.target.value)}
                      />
                    </div>
                    {sshAdvanced ? (
                      <button
                        type="button"
                        className={`${styles.manageSshBtn} lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm lp-modal-btn--icon`}
                        onClick={() => setSshManagerOpen(true)}
                      >
                        <Terminal size={14} />
                        {t.panelEditor.manageSshKeys}
                      </button>
                    ) : null}
                  </div>
                  <div
                    className="lp-modal-checklist lp-modal-checklist--column"
                    role="group"
                    aria-label={t.panelEditor.panelKeysAria}
                  >
                    {filteredSshKeys.map((key) => (
                      <label key={key.id} className="lp-modal-key-row">
                        <input
                          type="checkbox"
                          checked={selectedKeysSet.has(key.id)}
                          onChange={() => toggleKey(key.id)}
                        />
                        <span>
                          <span className="lp-modal-key-row__user">
                            {key.linuxUsername || t.panelEditor.noSshUser}
                          </span>
                          {key.fingerprint ? (
                            <span className="lp-modal-key-row__meta">{key.fingerprint}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {panelEditor.error ? <p className="lp-modal-error">{panelEditor.error}</p> : null}
        </form>

        <div className="lp-modal-footer">
          {!isCreate ? (
            <button
              type="button"
              className={`${styles.deleteBtn} lp-icon-btn is-danger tooltip tooltip-top`}
              disabled={panelEditor.saving}
              onClick={requestDeletePanel}
              aria-label={t.panelTable.actions.delete}
              data-tip={t.panelTable.actions.delete}
            >
              <Trash2 size={15} />
            </button>
          ) : null}
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={closePanelEditor}>
            {t.panelEditor.cancel}
          </button>
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary"
            disabled={panelEditor.saving}
            onClick={() => void submitPanelEditor()}
          >
            <Terminal size={15} /> {panelEditor.saving ? t.panelEditor.testingConnection : t.panelEditor.testConnection}
          </button>
        </div>
      </div>
    </div>
    {sshAdvanced ? (
      <SshKeysManagerModal
        open={sshManagerOpen}
        onClose={() => setSshManagerOpen(false)}
        advanced={sshAdvanced}
        language={language}
      />
    ) : null}
    </>
  );
}
