import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Upload, X } from "lucide-react";
import styles from "./ImportExportModal.module.css";
import {
  createPanel,
  createPanelCategory,
  createPanelTag,
  createSshKey,
  exportPanelData,
  type PanelDataExport,
} from "../api/client";
import { formatMessage, getMessages } from "../i18n";
import { PassphraseInput } from "./ui/PassphraseInput";

type Mode = "export" | "import";

type Selection = {
  panels: boolean;
  taxonomy: boolean;
  ssh: boolean;
};

type ImportSummary = {
  panelsCreated: number;
  sshCreated: number;
  failures: number;
};

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  token: string;
  language?: string;
  onAfterImport?: () => void;
};

const DEFAULT_SELECTION: Selection = { panels: true, taxonomy: true, ssh: false };

export function ImportExportModal({ open, mode, onClose, token, language, onAfterImport }: Props) {
  const t = getMessages(language);
  const tr = t.importExport;

  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  // El export NO incluye la passphrase de las llaves (se omite por seguridad),
  // pero el backend la exige al recrearlas. Una passphrase compartida se aplica
  // a todas las llaves importadas.
  const [importPassphrase, setImportPassphrase] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Resalta + enfoca el botón de selección de archivo cuando se intenta
  // importar sin haber elegido uno.
  const pickFileRef = useRef<HTMLButtonElement | null>(null);
  const [fileInvalid, setFileInvalid] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelection(DEFAULT_SELECTION);
      setBusy(false);
      setError("");
      setFile(null);
      setSummary(null);
      setImportPassphrase("");
      setFileInvalid(false);
    }
  }, [open]);

  if (!open) return null;

  function toggle(key: keyof Selection) {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function downloadJson(payload: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function runExport() {
    if (!selection.panels && !selection.taxonomy && !selection.ssh) {
      setError(tr.errors.noSelection);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await exportPanelData(
        {
          includePanels: selection.panels,
          includeTaxonomy: selection.taxonomy,
          includeSsh: selection.ssh,
        },
        token,
      );
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(data, `luxipanel-servers-${date}.json`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr.errors.exportFailed);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) {
      setError(tr.errors.readFailed);
      setFileInvalid(true);
      pickFileRef.current?.focus();
      return;
    }
    setFileInvalid(false);
    setError("");
    setBusy(true);
    setSummary(null);
    try {
      const text = await file.text();
      let parsed: PanelDataExport;
      try {
        parsed = JSON.parse(text) as PanelDataExport;
      } catch {
        setError(tr.errors.invalidFile);
        setBusy(false);
        return;
      }
      if (!parsed || typeof parsed !== "object" || (!Array.isArray(parsed.panels) && !Array.isArray(parsed.sshKeys) && !Array.isArray(parsed.taxonomy))) {
        setError(tr.errors.invalidFile);
        setBusy(false);
        return;
      }

      const stats: ImportSummary = { panelsCreated: 0, sshCreated: 0, failures: 0 };

      // 1) Recreate categories + tags first so panels can reference them.
      if (selection.taxonomy && Array.isArray(parsed.taxonomy)) {
        for (const cat of parsed.taxonomy) {
          if (!cat?.name) continue;
          try {
            const created = await createPanelCategory(cat.name, token);
            const categoryId = created?.category?.id;
            if (categoryId && Array.isArray(cat.tags)) {
              for (const tagName of cat.tags) {
                if (!tagName) continue;
                try {
                  await createPanelTag(categoryId, tagName, token);
                } catch {
                  stats.failures += 1;
                }
              }
            }
          } catch {
            stats.failures += 1;
          }
        }
      }

      // 2) SSH keys must be created BEFORE panels so we can attach them.
      const sshKeyIdMap = new Map<string, string>(); // export id → new id
      if (selection.ssh && Array.isArray(parsed.sshKeys)) {
        for (const key of parsed.sshKeys) {
          if (!key?.privateKey || !key?.linuxUsername) continue;
          try {
            const result = await createSshKey(
              { sshKey: key.privateKey, linuxUsername: key.linuxUsername, passphrase: importPassphrase },
              token,
            );
            if (result?.key?.id && key.id) {
              sshKeyIdMap.set(key.id, result.key.id);
            }
            stats.sshCreated += 1;
          } catch {
            stats.failures += 1;
          }
        }
      }

      // 3) Panels — only metadata is recreated. SSH attachment to panel needs a
      //    follow-up configurePanelSsh call that requires IP+username, so we
      //    leave the panel created and let the user finish SSH setup manually.
      if (selection.panels && Array.isArray(parsed.panels)) {
        for (const panel of parsed.panels) {
          try {
            await createPanel(
              {
                serverIp: panel?.serverIp ?? undefined,
                category: panel?.panelCategory ?? undefined,
                tags: Array.isArray(panel?.panelTags) ? panel?.panelTags?.join(",") : undefined,
                customDomain: panel?.customDomain ?? undefined,
              },
              token,
            );
            stats.panelsCreated += 1;
          } catch {
            stats.failures += 1;
          }
        }
      }

      setSummary(stats);
      onAfterImport?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr.errors.importFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4"
    >
      <div
        className="lp-modal-card flex max-h-full w-full max-w-xl flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{mode === "export" ? tr.exportTitle : tr.importTitle}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body">
          <p className={styles.subtitle}>
            {mode === "export" ? tr.exportSubtitle : tr.importSubtitle}
          </p>

          <div>
            <p className="lp-modal-label">{tr.sectionsTitle}</p>
            <div className="flex flex-col gap-2">
              <label className={`lp-modal-key-row ${styles.checkboxLabel}`}>
                <input
                  type="checkbox"
                  checked={selection.panels}
                  onChange={() => toggle("panels")}
                  className={styles.checkboxInput}
                />
                <span className={`lp-modal-key-row__user ${styles.checkboxSpan}`}>{tr.panelsLabel}</span>
              </label>
              <label className={`lp-modal-key-row ${styles.checkboxLabel}`}>
                <input
                  type="checkbox"
                  checked={selection.taxonomy}
                  onChange={() => toggle("taxonomy")}
                  className={styles.checkboxInput}
                />
                <span className={`lp-modal-key-row__user ${styles.checkboxSpan}`}>{tr.taxonomyLabel}</span>
              </label>
              <label className={`lp-modal-key-row ${styles.checkboxLabel}`}>
                <input
                  type="checkbox"
                  checked={selection.ssh}
                  onChange={() => toggle("ssh")}
                  className={styles.checkboxInput}
                />
                <span className={`lp-modal-key-row__user ${styles.checkboxSpan}`}>{tr.sshLabel}</span>
              </label>
              {selection.ssh ? (
                <p className={`lp-modal-hint ${styles.sshWarning}`}>{tr.sshWarning}</p>
              ) : null}
            </div>
          </div>

          {mode === "import" ? (
            <div>
              <p className="lp-modal-label">{tr.fileLabel}</p>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setSummary(null);
                  if (next && fileInvalid) setFileInvalid(false);
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  ref={pickFileRef}
                  type="button"
                  className={`lp-modal-btn lp-modal-btn--ghost${fileInvalid ? " lp-modal-input--error" : ""}`}
                  aria-invalid={fileInvalid || undefined}
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <FileUp size={16} />
                  {tr.pickFile}
                </button>
                <span className={`lp-modal-hint ${styles.fileNameHint}`}>
                  {file ? file.name : tr.noFileSelected}
                </span>
              </div>
              <p className="lp-modal-hint">{tr.fileHint}</p>
            </div>
          ) : null}

          {mode === "import" && selection.ssh ? (
            <div>
              <p className="lp-modal-label">{t.connectLocalKey.passphraseLabel}</p>
              <PassphraseInput
                placeholder={t.connectLocalKey.passphrasePlaceholder}
                value={importPassphrase}
                onChange={setImportPassphrase}
                ariaShow={t.connectLocalKey.showPassphraseAria}
                ariaHide={t.connectLocalKey.hidePassphraseAria}
              />
            </div>
          ) : null}

          {summary ? (
            <div className={`rounded-lg border p-3 ${styles.summaryBox}`}>
              <p className={`lp-modal-label ${styles.summaryTitle}`}>{tr.summaryTitle}</p>
              <ul className={`m-0 list-none p-0 ${styles.summaryList}`}>
                <li>{formatMessage(tr.summaryPanelsCreated, { count: summary.panelsCreated })}</li>
                <li>{formatMessage(tr.summarySshCreated, { count: summary.sshCreated })}</li>
                <li>{formatMessage(tr.summaryFailures, { count: summary.failures })}</li>
              </ul>
            </div>
          ) : null}

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={busy}>
            {tr.cancel}
          </button>
          {mode === "export" ? (
            <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={runExport} disabled={busy}>
              <Download size={16} />
              {busy ? tr.exporting : tr.exportAction}
            </button>
          ) : (
            <button
              type="button"
              className="lp-modal-btn lp-modal-btn--primary"
              onClick={runImport}
              disabled={busy || !file}
            >
              <Upload size={16} />
              {busy ? tr.importing : tr.importAction}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
