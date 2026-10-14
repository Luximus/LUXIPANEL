/**
 * cron-dialogs (desktop) — diálogos CRUD del módulo Cron como modales
 * `lp-modal-*` (espejo de `app/src/screens/server/cron/cron-dialogs`):
 * crear/editar tarea cron, crear agente IA, visor de registros de ejecución,
 * contraseña sudo para el daemon y presets de agentes. Todos autocontenidos:
 * reciben `serverId`/`language` + callbacks por props desde `CronModule`.
 */
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { callServerApi, serverCronApi, unwrap } from "../../../api/serverApi";
import { formatMessage, getMessages } from "../../../i18n";
import type { AgentPresets, AgentRulePreset, AgentTagPreset, CronJob, CronRun } from "./cron-types";
import { Field, GUARDS, ModalShell, PROVIDERS, runServerMutation, StatusPill } from "./cron-ui";

// ── Diálogo crear/editar tarea cron ──────────────────────────────────────────
export function JobDialog({
  serverId,
  language,
  mode,
  row,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  mode: "create" | "edit";
  row?: CronJob;
  onClose: () => void;
  onSaved: (created: boolean) => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;
  const [schedule, setSchedule] = useState(row?.schedule ?? "");
  const [command, setCommand] = useState(row?.command ?? "");
  const [comment, setComment] = useState(row?.comment ?? "");
  const [enabled, setEnabled] = useState(row?.enabled !== false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload = { schedule: schedule.trim(), command: command.trim(), comment: comment.trim() || null, enabled };
    const op = mode === "edit" && row ? () => serverCronApi.updateJob(serverId, "", row.id, payload) : () => serverCronApi.createJob(serverId, "", payload);
    const out = await runServerMutation(serverId, op);
    setBusy(false);
    if (out.ok) onSaved(mode === "create");
    else onError(out.error);
  };

  const disabled = !schedule.trim() || !command.trim();

  return (
    <ModalShell
      title={mode === "edit" ? t.jobs.titleEdit : t.jobs.titleNew}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.jobs.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy || disabled} onClick={() => void submit()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {mode === "edit" ? t.jobs.save : t.jobs.create}
          </button>
        </>
      }
    >
      <Field label={t.jobs.labelSchedule}>
        <input className="input input-bordered w-full font-mono" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={t.jobs.placeholderSchedule} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label={t.jobs.labelCommand} hint={t.jobs.commandHint}>
        <textarea className="textarea textarea-bordered w-full font-mono text-xs" rows={2} value={command} onChange={(e) => setCommand(e.target.value)} placeholder={t.jobs.placeholderCommand} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label={t.jobs.labelComment}>
        <input className="input input-bordered w-full" value={comment ?? ""} onChange={(e) => setComment(e.target.value)} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-sm">{t.jobs.labelEnabled}</span>
      </label>
    </ModalShell>
  );
}

