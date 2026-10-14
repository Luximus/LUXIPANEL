import { useEffect, useState } from "react";
import { LayoutTemplate, Loader2, Users, X } from "lucide-react";
import { templatesApi, type TeamTemplate, type TeamTemplateCategory, type TeamTemplateSummary } from "./api";

export type TeamTemplatesCopy = {
  title: string;
  subtitle: string;
  category: string;
  allCategories: string;
  prefix: string;
  preview: string;
  slots: string;
  apply: string;
  applying: string;
  close: string;
  empty: string;
  loadError: string;
  applyError: string;
  applied: string;
  readOnlyHint: string;
};

export default function TeamTemplatesModal({
  open,
  panelId,
  copy,
  readOnly,
  onClose,
  onApplied,
}: {
  open: boolean;
  panelId: string;
  copy: TeamTemplatesCopy;
  readOnly: boolean;
  onClose: () => void;
  onApplied: (message: string) => void;
}) {
  const [categories, setCategories] = useState<TeamTemplateCategory[]>([]);
  const [templates, setTemplates] = useState<TeamTemplateSummary[]>([]);
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TeamTemplate | null>(null);
  const [namePrefix, setNamePrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    templatesApi
      .list(panelId)
      .then((result) => {
        if (!alive) return;
        setCategories(result.categories);
        setTemplates(result.templates);
      })
      .catch(() => {
        if (alive) setError(copy.loadError);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, panelId, copy.loadError]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    let alive = true;
    templatesApi
      .get(panelId, selectedId)
      .then((template) => {
        if (alive) setSelected(template);
      })
      .catch(() => {
        if (alive) setError(copy.loadError);
      });
    return () => {
      alive = false;
    };
  }, [panelId, selectedId, copy.loadError]);

  if (!open) return null;
  const visibleTemplates = category ? templates.filter((template) => template.category === category) : templates;

  const apply = async () => {
    if (!selected || applying || readOnly) return;
    setApplying(true);
    setError(null);
    try {
      const result = await templatesApi.apply(panelId, selected.id, namePrefix);
      onApplied(copy.applied.replace("{count}", String(result.createdIds.length)));
      setSelectedId(null);
      setNamePrefix("");
      onClose();
    } catch {
      setError(copy.applyError);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[150] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-templates-title"
    >
      <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col">
        <div className="lp-modal-header">
          <div>
            <h2 className="lp-modal-title" id="assistant-templates-title">{copy.title}</h2>
            <p className="mt-1 text-sm text-base-content/60">{copy.subtitle}</p>
          </div>
          <button type="button" className="lp-modal-close" aria-label={copy.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="lp-modal-body flex flex-col gap-3">
          {readOnly ? (
            <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              {copy.readOnlyHint}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm">
              {error}
            </div>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{copy.category}</span>
            <select
              className="select select-bordered w-full"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setSelectedId(null);
              }}
            >
              <option value="">{copy.allCategories}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-base-content/60">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-base-content/60">
              <LayoutTemplate size={24} />
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTemplates.map((template) => {
                const active = selectedId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-start transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-base-300 bg-base-100 hover:border-base-content/30"
                    }`}
                    onClick={() => setSelectedId(template.id)}
                  >
                    <strong className="text-sm font-semibold">{template.name}</strong>
                    <span className="text-xs text-base-content/60">{template.description}</span>
                    <span className="badge badge-outline badge-sm mt-2 gap-1">
                      <Users size={12} />
                      {copy.slots.replace("{count}", String(template.slotCount ?? template.slots?.length ?? 0))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {selected ? (
            <section className="rounded-lg border border-base-300 p-3">
              <h3 className="text-sm font-bold">
                {copy.preview}: {selected.name}
              </h3>
              <div className="mt-3 flex flex-col gap-2">
                {selected.slots.map((slot) => (
                  <div
                    key={slot.slotId}
                    className="flex flex-col gap-0.5 rounded-md border border-base-300/60 bg-base-200/30 px-3 py-2"
                  >
                    <strong className="text-sm">{slot.name}</strong>
                    <span className="text-xs text-base-content/60">{slot.description}</span>
                  </div>
                ))}
              </div>
              {!readOnly ? (
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-sm font-medium">{copy.prefix}</span>
                  <input
                    className="input input-bordered w-full"
                    value={namePrefix}
                    maxLength={80}
                    onChange={(event) => setNamePrefix(event.target.value)}
                  />
                </label>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="lp-modal-footer">
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>
            {copy.close}
          </button>
          {!readOnly ? (
            <button
              type="button"
              className="lp-modal-btn lp-modal-btn--primary"
              disabled={!selected || applying}
              onClick={() => void apply()}
            >
              <LayoutTemplate size={14} />
              {applying ? copy.applying : copy.apply}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
