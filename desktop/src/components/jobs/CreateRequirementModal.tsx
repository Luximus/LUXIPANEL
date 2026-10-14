// Modal "Nuevo requerimiento" + asistente IA de recolección (Fase 6, IMPL-B).
// Espejo de `openCreateModal`/`createRequirement`/`assistCollect`/
// `renderAssistHints` del web. Validación: título ≥ 3, descripción presente,
// precio > 0. Entregables = una línea por ítem. `deadline` → ISO. El asistente
// IA rellena los campos y pinta preguntas/faltantes (o `ai.unavailable` si la IA
// está apagada, `aiUsed === false`).
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  aiCollect, createRequirement, jobsErrorKey, listMyServers,
  type AiCollectFields, type AiCollectResult, type JobServer,
} from "../../api/jobs";
import type { JobsMessages, JobsServerMessages } from "./i18n";

export function CreateRequirementModal({
  open, token, locale, j, cancelLabel, createLabel, onClose, onCreated,
}: {
  open: boolean;
  token: string;
  /** Idioma actual (sirve de `language` por defecto y de `locale` para la IA). */
  locale: string;
  j: JobsMessages & { server: JobsServerMessages };
  /** Etiquetas comunes del repo (`t.common.cancel` / `t.common.create`). */
  cancelLabel: string;
  createLabel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [aiDraft, setAiDraft] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("CO");
  const [language, setLanguage] = useState(locale || "es");
  const [workType, setWorkType] = useState("fixed");
  const [deliverables, setDeliverables] = useState("");
  const [deadline, setDeadline] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [hints, setHints] = useState<AiCollectResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [assisting, setAssisting] = useState(false);
  // Modalidad "Servidor": método + servidor del cliente.
  const [execMode, setExecMode] = useState<"standard" | "server">("standard");
  const [servers, setServers] = useState<JobServer[]>([]);
  const [clientServerId, setClientServerId] = useState("");

  useEffect(() => {
    if (!open || execMode !== "server") return;
    let alive = true;
    void listMyServers(token).then((list) => {
      if (!alive) return;
      setServers(list);
      if (list.length && !clientServerId) setClientServerId(list[0].id);
    }).catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [open, execMode, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const errKey = (err: unknown): string => {
    const path = jobsErrorKey(err).split(".");
    let node: unknown = j;
    for (const p of path) node = (node as Record<string, unknown>)?.[p];
    return typeof node === "string" ? node : (err instanceof Error ? err.message : j.error.generic);
  };

  async function assist() {
    const draft = aiDraft.trim();
    if (!draft) {
      setError(j.ai.draftPlaceholder);
      return;
    }
    setError("");
    setAssisting(true);
    try {
      const known: Partial<AiCollectFields> = {};
      if (title.trim()) known.title = title.trim();
      if (description.trim()) known.description = description.trim();
      const res = await aiCollect(token, draft, Object.keys(known).length ? known : undefined, language || "es");
      const f = res.fields;
      if (f.title) setTitle(f.title);
      if (f.description) setDescription(f.description);
      if (f.country) setCountry(f.country);
      if (f.language) setLanguage(f.language);
      if (f.workType) setWorkType(f.workType);
      if (Array.isArray(f.deliverables) && f.deliverables.length) setDeliverables(f.deliverables.join("\n"));
      if (f.deadline) {
        try { setDeadline(new Date(f.deadline).toISOString().slice(0, 10)); } catch { /* ignore */ }
      }
      setHints(res);
    } catch (err) {
      setError(errKey(err));
    } finally {
      setAssisting(false);
    }
  }

  async function submit() {
    const ttl = title.trim();
    const desc = description.trim();
    const priceNum = parseInt(price, 10);
    if (ttl.length < 3) { setError(j.field.title); return; }
    if (!desc) { setError(j.field.description); return; }
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setError(j.field.price); return; }
    if (execMode === "server" && !clientServerId) { setError(j.server.clientServer); return; }

    const deliverablesArr = deliverables.split("\n").map((s) => s.trim()).filter(Boolean);
    const deadlineAt = deadline.trim() ? new Date(deadline.trim()).toISOString() : null;

    setSubmitting(true);
    setError("");
    try {
      await createRequirement(token, {
        title: ttl,
        description: desc,
        country: (country.trim().toUpperCase() || "CO").slice(0, 2),
        language: language.trim() || "es",
        workType: workType.trim() || "fixed",
        deliverables: deliverablesArr,
        deadlineAt,
        acceptedPrice: priceNum,
        executionMode: execMode,
        clientServerId: execMode === "server" ? clientServerId : null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(errKey(err));
    } finally {
      setSubmitting(false);
    }
  }

  const aiOff = hints?.aiUsed === false;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <button type="button" className="btn btn-sm btn-circle btn-ghost absolute end-3 top-3" onClick={onClose} aria-label="x">
          <X size={16} />
        </button>
        <h3 className="text-lg font-bold">{j.title}</h3>

        {/* Asistente IA de recolección */}
        <div className="mt-4 rounded-xl border border-base-300 bg-base-200/50 p-3">
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            placeholder={j.ai.draftPlaceholder}
            value={aiDraft}
            onChange={(e) => setAiDraft(e.target.value)}
          />
          <div className="mt-2 flex justify-end">
            <button type="button" className="btn btn-sm btn-outline gap-2" onClick={() => void assist()} disabled={assisting}>
              {assisting ? <span className="loading loading-spinner loading-xs" /> : null}
              {j.ai.assist}
            </button>
          </div>
          {aiOff ? <p className="mt-2 text-sm text-warning">{j.ai.unavailable}</p> : null}
          {hints && !aiOff && hints.questions?.length ? (
            <div className="mt-2">
              <h5 className="text-xs font-semibold uppercase opacity-70">{j.ai.questions}</h5>
              <ul className="list-disc pl-5 text-sm">
                {hints.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          ) : null}
          {hints && !aiOff && hints.missing?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
              <strong>{j.ai.missing}:</strong>
              {hints.missing.map((m, i) => <span key={i} className="badge badge-ghost badge-sm">{m}</span>)}
            </div>
          ) : null}
        </div>

        {/* Formulario */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{j.field.title}</span>
            <input className="input input-bordered" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{j.field.description}</span>
            <textarea className="textarea textarea-bordered" rows={4} maxLength={20000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{j.field.deliverables}</span>
            <textarea className="textarea textarea-bordered" rows={3} value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{j.field.country}</span>
            <input className="input input-bordered" maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{j.field.language}</span>
            <input className="input input-bordered" maxLength={8} value={language} onChange={(e) => setLanguage(e.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{j.field.workType}</span>
            <select className="select select-bordered" value={workType} onChange={(e) => setWorkType(e.target.value)}>
              <option value="fixed">{j.workType.fixed}</option>
              <option value="hourly">{j.workType.hourly}</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">{j.field.deadline}</span>
            <input className="input input-bordered" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{j.field.price}</span>
            <input className="input input-bordered" type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>

          {/* Modalidad "Servidor" (AI Dev Marketplace) */}
          <label className="form-control sm:col-span-2">
            <span className="label-text mb-1">{j.server.mode}</span>
            <select className="select select-bordered" value={execMode} onChange={(e) => setExecMode(e.target.value as "standard" | "server")}>
              <option value="standard">{j.server.modeStandard}</option>
              <option value="server">{j.server.modeServer}</option>
            </select>
          </label>
          {execMode === "server" ? (
            <label className="form-control sm:col-span-2">
              <span className="label-text mb-1">{j.server.clientServer}</span>
              {servers.length ? (
                <select className="select select-bordered" value={clientServerId} onChange={(e) => setClientServerId(e.target.value)}>
                  {servers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.hostname})</option>)}
                </select>
              ) : (
                <p className="text-sm text-warning">{j.server.noServers}</p>
              )}
              <span className="label-text-alt mt-1 opacity-70">{j.server.clientServerHint}</span>
            </label>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary gap-2" onClick={() => void submit()} disabled={submitting}>
            {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
            {createLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