// ── Diálogo crear agente IA programado ───────────────────────────────────────
export function AgentDialog({
  serverId,
  language,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [providerId, setProviderId] = useState("claude");
  const [prompt, setPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload = { name: name.trim(), schedule: schedule.trim(), providerId, prompt: prompt.trim(), enabled };
    const out = await runServerMutation(serverId, () => serverCronApi.createAiJob(serverId, "", payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  const disabled = !name.trim() || !prompt.trim();

  return (
    <ModalShell
      title={t.agents.title}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.agents.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy || disabled} onClick={() => void submit()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.agents.create}
          </button>
        </>
      }
    >
      <Field label={t.agents.labelName}>
        <input className="input input-bordered w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.agents.placeholderName} />
      </Field>
      <Field label={t.agents.labelSchedule}>
        <input className="input input-bordered w-full font-mono" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={t.agents.placeholderSchedule} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </Field>
      <Field label={t.agents.labelProvider}>
        <select className="select select-bordered w-full" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </Field>
      <Field label={t.agents.labelPrompt}>
        <textarea className="textarea textarea-bordered w-full" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t.agents.placeholderPrompt} />
      </Field>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="text-sm">{t.agents.labelEnabled}</span>
      </label>
    </ModalShell>
  );
}

// ── Diálogo de registros de ejecución (tarea cron o agente IA) ───────────────
export function LogsDialog({
  serverId,
  language,
  kind,
  targetId,
  name,
  onClose,
}: {
  serverId: string;
  language?: string;
  kind: "job" | "agent";
  targetId: string;
  name: string;
  onClose: () => void;
}) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;
  const base = kind === "job" ? "jobs" : "ai-jobs";

  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CronRun | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsError(null);
    const res = await callServerApi(serverId, "", "GET", `/api/cron/${base}/${encodeURIComponent(targetId)}/logs`);
    setLoadingRuns(false);
    if (!res.ok) {
      setRuns([]);
      setRunsError(res.error ?? t.logs.loadError);
      return;
    }
    setRuns(unwrap<CronRun[]>(res) ?? []);
  }, [serverId, base, targetId, t.logs.loadError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga/estado inicial intencional del efecto
    void loadRuns();
  }, [loadRuns]);

  const openRun = useCallback(
    async (run: CronRun) => {
      if (!run.file) return;
      setSelected(run);
      setContent(null);
      setContentError(false);
      setLoadingContent(true);
      const res = await callServerApi(serverId, "", "GET", `/api/cron/${base}/${encodeURIComponent(targetId)}/logs/${encodeURIComponent(run.file)}`);
      setLoadingContent(false);
      if (!res.ok) {
        setContentError(true);
        return;
      }
      const data = unwrap<{ file?: string; content?: string }>(res);
      setContent(data?.content ?? "");
    },
    [serverId, base, targetId],
  );

  const runLabel = (run: CronRun) => {
    if (run.startedAt) {
      const d = new Date(run.startedAt);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    return (run.file ?? "—").replace(/\.log$/, "");
  };

  const RunStatus = ({ run }: { run: CronRun }) => {
    if (run.running) return <StatusPill label={t.logs.running} kind="amber" />;
    if (typeof run.exitCode === "number" && run.exitCode !== 0) return <StatusPill label={formatMessage(t.logs.exitError, { code: run.exitCode })} kind="danger" />;
    return <StatusPill label={formatMessage(t.logs.ok, { ms: run.durationMs ?? 0 })} kind="ok" />;
  };

  return (
    <ModalShell
      title={formatMessage(t.logs.titleFor, { name })}
      onClose={onClose}
      closeLabel={c.close}
      maxW="max-w-2xl"
      bodyClassName="flex flex-col gap-3 min-h-[16rem]"
      footer={<button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{c.close}</button>}
    >
      {!selected ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-base-content/60">{t.logs.pickRun}</span>
            <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={() => void loadRuns()}>
              <RefreshCw size={13} /> {c.refresh}
            </button>
          </div>
          {loadingRuns ? (
            <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
          ) : runsError ? (
            <p className="py-2 text-sm text-error">{runsError}</p>
          ) : runs.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-content/50">{t.logs.empty}</p>
          ) : (
            <div className="flex flex-col overflow-y-auto">
              {runs.map((run, i) => (
                <button
                  key={run.file ?? String(i)}
                  type="button"
                  className="flex items-center gap-2.5 border-b border-base-300 py-3 text-left last:border-b-0 hover:bg-base-200"
                  onClick={() => void openRun(run)}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-base-content/80">{runLabel(run)}</span>
                  <RunStatus run={run} />
                  <ChevronRight size={16} className="text-base-content/40" />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => {
                setSelected(null);
                setContent(null);
                setContentError(false);
              }}
            >
              <ChevronLeft size={15} /> {t.logs.back}
            </button>
            <span className="min-w-0 flex-1 truncate text-right text-xs text-base-content/50">{runLabel(selected)}</span>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => void openRun(selected)}><RefreshCw size={14} /></button>
          </div>
          {loadingContent ? (
            <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
          ) : contentError ? (
            <p className="py-2 text-sm text-error">{t.logs.contentError}</p>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg bg-base-200 p-3 font-mono text-[11px] leading-4 text-base-content/80">
              {content && content.length > 0 ? content : t.logs.contentEmpty}
            </pre>
          )}
        </>
      )}
    </ModalShell>
  );
}

// ── Diálogo de contraseña sudo (install / activar / desactivar servicio) ─────
export function SudoPasswordModal({
  language,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  language?: string;
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
  onClose: () => void;
}) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;
  const [pw, setPw] = useState("");

  return (
    <ModalShell
      title={t.sudo.title}
      onClose={onClose}
      closeLabel={c.close}
      maxW="max-w-md"
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.sudo.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy || !pw.trim()} onClick={() => onSubmit(pw)}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.sudo.submit}
          </button>
        </>
      }
    >
      <p className="text-sm text-base-content/70">{t.sudo.desc}</p>
      <Field label={t.sudo.label}>
        <input type="password" className="input input-bordered w-full" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t.sudo.placeholder} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />
      </Field>
      {error ? <p className="text-xs text-error">{error}</p> : null}
    </ModalShell>
  );
}

