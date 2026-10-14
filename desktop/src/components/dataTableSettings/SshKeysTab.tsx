import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../DataTableSettings.module.css";
import { formatMessage, type Messages } from "../../i18n";
import {
  createSshKey,
  deleteSshKey,
  updateSshKeyApi,
} from "../../api/client";
import DataTable, { type DataTableQuickActionConfig } from "../DataTable";
import { useConfirm } from "../ConfirmDialog";
import { useToast } from "../ToastProvider";
import { PassphraseInput } from "../ui/PassphraseInput";
import type { DataTableSettingsAdvanced, SshKeyRow } from "./types";
import {
  AccordionSection,
  DocLink,
  InlineAlert,
  docUrl,
  getSettingsSshKeysColumns,
  getSettingsSshKeysFilters,
  getSettingsSshKeysRowActions,
} from "./shared";

export function SshKeysTab({ advanced, t, language, fillHeight = false }: { advanced: DataTableSettingsAdvanced; t: Messages; language?: string; fillHeight?: boolean }) {
  const { token, sshKeys, applySshKeyCreated, applySshKeyUpdated, applySshKeyDeleted } = advanced;
  const { confirm, dialog: confirmDialog } = useConfirm();
  const toast = useToast();
  const [linuxUsername, setLinuxUsername] = useState("");
  const [keyContent, setKeyContent] = useState("");
  const [keyPassphrase, setKeyPassphrase] = useState("");
  // Accordion controlado: tras registrar se abre "Tabla de registros".
  const [section, setSection] = useState<"form" | "records">("records");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Foco/resalte del primer campo obligatorio que falte (crear + editar).
  const userRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLTextAreaElement>(null);
  const passphraseRef = useRef<HTMLInputElement>(null);
  const editUserRef = useRef<HTMLInputElement>(null);
  const [invalidField, setInvalidField] = useState<"user" | "key" | "passphrase" | "editUser" | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    linuxUsername: string;
    sshKey: string;
    passphrase: string;
  } | null>(null);

  const rows: SshKeyRow[] = useMemo(
    () =>
      sshKeys.map((key) => {
        const username = key.linuxUsername ?? key.nickname ?? t.dataTableSettings.sshKeysTab.fallbackUser;
        const fingerprint = key.fingerprint ?? "—";
        const panelsCount = key.panelsCount ?? 0;
        return {
          id: key.id,
          linuxUsername: username,
          fingerprint,
          panelsCount,
          searchBlob: `${username} ${fingerprint}`.toLowerCase(),
        };
      }),
    [sshKeys],
  );

  async function handleCreate() {
    // Mensaje de error que nombra exactamente los campos que faltan.
    const missing: string[] = [];
    if (!linuxUsername.trim()) missing.push(t.dataTableSettings.subTables.sshUserHeader);
    if (!keyContent.trim()) missing.push(t.dataTableSettings.sshKeysTab.fieldPrivateKey);
    if (!keyPassphrase.trim()) missing.push("Passphrase");
    if (missing.length > 0) {
      setError(formatMessage(t.dataTableSettings.sshKeysTab.missingFieldsNamed, { fields: missing.join(", ") }));
      // Enfoca + resalta el PRIMER campo obligatorio que falte (de arriba a abajo).
      setSection("form");
      const first: "user" | "key" | "passphrase" = !linuxUsername.trim() ? "user" : !keyContent.trim() ? "key" : "passphrase";
      setInvalidField(first);
      window.requestAnimationFrame(() => {
        const map = { user: userRef, key: keyRef, passphrase: passphraseRef } as const;
        map[first].current?.focus();
      });
      return;
    }
    setInvalidField(null);
    setBusy(true);
    setError("");
    try {
      const { key } = await createSshKey(
        { linuxUsername: linuxUsername.trim(), sshKey: keyContent, passphrase: keyPassphrase },
        token,
      );
      if (key) applySshKeyCreated(key);
      setLinuxUsername("");
      setKeyContent("");
      setKeyPassphrase("");
      setSection("records");
      toast.success(t.toast.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.common.confirm,
      message: t.dataTableSettings.sshKeysTab.confirmDelete,
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    // El gate 2FA (ssh.delete) lo maneja el reintento central de `request`.
    setBusy(true);
    try {
      await deleteSshKey(id, token);
      applySshKeyDeleted(id);
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMany(rows: SshKeyRow[]) {
    if (rows.length === 0) return;
    const ok = await confirm({
      title: t.common.confirm,
      message: formatMessage(t.common.confirmDeleteSelected, { count: String(rows.length) }),
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    // El gate 2FA (ssh.delete) lo maneja el reintento central de `request`.
    setBusy(true);
    setError("");
    try {
      for (const row of rows) {
        await deleteSshKey(row.id, token);
        applySshKeyDeleted(row.id);
      }
      toast.success(t.toast.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const bulkActions: DataTableQuickActionConfig<SshKeyRow>[] = [
    {
      id: "delete_selected",
      label: t.common.deleteSelected,
      requiresSelection: true,
      variant: "danger",
      onClick: (rows) => void handleDeleteMany(rows),
    },
  ];

  function handleSaveEdit() {
    if (!editing) return;
    const ed = editing;
    if (!ed.linuxUsername.trim()) {
      setError(t.dataTableSettings.subTables.fieldRequired);
      setInvalidField("editUser");
      editUserRef.current?.focus();
      return;
    }
    setInvalidField(null);
    // El gate 2FA (ssh.edit) lo maneja el reintento central de `request`.
    void (async () => {
      setBusy(true);
      setError("");
      try {
        const payload: { linuxUsername?: string; sshKey?: string; passphrase?: string } = {
          linuxUsername: ed.linuxUsername.trim(),
        };
        // Campos opcionales: solo se envían si el usuario escribió algo
        // (vacío = mantener la llave/passphrase actuales).
        if (ed.sshKey.trim()) payload.sshKey = ed.sshKey.trim();
        if (ed.passphrase.trim()) payload.passphrase = ed.passphrase;
        const { key } = await updateSshKeyApi(ed.id, payload, token);
        if (key) applySshKeyUpdated(key);
        setEditing(null);
        toast.success(t.toast.saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.error);
      } finally {
        setBusy(false);
      }
    })();
  }

  function handleRowAction(actionId: string, row: SshKeyRow) {
    if (actionId === "edit_ssh_key") {
      const original = sshKeys.find((k) => k.id === row.id);
      setEditing({
        id: row.id,
        linuxUsername: original?.linuxUsername ?? "",
        sshKey: "",
        passphrase: "",
      });
    } else if (actionId === "delete_ssh_key") {
      void handleDelete(row.id);
    }
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" : "space-y-2"}>
      <h4 className={`lp-modal-label ${styles.tabHeading}`}>{t.dataTableSettings.sshKeysTab.heading}</h4>
      <p className="text-xs opacity-70">
        {t.dataTableSettings.sshKeysTab.help}{" "}
        <DocLink href={docUrl("/documentation/ssh")} label={t.dataTableSettings.sshKeysTab.docsLink} />
      </p>

      <InlineAlert message={error} />

      <AccordionSection
        groupName="acc-ssh-keys"
        title={t.dataTableSettings.accordion.registerSshKey}
        open={section === "form"}
        onOpen={() => setSection("form")}
      >
        <div className="flex gap-2">
          <input
            ref={userRef}
            className={`lp-modal-input flex-1${invalidField === "user" ? " lp-modal-input--error" : ""}`}
            aria-invalid={invalidField === "user" || undefined}
            type="text"
            maxLength={64}
            placeholder={t.dataTableSettings.sshKeysTab.sshUserPlaceholder}
            value={linuxUsername}
            onChange={(event) => { setLinuxUsername(event.target.value.replace(/^\s+/, "")); if (invalidField === "user") setInvalidField(null); }}
            onBlur={(event) => setLinuxUsername(event.target.value.trim())}
          />
          <button
            type="button"
            className="lp-modal-btn lp-modal-btn--primary shrink-0"
            onClick={handleCreate}
            disabled={busy}
          >
            {t.dataTableSettings.sshKeysTab.register}
          </button>
        </div>
        <textarea
          ref={keyRef}
          className={`lp-modal-textarea${invalidField === "key" ? " lp-modal-input--error" : ""}`}
          aria-invalid={invalidField === "key" || undefined}
          placeholder={t.dataTableSettings.sshKeysTab.keyPlaceholder}
          value={keyContent}
          onChange={(event) => { setKeyContent(event.target.value); if (invalidField === "key") setInvalidField(null); }}
        />
        <PassphraseInput
          inputRef={passphraseRef}
          ariaInvalid={invalidField === "passphrase"}
          className={`lp-modal-input${invalidField === "passphrase" ? " lp-modal-input--error" : ""}`}
          placeholder={t.connectLocalKey.passphraseLabel}
          value={keyPassphrase}
          onChange={(value) => { setKeyPassphrase(value); if (invalidField === "passphrase") setInvalidField(null); }}
          ariaShow={t.connectLocalKey.showPassphraseAria}
          ariaHide={t.connectLocalKey.hidePassphraseAria}
        />
      </AccordionSection>

      {editing
        ? createPortal(
            <div
              className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4"
            >
              <div
                className="lp-modal-card flex max-h-full w-full max-w-lg flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="lp-modal-header">
                  <h3 className="lp-modal-title">{t.common.edit}</h3>
                  <button
                    type="button"
                    className="lp-modal-close"
                    onClick={() => setEditing(null)}
                    aria-label={t.dataTableSettings.closeAria}
                  >
                    ✕
                  </button>
                </div>

                <div className="lp-modal-body space-y-2">
                  <input
                    ref={editUserRef}
                    className={`lp-modal-input${invalidField === "editUser" ? " lp-modal-input--error" : ""}`}
                    aria-invalid={invalidField === "editUser" || undefined}
                    placeholder={t.dataTableSettings.sshKeysTab.sshUserPlaceholder}
                    value={editing.linuxUsername}
                    onChange={(event) => { setEditing({ ...editing, linuxUsername: event.target.value }); if (invalidField === "editUser") setInvalidField(null); }}
                  />
                  <textarea
                    className="lp-modal-textarea"
                    placeholder={t.dataTableSettings.sshKeysTab.keyPlaceholder}
                    value={editing.sshKey}
                    onChange={(event) => setEditing({ ...editing, sshKey: event.target.value })}
                  />
                  <PassphraseInput
                    placeholder={t.connectLocalKey.passphraseLabel}
                    value={editing.passphrase}
                    onChange={(value) => setEditing({ ...editing, passphrase: value })}
                    ariaShow={t.connectLocalKey.showPassphraseAria}
                    ariaHide={t.connectLocalKey.hidePassphraseAria}
                  />
                </div>

                <div className="lp-modal-footer">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setEditing(null)}>
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="lp-modal-btn lp-modal-btn--primary"
                    onClick={handleSaveEdit}
                    disabled={busy}
                  >
                    {t.common.save}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <AccordionSection
        groupName="acc-ssh-keys"
        title={t.dataTableSettings.accordion.viewSshKeys}
        open={section === "records"}
        onOpen={() => setSection("records")}
      >
        <DataTable
          tableId="data-table-settings-ssh-keys"
          title={t.dataTableSettings.sshKeysTab.tableTitle}
          columns={getSettingsSshKeysColumns(t)}
          data={rows}
          filters={getSettingsSshKeysFilters(t)}
          rowActions={getSettingsSshKeysRowActions(t)}
          quickActions={bulkActions}
          pageSizeOptions={[5, 10, 20]}
          language={language}
          onRowAction={handleRowAction}
          inlineToolbar
        />
      </AccordionSection>
      {confirmDialog}
    </div>
  );
}
