import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatMessage, getMessages } from "../../i18n";
import {
  createPremiumModule, updatePremiumModule,
  type PremiumModule, type PremiumModulePayload,
} from "../../api/admin";
import styles from "./AdminModuleModal.module.css";

type FailedField = "code" | "configSchema" | null;

function parseFeatures(value: string): string[] {
  return value.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

function parseConfigSchema(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export function AdminModuleModal({
  open,
  module,
  token,
  language,
  onClose,
  onSaved,
}: {
  open: boolean;
  module: PremiumModule | null;
  token: string;
  language: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = getMessages(language);
  const a = t.admin;
  const isEditing = Boolean(module);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("free");
  const [kind, setKind] = useState("module");
  const [version, setVersion] = useState("1.0.0");
  const [rating, setRating] = useState("0");
  const [createdBy, setCreatedBy] = useState("system");
  const [scriptPath, setScriptPath] = useState("");
  const [scriptHash, setScriptHash] = useState("");
  const [features, setFeatures] = useState("");
  const [configSchema, setConfigSchema] = useState("");
  const [status, setStatus] = useState<"active" | "disabled">("active");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<FailedField>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const schemaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setFailed(null);
    if (module) {
      setCode(module.code);
      setName(module.name ?? "");
      setDescription(module.description ?? "");
      setCategory(module.category ?? "");
      setTag(module.tag ?? "free");
      setKind(module.kind ?? "module");
      setVersion(module.version ?? "1.0.0");
      setRating(String(module.rating ?? 0));
      setCreatedBy(module.createdBy ?? "system");
      setScriptPath(module.scriptPath ?? "");
      setScriptHash(module.scriptHash ?? "");
      setFeatures((module.features ?? []).join("\n"));
      setConfigSchema(module.configSchema ? JSON.stringify(module.configSchema, null, 2) : "");
      setStatus(module.status === "disabled" ? "disabled" : "active");
    } else {
      setCode(""); setName(""); setDescription(""); setCategory(""); setTag("free"); setKind("module");
      setVersion("1.0.0"); setRating("0"); setCreatedBy("system"); setScriptPath(""); setScriptHash("");
      setFeatures(""); setConfigSchema(""); setStatus("active");
    }
  }, [open, module]);

  useEffect(() => {
    if (failed === "code") codeRef.current?.focus();
    else if (failed === "configSchema") schemaRef.current?.focus();
  }, [failed]);


  if (!open) return null;

  const submit = async () => {
    setError("");
    const schemaResult = parseConfigSchema(configSchema);
    if (!schemaResult.ok) { setFailed("configSchema"); setError(formatMessage(a.configSchemaInvalid, { error: schemaResult.error })); return; }

    const base: Omit<PremiumModulePayload, "code"> = {
      name: name.trim() || undefined,
      description,
      category: category.trim() || undefined,
      tag: tag || "free",
      kind: kind || "module",
      version: version.trim() || "1.0.0",
      rating: Number(rating) || 0,
      createdBy: createdBy.trim() || "system",
      scriptPath: scriptPath.trim() || null,
      scriptHash: scriptHash.trim() || null,
      features: parseFeatures(features),
      configSchema: schemaResult.data,
      status,
    };

    setSaving(true);
    try {
      if (isEditing && module) {
        await updatePremiumModule(module.id, base, token);
      } else {
        const codeValue = code.trim();
        if (!codeValue) { setFailed("code"); setError(a.moduleCodeRequired); setSaving(false); return; }
        await createPremiumModule({ ...base, code: codeValue }, token);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : a.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal-header">
          <h3 className="lp-modal-title">{isEditing ? `${a.editModule} · ${module?.code ?? ""}` : a.createModule}</h3>
          <button type="button" className="lp-modal-close" onClick={onClose} aria-label={a.close} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        <div className={`lp-modal-body ${styles.body}`}>
          <div className={styles.grid2}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldCode}</span>
              <input
                ref={codeRef}
                className={`lp-modal-input${failed === "code" ? " lp-modal-input--error" : ""}`}
                aria-invalid={failed === "code" || undefined}
                type="text"
                value={code}
                // El código no se edita tras crear (deshabilitado al editar).
                disabled={saving || isEditing}
                onChange={(e) => { setCode(e.target.value); setFailed(null); }}
              />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldModuleName}</span>
              <input className="lp-modal-input" type="text" value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
            </label>
          </div>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldModuleDescription}</span>
            <textarea className={`lp-modal-input ${styles.resizable}`} rows={2} value={description} disabled={saving} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className={styles.grid3}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldCategory}</span>
              <input className="lp-modal-input" type="text" value={category} disabled={saving} onChange={(e) => setCategory(e.target.value)} />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldTag}</span>
              <select className="lp-modal-input" value={tag} disabled={saving} onChange={(e) => setTag(e.target.value)}>
                <option value="free">{a.tagFree}</option>
                <option value="premium">{a.tagPremium}</option>
              </select>
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldKind}</span>
              <select className="lp-modal-input" value={kind} disabled={saving} onChange={(e) => setKind(e.target.value)}>
                <option value="module">{a.kindModule}</option>
                <option value="mcp_server">{a.kindMcp}</option>
              </select>
            </label>
          </div>

          <div className={styles.grid3}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldVersion}</span>
              <input className="lp-modal-input" type="text" value={version} disabled={saving} onChange={(e) => setVersion(e.target.value)} />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldRating}</span>
              <input className="lp-modal-input" type="number" min={0} max={5} step="0.1" value={rating} disabled={saving} onChange={(e) => setRating(e.target.value)} />
            </label>
          </div>

          <div className={styles.grid2}>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldScriptPath}</span>
              <input className="lp-modal-input" type="text" value={scriptPath} disabled={saving} onChange={(e) => setScriptPath(e.target.value)} />
            </label>
            <label className={`lp-modal-label ${styles.label}`}>
              <span>{a.fieldScriptHash}</span>
              <input className="lp-modal-input" type="text" value={scriptHash} disabled={saving} onChange={(e) => setScriptHash(e.target.value)} />
            </label>
          </div>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldFeatures}</span>
            <textarea className={`lp-modal-input ${styles.resizable}`} rows={3} value={features} disabled={saving} onChange={(e) => setFeatures(e.target.value)} />
          </label>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldConfigSchema}</span>
            <textarea
              ref={schemaRef}
              className={`lp-modal-input ${styles.schemaTextarea}${failed === "configSchema" ? " lp-modal-input--error" : ""}`}
              aria-invalid={failed === "configSchema" || undefined}
              rows={4}
              value={configSchema}
              disabled={saving}
              onChange={(e) => { setConfigSchema(e.target.value); setFailed(null); }}
            />
          </label>

          <label className={`lp-modal-label ${styles.label}`}>
            <span>{a.fieldStatus}</span>
            <select className="lp-modal-input" value={status} disabled={saving} onChange={(e) => setStatus(e.target.value === "disabled" ? "disabled" : "active")}>
              <option value="active">{a.statusEnabled}</option>
              <option value="disabled">{a.statusDisabled}</option>
            </select>
          </label>

          {error ? <p className="lp-modal-error">{error}</p> : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose} disabled={saving}>{a.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? a.saving : isEditing ? a.save : a.create}
          </button>
        </div>
      </div>
    </div>
  );
}