// ── Diálogo de presets de agentes (categorías + etiquetas reutilizables) ─────
export function PresetsDialog({
  serverId,
  language,
  onClose,
  onSaved,
  onError,
}: {
  serverId: string;
  language?: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg?: string) => void;
}) {
  const t = getMessages(language).serverCron;
  const c = getMessages(language).common;

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<AgentTagPreset[]>([]);
  // `rules` no se edita aquí; se conserva para no perderlo al reemplazar el doc.
  const [rules, setRules] = useState<AgentRulePreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagCat, setNewTagCat] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      const res = await callServerApi(serverId, "", "GET", "/api/cron/agent-presets");
      if (!alive) return;
      setLoading(false);
      if ((res.code && GUARDS.includes(res.code)) || !res.ok) {
        setLoadErr(t.presets.loadError);
        return;
      }
      const data = unwrap<AgentPresets>(res);
      setCategories(Array.isArray(data?.categories) ? data!.categories.filter((x) => typeof x === "string") : []);
      setTags(
        Array.isArray(data?.tags)
          ? data!.tags
              .map((tg) => (typeof tg === "string" ? { name: tg, category: "" } : { name: tg?.name ?? "", category: tg?.category ?? "" }))
              .filter((tg) => tg.name)
          : [],
      );
      setRules(Array.isArray(data?.rules) ? data!.rules : []);
    })();
    return () => {
      alive = false;
    };
  }, [serverId, t.presets.loadError]);

  const addCategory = () => {
    const v = newCat.trim();
    if (!v || categories.includes(v)) {
      setNewCat("");
      return;
    }
    setCategories((prev) => [...prev, v]);
    if (!newTagCat) setNewTagCat(v);
    setNewCat("");
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((x) => x !== cat));
    setTags((prev) => prev.filter((tg) => tg.category !== cat));
    if (newTagCat === cat) setNewTagCat("");
  };

  const addTag = () => {
    const nm = newTagName.trim();
    const category = newTagCat;
    if (!nm || !category) return;
    if (tags.some((tg) => tg.name === nm && tg.category === category)) {
      setNewTagName("");
      return;
    }
    setTags((prev) => [...prev, { name: nm, category }]);
    setNewTagName("");
  };

  const removeTag = (idx: number) => setTags((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    const payload = {
      categories: [...new Set(categories.map((x) => x.trim()).filter(Boolean))],
      tags: tags
        .filter((tg) => tg.name.trim() && tg.category.trim())
        .map((tg) => ({ name: tg.name.trim(), category: tg.category.trim() })),
      rules: rules
        .filter((r) => r.title?.trim() && r.text?.trim())
        .map((r) => ({ ...(r.id ? { id: r.id } : {}), title: r.title as string, text: r.text as string })),
    };
    const out = await runServerMutation(serverId, () => callServerApi(serverId, "", "PUT", "/api/cron/agent-presets", payload));
    setBusy(false);
    if (out.ok) onSaved();
    else onError(out.error);
  };

  return (
    <ModalShell
      title={t.presets.title}
      onClose={onClose}
      closeLabel={c.close}
      footer={
        <>
          <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={onClose}>{t.presets.cancel}</button>
          <button type="button" className="lp-modal-btn lp-modal-btn--primary" disabled={busy || loading || !!loadErr} onClick={() => void save()}>
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {t.presets.save}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
      ) : loadErr ? (
        <p className="py-2 text-sm text-error">{loadErr}</p>
      ) : (
        <>
          <p className="text-xs text-base-content/60">{t.presets.hint}</p>

          <Field label={t.presets.categories}>
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <span className="text-xs text-base-content/50">{t.presets.emptyCategories}</span>
              ) : (
                categories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs">
                    {cat}
                    <button type="button" className="text-base-content/50 hover:text-error" onClick={() => removeCategory(cat)}><X size={13} /></button>
                  </span>
                ))
              )}
            </div>
            <div className="mt-2 flex items-start gap-2">
              <input className="input input-bordered input-sm flex-1" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t.presets.newCategory} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} />
              <button type="button" className="btn btn-sm btn-outline" disabled={!newCat.trim()} onClick={addCategory}>{t.presets.add}</button>
            </div>
          </Field>

          <Field label={t.presets.tags}>
            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <span className="text-xs text-base-content/50">{t.presets.emptyTags}</span>
              ) : (
                tags.map((tg, i) => (
                  <span key={`${tg.category} ${tg.name} ${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1.5 text-xs">
                    {tg.category ? `${tg.category} · ${tg.name}` : tg.name}
                    <button type="button" className="text-base-content/50 hover:text-error" onClick={() => removeTag(i)}><X size={13} /></button>
                  </span>
                ))
              )}
            </div>
            {categories.length === 0 ? (
              <span className="mt-2 text-xs text-base-content/50">{t.presets.needCategory}</span>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <select className="select select-bordered select-sm w-full" value={newTagCat} onChange={(e) => setNewTagCat(e.target.value)}>
                  <option value="">{t.presets.selectCategory}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="flex items-start gap-2">
                  <input className="input input-bordered input-sm flex-1" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder={t.presets.newTag} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                  <button type="button" className="btn btn-sm btn-outline" disabled={!newTagName.trim() || !newTagCat} onClick={addTag}>{t.presets.add}</button>
                </div>
              </div>
            )}
          </Field>

          <p className="text-[11px] text-base-content/50">{t.presets.rulesNote}</p>
        </>
      )}
    </ModalShell>
  );
}
